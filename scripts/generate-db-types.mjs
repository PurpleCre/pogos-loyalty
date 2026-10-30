import { readFile, writeFile } from 'node:fs/promises';
import { createTestDatabase } from './test-database.mjs';

// Generate from the locally migrated PostgreSQL catalogue, never a live project.
const db = await createTestDatabase();
try {
  const { rows: columns } = await db.query(`
    SELECT table_name, column_name, is_nullable, column_default, data_type, udt_name
    FROM information_schema.columns WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  const { rows: enums } = await db.query(`
    SELECT t.typname, e.enumlabel FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder
  `);
  const enumNames = new Set(enums.map(e => e.typname));
  function type(name) {
    if (enumNames.has(name)) return `Database["public"]["Enums"][${JSON.stringify(name)}]`;
    if (name.startsWith('_')) return `(${type(name.slice(1))})[]`;
    if (['int2', 'int4', 'int8', 'float4', 'float8', 'numeric'].includes(name)) return 'number';
    if (name === 'bool') return 'boolean';
    if (['json', 'jsonb'].includes(name)) return 'Json';
    if (name === 'void') return 'undefined';
    if (['uuid', 'text', 'varchar', 'bpchar', 'timestamp', 'timestamptz', 'date', 'time', 'timetz', 'name'].includes(name)) return 'string';
    throw new Error(`Unmapped database type: ${name}`);
  }
  const { rows: keys } = await db.query(`
    SELECT c.conname, c.conrelid::regclass::text AS table_name,
      c.confrelid::regclass::text AS referenced_table,
      ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(num, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num ORDER BY k.ord) AS columns,
      ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY k(num, ord)
        JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.num ORDER BY k.ord) AS referenced_columns,
      EXISTS (SELECT 1 FROM pg_constraint u WHERE u.conrelid = c.conrelid
        AND u.contype IN ('u', 'p') AND u.conkey = c.conkey) AS one_to_one
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class rt ON rt.oid = c.confrelid
    JOIN pg_namespace rn ON rn.oid = rt.relnamespace
    WHERE c.contype = 'f' AND n.nspname = 'public' AND rn.nspname = 'public'
    ORDER BY c.conname
  `);
  const tables = [...new Set(columns.map(c => c.table_name))].map(table => {
    const fields = columns.filter(c => c.table_name === table);
    const shapes = ['Row', 'Insert', 'Update'].map(shape => {
      const properties = fields.map(c => {
        const optional = shape === 'Update' || (shape === 'Insert' && (c.is_nullable === 'YES' || c.column_default !== null));
        return `        ${JSON.stringify(c.column_name)}${optional ? '?' : ''}: ${type(c.udt_name)}${c.is_nullable === 'YES' ? ' | null' : ''}`;
      }).join('\n');
      return `      ${shape}: {\n${properties}\n      }`;
    }).join('\n');
    const relations = keys.filter(k => k.table_name === table).map(k => `        {
          foreignKeyName: ${JSON.stringify(k.conname)}
          columns: ${JSON.stringify(k.columns)}
          isOneToOne: ${k.one_to_one}
          referencedRelation: ${JSON.stringify(k.referenced_table)}
          referencedColumns: ${JSON.stringify(k.referenced_columns)}
        }`).join(',\n');
    return `    ${JSON.stringify(table)}: {\n${shapes}\n      Relationships: [\n${relations}\n      ]\n    }`;
  }).join('\n');
  const { rows: functions } = await db.query(`
    SELECT p.proname, p.proargnames, p.pronargdefaults,
      ARRAY(SELECT t.typname FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY a(id, ord)
        JOIN pg_type t ON t.oid = a.id ORDER BY a.ord) AS argtypes,
      rt.typname AS returns
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type rt ON rt.oid = p.prorettype
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND rt.typname != 'trigger'
    ORDER BY p.proname
  `);
  const functionTypes = functions.map(f => {
    const args = f.argtypes.map((t, i) => `        ${JSON.stringify(f.proargnames[i])}${i >= f.argtypes.length - f.pronargdefaults ? '?' : ''}: ${type(t)}`).join('\n');
    return `    ${JSON.stringify(f.proname)}: {\n      Args: ${args ? `{\n${args}\n      }` : 'Record<PropertyKey, never>'}\n      Returns: ${type(f.returns)}\n    }`;
  }).join('\n');
  const enumTypes = [...enumNames].sort().map(name => `    ${JSON.stringify(name)}: ${enums.filter(e => e.typname === name).map(e => JSON.stringify(e.enumlabel)).join(' | ')}`).join('\n');
  const outputPath = new URL('../lib/types.ts', import.meta.url);
  const existing = await readFile(outputPath, 'utf8');
  const helperStart = existing.indexOf('type DatabaseWithoutInternals');
  if (helperStart < 0) throw new Error('Database helper types are missing');
  const helpers = existing.slice(helperStart).split('\nexport const Constants')[0].trimEnd();
  const constants = { public: { Enums: Object.fromEntries([...enumNames].sort().map(name => [name, enums.filter(e => e.typname === name).map(e => e.enumlabel)])) } };
  const output = `// Generated by npm run db:types from local migrations. Do not edit by hand.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
${tables}
    }
    Views: { [_ in never]: never }
    Functions: {
${functionTypes}
    }
    Enums: {
${enumTypes}
    }
    CompositeTypes: { [_ in never]: never }
  }
}

${helpers}

export const Constants = ${JSON.stringify(constants, null, 2)} as const
`;
  if (process.argv.includes('--check')) {
    if (existing !== output) throw new Error('Database types differ from migrations. Run npm run db:types.');
    console.log('Database types match local migrations.');
  } else {
    await writeFile(outputPath, output);
    console.log('Generated lib/types.ts from local migrations.');
  }
} finally {
  await db.close();
}

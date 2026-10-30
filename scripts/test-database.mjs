import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';

// Local PostgreSQL only. No .env loading, network connections or live credentials.
// Supabase supplies auth.users/auth.uid and roles; these minimal equivalents let
// us run the real migrations and exercise privileges/RLS as untrusted callers.
export async function createTestDatabase({ beforeContainment } = {}) {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT,
        raw_user_meta_data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
    `);
    const directory = new URL('../supabase/migrations/', import.meta.url);
    for (const filename of (await readdir(directory)).filter(f => f.endsWith('.sql')).sort()) {
      if (filename === '20261030000001_security_containment.sql' && beforeContainment) {
        await beforeContainment(db);
      }
      try {
        await db.exec(await readFile(new URL(filename, directory), 'utf8'));
      } catch (error) {
        throw new Error(`Migration failed: ${filename}`, { cause: error });
      }
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export async function asRole(db, role, userId, operation) {
  if (!['anon', 'authenticated', 'service_role'].includes(role)) throw new Error('Invalid test role');
  await db.exec(`SET ROLE ${role}`);
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  try {
    return await operation();
  } finally {
    await db.exec('RESET ROLE');
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
  }
}

// Disposable database approval only. Never use this as a real retention policy.
export async function installPrivacyPolicy(db, version = 'fixture-core-v1', mutate = value => value) {
  const { rows: [inventory] } = await db.query(`SELECT public.privacy_core_fields() AS core, public.privacy_application_schema() AS fingerprint`);
  const { rows: columns } = await db.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`);
  const decisions = Object.fromEntries(columns.map(({table_name: table, column_name: field}) => [
    `${table}.${field}`, {
      action: inventory.core[table]?.includes(field) ? 'core' : 'manual',
      reason_reference: 'Synthetic local fixture; not a legal approval',
      retain_until: inventory.core[table]?.includes(field) ? null : '2099-01-01T00:00:00Z',
    },
  ]));
  const reviewed = mutate({decisions, fingerprint: inventory.fingerprint});
  await db.query(`INSERT INTO public.privacy_application_policies(version,retention_version,schema_fingerprint,operation_version,field_decisions,approval_reference,approved_by,approved_at,expires_at)
    VALUES($1,'fixture-retention',$2,'core-contact-v1',$3,'Disposable database fixture only','Synthetic reviewer',now()-interval '1 minute',now()+interval '1 day')`, [version, reviewed.fingerprint, reviewed.decisions]);
  return version;
}

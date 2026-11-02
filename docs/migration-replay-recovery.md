# Recovering the historical migration policy conflict

Updated: 31 October 2026.

## Observed failure

The reported remote push applied the catalogue baseline, distance-default and points-sharing migrations, then stopped at `20260916010000_user_locations.sql` with SQLSTATE `42710`: policy `Users can view their own locations` already exists.

That policy exists in the target database, while the CLI considers the migration pending. This is consistent with a previous manual installation or incomplete migration-history reconciliation; the supplied output does not establish which. `CREATE TABLE IF NOT EXISTS` only guards table creation. It does not make following `CREATE POLICY` statements replayable.

## Repository correction

The location migration now drops and recreates its four exact policy names before defining their intended ownership checks. It preserves the table, address rows and unrelated policies. Its existing trigger replacement remains in place.

The subsequent historical GAAP migration had the same pattern. Its seven exact policy names now use the same replacement approach, preserving its tables and data. The later security/ledger/identity migrations must still run: the historical GAAP definition alone is not a safe final security baseline.

These are corrections to the pending historical files because a new, later migration cannot run before the blocking file. An already-recorded migration will normally be skipped; editing its local file does not update an already-applied remote schema. Do not mark applied security migrations reverted merely to replay old definitions.

## Verify the target and migration plan

Confirm the linked project is the intended development environment. Current connected accounts were authorised for development; production ownership and release acceptance remain separate. If the project holds real customer data, follow the existing inventory, backup and representative-copy rehearsal prerequisites before applying the pending security and financial changes.

Run these read-only planning commands from the corrected checkout:

```sh
npx supabase migration list --linked
npx supabase db push --linked --include-all --dry-run
```

`--include-all` includes local migrations missing from remote history, including older timestamps. `--dry-run` lists planned migrations; it does not prove that their SQL will execute against the remote schema. Explicit `--linked` removes ambiguity about the target as CLI defaults change. [Supabase CLI: db push](https://supabase.com/docs/reference/cli/supabase-db-push)

Check that the three successful migrations are reflected in remote history and that the failed location migration and subsequent expected migrations remain pending. If the history differs, compare the actual schema and history before changing either. A same-named object is not proof that an entire migration is already applied.

Once the target and plan are verified and any required data rehearsal is complete, retry:

```sh
npx supabase db push --linked --include-all
```

After success, run `npx supabase migration list --linked` again, then perform hosted access/financial checks from the milestone activation procedures. A successful SQL push is not branch activation or production acceptance.

Do not use a remote database reset to resolve this error. Do not mark the failed migration applied merely to skip it: its remaining policies, function and trigger may not match. `migration repair` changes history records without applying the missing SQL; use it only after demonstrating complete schema equivalence and agreeing the intended history. [Supabase CLI: migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair)

If another migration fails, retain its filename, SQLSTATE and failing statement, and inspect that conflict. Avoid sharing credentials or unrestricted debug output. This correction handles the reproduced policy conflicts, not arbitrary remote schema drift.

## Local verification

Regression cases preinstall the historical location and GAAP migrations, seed representative rows, replay them and apply the remaining migration chain. They verify address ownership/CRUD, preservation of unrelated policies and existing records, one update trigger, and the final denial of customer GAAP writes and legacy processing execution.

```sh
node --test tests/migration-upgrade.test.mjs
npm run check
```

These tests run in disposable local PGlite with simulated Supabase roles. They do not prove the linked project's schema/history or hosted JWT/API behavior. No remote database command was run while preparing this fix.

Validation for this correction: all four migration-upgrade cases pass, and `npm run check` passes with **216 tests**, TypeScript, lint, generated-type drift, SDK compatibility and installed-peer checks. The full suite includes the two new policy-replay regression cases.

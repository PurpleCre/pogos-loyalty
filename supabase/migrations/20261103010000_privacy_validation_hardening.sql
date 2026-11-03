-- Forward-only correction: a JSON retention deadline must not move with each
-- validation (e.g. PostgreSQL's "tomorrow") or depend on the session time zone.
-- No policy, activation flag, run receipt or customer record is changed here.
DO $$
DECLARE definition TEXT; marker TEXT:='   v_end:=(d->>''retain_until'')::timestamptz;';
BEGIN
  definition:=pg_get_functiondef('public.validate_privacy_application_policy(text)'::regprocedure);
  IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Privacy deadline validation overlay drift'; END IF;
  EXECUTE replace(definition,marker,$patch$   IF (d->>'retain_until') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?Z$' THEN
    RAISE EXCEPTION 'Retained record deadline must be an absolute UTC timestamp (YYYY-MM-DDTHH:MM:SS[.ffffff]Z)' USING ERRCODE='22023';
   END IF;
   v_end:=(d->>'retain_until')::timestamptz;$patch$);
END;
$$;

-- JSON representations of timestamptz otherwise inherit the caller's session
-- time zone. Canonical UTC makes an unchanged source hash survive retries from
-- different server/SQL sessions. Preserve the original function's privileges.
ALTER FUNCTION public.privacy_financial_fingerprint(UUID) SET TimeZone='UTC';

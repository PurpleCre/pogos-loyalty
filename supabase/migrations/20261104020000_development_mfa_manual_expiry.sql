-- User-authorised change: named development exceptions remain enabled until
-- manually disabled. Auth-session validity and all existing scope checks stay.
ALTER TABLE public.development_mfa_grants DROP CONSTRAINT development_mfa_grants_expires_at_check;
ALTER TABLE public.development_mfa_grants ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.development_mfa_sessions ALTER COLUMN expires_at DROP NOT NULL;

UPDATE public.development_mfa_grants SET expires_at=NULL,updated_at=now(),
 reason='User authorised named development access until manually disabled on 4 November 2026; preserve existing roles';
INSERT INTO public.development_mfa_events(kind,email,details)
 SELECT 'configure',email,jsonb_build_object('enabled',enabled,'non_expiring',true,'reason',reason) FROM public.development_mfa_grants;
-- Preserve explicit session opt-in. Do not revive ended or already expired rows.
UPDATE public.development_mfa_sessions SET expires_at=NULL WHERE ended_at IS NULL AND expires_at>now();

CREATE OR REPLACE FUNCTION public.development_mfa_allowed() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(auth.uid() IS NOT NULL
 AND auth.jwt()->>'iss'='https://hsyibcyvujwwqygigepe.supabase.co/auth/v1'
 AND NOT coalesce(auth.jwt()->'amr','[]'::jsonb) @> '[{"method":"recovery"}]'::jsonb
 AND coalesce(auth.jwt()->'amr','[]'::jsonb) @> '[{"method":"password"}]'::jsonb
 AND public.privacy_account_live()
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=public.development_mfa_session_id() AND s.user_id=auth.uid())
 AND EXISTS(SELECT 1 FROM auth.users u JOIN public.development_mfa_grants g ON g.email=lower(u.email)
   WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND g.enabled AND (g.expires_at IS NULL OR g.expires_at>now()))
 AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role IN ('admin','staff')),false)
$$;
CREATE OR REPLACE FUNCTION public.development_mfa_active() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(public.development_mfa_allowed(),false) AND EXISTS(
   SELECT 1 FROM public.development_mfa_sessions s JOIN auth.users u ON u.id=s.user_id
   WHERE s.session_id=public.development_mfa_session_id() AND s.user_id=auth.uid() AND s.email=lower(u.email)
     AND s.ended_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now()))
$$;
CREATE FUNCTION public.development_mfa_status_v2() RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_allowed BOOLEAN:=coalesce(public.development_mfa_allowed(),false);v_active BOOLEAN:=coalesce(public.development_mfa_active(),false);v_expiry TIMESTAMPTZ;
BEGIN
 IF v_allowed THEN
  SELECT g.expires_at INTO v_expiry FROM public.development_mfa_grants g JOIN auth.users u ON lower(u.email)=g.email WHERE u.id=auth.uid();
  IF v_active THEN SELECT least(v_expiry,s.expires_at) INTO v_expiry FROM public.development_mfa_sessions s WHERE s.session_id=public.development_mfa_session_id(); END IF;
 END IF;
 RETURN jsonb_build_object('available',v_allowed,'active',v_active,'expires_at',v_expiry,'non_expiring',v_allowed AND v_expiry IS NULL,'server_time',now());
END; $$;
REVOKE ALL ON FUNCTION public.development_mfa_status_v2() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.development_mfa_status_v2() TO authenticated;
-- Installed v1 clients treat a null expiry as unavailable. Give those clients
-- a rolling display/cache window while the actual grant/session has no timer.
CREATE OR REPLACE FUNCTION public.development_mfa_status() RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v JSONB:=public.development_mfa_status_v2();
BEGIN
 IF (v->>'available')::boolean AND (v->>'non_expiring')::boolean THEN
  RETURN v || jsonb_build_object('expires_at',now()+interval '8 hours');
 END IF;
 RETURN v;
END; $$;
CREATE OR REPLACE FUNCTION public.begin_development_mfa_session() RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id UUID:=public.development_mfa_session_id();v_email TEXT;v_expiry TIMESTAMPTZ;
BEGIN
 IF NOT coalesce(public.development_mfa_allowed(),false) THEN RAISE EXCEPTION 'Named development access is unavailable' USING ERRCODE='42501'; END IF;
 PERFORM public.privacy_assert_account_available();
 SELECT g.email,g.expires_at INTO v_email,v_expiry FROM public.development_mfa_grants g JOIN auth.users u ON lower(u.email)=g.email WHERE u.id=auth.uid();
 PERFORM pg_advisory_xact_lock(hashtextextended('development-mfa:'||v_id,0));
 IF NOT public.development_mfa_active() THEN
  INSERT INTO public.development_mfa_sessions(session_id,user_id,email,expires_at) VALUES(v_id,auth.uid(),v_email,v_expiry)
   ON CONFLICT(session_id) DO UPDATE SET user_id=EXCLUDED.user_id,email=EXCLUDED.email,expires_at=EXCLUDED.expires_at,started_at=now(),ended_at=NULL;
  INSERT INTO public.development_mfa_events(kind,user_id,session_id,email,details)
   VALUES('begin',auth.uid(),v_id,v_email,jsonb_build_object('expires_at',v_expiry,'non_expiring',v_expiry IS NULL,'actual_aal',auth.jwt()->>'aal'));
 END IF;
 RETURN public.development_mfa_status_v2();
END; $$;
CREATE OR REPLACE FUNCTION public.configure_development_mfa_bypass(p_email TEXT,p_enabled BOOLEAN,p_reason TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email TEXT:=lower(btrim(p_email));
BEGIN
 IF v_email IS NULL OR v_email NOT IN ('pgonese6@gmail.com','rathvelem@gmail.com') OR p_enabled IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500
 THEN RAISE EXCEPTION 'Invalid named development configuration' USING ERRCODE='22023'; END IF;
 INSERT INTO public.development_mfa_grants(email,enabled,expires_at,reason) VALUES(v_email,p_enabled,NULL,btrim(p_reason))
 ON CONFLICT(email) DO UPDATE SET enabled=EXCLUDED.enabled,expires_at=NULL,reason=EXCLUDED.reason,updated_at=now();
 IF NOT p_enabled THEN UPDATE public.development_mfa_sessions SET ended_at=now() WHERE email=v_email AND ended_at IS NULL; END IF;
 INSERT INTO public.development_mfa_events(kind,email,details) VALUES('configure',v_email,jsonb_build_object('enabled',p_enabled,'non_expiring',true,'reason',btrim(p_reason)));
END; $$;

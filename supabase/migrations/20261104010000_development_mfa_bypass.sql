-- Temporary, named development access. Actual JWT assurance stays unchanged.
CREATE TABLE public.development_mfa_grants (
  email TEXT PRIMARY KEY CHECK (email IN ('pgonese6@gmail.com','rathvelem@gmail.com')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at <= '2026-11-10T22:00:00Z'),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.development_mfa_sessions (
  session_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL REFERENCES public.development_mfa_grants(email),
  expires_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE TABLE public.development_mfa_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL CHECK(kind IN ('configure','begin','end')),
  user_id UUID,
  session_id UUID,
  email TEXT NOT NULL,
  details JSONB NOT NULL
);
ALTER TABLE public.development_mfa_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_mfa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_mfa_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.development_mfa_grants,public.development_mfa_sessions,public.development_mfa_events FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER development_mfa_events_immutable BEFORE UPDATE OR DELETE ON public.development_mfa_events
  FOR EACH ROW EXECUTE FUNCTION public.protect_identity_audit();
CREATE FUNCTION public.development_mfa_session_id() RETURNS UUID LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE v TEXT:=auth.jwt()->>'session_id';
BEGIN
 IF v IS NULL OR v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN NULL; END IF;
 RETURN v::uuid;
END; $$;
CREATE FUNCTION public.development_mfa_allowed() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(auth.uid() IS NOT NULL
 AND auth.jwt()->>'iss'='https://hsyibcyvujwwqygigepe.supabase.co/auth/v1'
 AND now()<'2026-11-10T22:00:00Z'::timestamptz
 AND NOT coalesce(auth.jwt()->'amr','[]'::jsonb) @> '[{"method":"recovery"}]'::jsonb
 AND coalesce(auth.jwt()->'amr','[]'::jsonb) @> '[{"method":"password"}]'::jsonb
 AND public.privacy_account_live()
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=public.development_mfa_session_id() AND s.user_id=auth.uid())
 AND EXISTS(SELECT 1 FROM auth.users u JOIN public.development_mfa_grants g ON g.email=lower(u.email)
   WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND g.enabled AND g.expires_at>now())
 AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role IN ('admin','staff')),false)
$$;
CREATE FUNCTION public.development_mfa_active() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(public.development_mfa_allowed(),false) AND EXISTS(
   SELECT 1 FROM public.development_mfa_sessions s JOIN auth.users u ON u.id=s.user_id
   WHERE s.session_id=public.development_mfa_session_id() AND s.user_id=auth.uid() AND s.email=lower(u.email)
     AND s.ended_at IS NULL AND s.expires_at>now())
$$;
CREATE FUNCTION public.identity_access_assured() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(public.identity_aal2(),false) OR coalesce(public.development_mfa_active(),false)
$$;
CREATE FUNCTION public.development_mfa_status() RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_allowed BOOLEAN:=coalesce(public.development_mfa_allowed(),false);v_active BOOLEAN:=coalesce(public.development_mfa_active(),false);v_expiry TIMESTAMPTZ;
BEGIN
 IF v_allowed THEN
  SELECT g.expires_at INTO v_expiry FROM public.development_mfa_grants g JOIN auth.users u ON lower(u.email)=g.email WHERE u.id=auth.uid();
  IF v_active THEN SELECT least(v_expiry,s.expires_at) INTO v_expiry FROM public.development_mfa_sessions s WHERE s.session_id=public.development_mfa_session_id(); END IF;
 END IF;
 RETURN jsonb_build_object('available',v_allowed,'active',v_active,'expires_at',v_expiry,'server_time',now());
END; $$;
CREATE FUNCTION public.begin_development_mfa_session() RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id UUID:=public.development_mfa_session_id();v_email TEXT;v_expiry TIMESTAMPTZ;
BEGIN
 IF NOT coalesce(public.development_mfa_allowed(),false) THEN RAISE EXCEPTION 'Named development access is unavailable' USING ERRCODE='42501'; END IF;
 PERFORM public.privacy_assert_account_available();
 SELECT g.email,least(g.expires_at,now()+interval '8 hours') INTO v_email,v_expiry
 FROM public.development_mfa_grants g JOIN auth.users u ON lower(u.email)=g.email WHERE u.id=auth.uid();
 PERFORM pg_advisory_xact_lock(hashtextextended('development-mfa:'||v_id,0));
 IF NOT public.development_mfa_active() THEN
  INSERT INTO public.development_mfa_sessions(session_id,user_id,email,expires_at) VALUES(v_id,auth.uid(),v_email,v_expiry)
   ON CONFLICT(session_id) DO UPDATE SET user_id=EXCLUDED.user_id,email=EXCLUDED.email,expires_at=EXCLUDED.expires_at,started_at=now(),ended_at=NULL;
  INSERT INTO public.development_mfa_events(kind,user_id,session_id,email,details)
   VALUES('begin',auth.uid(),v_id,v_email,jsonb_build_object('expires_at',v_expiry,'actual_aal',auth.jwt()->>'aal'));
 END IF;
 RETURN public.development_mfa_status();
END; $$;
CREATE FUNCTION public.end_development_mfa_session() RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email TEXT;v_id UUID:=public.development_mfa_session_id();
BEGIN
 UPDATE public.development_mfa_sessions SET ended_at=now() WHERE session_id=v_id AND user_id=auth.uid() AND ended_at IS NULL RETURNING email INTO v_email;
 IF FOUND THEN INSERT INTO public.development_mfa_events(kind,user_id,session_id,email,details) VALUES('end',auth.uid(),v_id,v_email,'{}'); END IF;
END; $$;
CREATE FUNCTION public.configure_development_mfa_bypass(p_email TEXT,p_enabled BOOLEAN,p_reason TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email TEXT:=lower(btrim(p_email));
BEGIN
 IF v_email NOT IN ('pgonese6@gmail.com','rathvelem@gmail.com') OR p_enabled IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500
 THEN RAISE EXCEPTION 'Invalid named development configuration' USING ERRCODE='22023'; END IF;
 IF p_enabled AND now()>='2026-11-10T22:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Development exception expired' USING ERRCODE='22023'; END IF;
 INSERT INTO public.development_mfa_grants(email,enabled,expires_at,reason) VALUES(v_email,p_enabled,'2026-11-10T22:00:00Z',btrim(p_reason))
 ON CONFLICT(email) DO UPDATE SET enabled=EXCLUDED.enabled,reason=EXCLUDED.reason,updated_at=now();
 IF NOT p_enabled THEN UPDATE public.development_mfa_sessions SET ended_at=now() WHERE email=v_email AND ended_at IS NULL; END IF;
 INSERT INTO public.development_mfa_events(kind,email,details) VALUES('configure',v_email,jsonb_build_object('enabled',p_enabled,'reason',btrim(p_reason)));
END; $$;
REVOKE ALL ON FUNCTION public.development_mfa_session_id(),public.development_mfa_allowed(),public.development_mfa_active(),public.identity_access_assured(),
 public.development_mfa_status(),public.begin_development_mfa_session(),public.end_development_mfa_session(),public.configure_development_mfa_bypass(TEXT,BOOLEAN,TEXT)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.development_mfa_status(),public.begin_development_mfa_session(),public.end_development_mfa_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.configure_development_mfa_bypass(TEXT,BOOLEAN,TEXT) TO service_role;

-- Extend only operational access predicates. JWT assurance, personal privacy
-- reauthentication and persistent push-device MFA evidence remain literal AAL2.
DO $$ DECLARE f TEXT;d TEXT; BEGIN
 FOREACH f IN ARRAY ARRAY['public.has_role(uuid,public.app_role)','public.cash_staff_access(uuid,uuid)','public.finance_branch_access(uuid,boolean)'] LOOP
  d:=pg_get_functiondef(f::regprocedure);
  IF position('public.identity_aal2()' IN d)=0 THEN RAISE EXCEPTION 'Access predicate drift: %',f; END IF;
  EXECUTE replace(d,'public.identity_aal2()','public.identity_access_assured()');
 END LOOP;
END; $$;

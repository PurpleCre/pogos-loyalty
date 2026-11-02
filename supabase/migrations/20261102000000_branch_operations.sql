-- Operational pauses do not grant launch, pricing, cashier or reward approval.
ALTER TABLE public.cash_order_settings
  ADD COLUMN intake_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN operations_version INTEGER NOT NULL DEFAULT 0 CHECK (operations_version >= 0);

CREATE TABLE public.branch_menu_availability (
  store_id UUID NOT NULL REFERENCES public.stores(id),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id),
  available BOOLEAN NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  PRIMARY KEY (store_id, menu_item_id)
);
CREATE TABLE public.branch_operation_commands (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  action TEXT NOT NULL CHECK (action IN ('intake','availability')),
  menu_item_id UUID REFERENCES public.menu_items(id),
  expected_version INTEGER NOT NULL,
  request JSONB NOT NULL,
  result JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX branch_commands_history_idx ON public.branch_operation_commands(store_id,created_at DESC,id DESC);
CREATE INDEX cash_pending_branch_idx ON public.orders(store_id,created_at) WHERE status='pending' AND quote_id IS NOT NULL;
CREATE TRIGGER immutable_branch_commands BEFORE UPDATE OR DELETE ON public.branch_operation_commands
  FOR EACH ROW EXECUTE FUNCTION public.protect_identity_audit();
ALTER TABLE public.branch_menu_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_operation_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.branch_menu_availability,public.branch_operation_commands FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.branch_menu_availability TO anon,authenticated;
CREATE POLICY "Read branch availability" ON public.branch_menu_availability FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Privacy account boundary" ON public.branch_menu_availability AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.privacy_account_live()) WITH CHECK (public.privacy_account_live());

CREATE FUNCTION public.get_branch_operations(p_store_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_settings public.cash_order_settings%ROWTYPE; v_pending JSONB;
BEGIN
  IF NOT public.cash_staff_access(p_store_id,auth.uid()) THEN RAISE EXCEPTION 'Branch access with MFA required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_settings FROM public.cash_order_settings WHERE store_id=p_store_id;
  SELECT jsonb_build_object('count',count(*),'signal',md5(coalesce(string_agg(id::text,',' ORDER BY id),'')),
    'earliest_deadline',min(acceptance_deadline),'overdue_count',count(*) FILTER (WHERE acceptance_deadline<=clock_timestamp()))
    INTO v_pending FROM public.orders WHERE store_id=p_store_id AND status='pending' AND quote_id IS NOT NULL;
  RETURN jsonb_build_object('store_id',p_store_id,'configured',v_settings.store_id IS NOT NULL,
    'enabled',coalesce(v_settings.enabled,false),'pricing_approved',coalesce(v_settings.pricing_approved,false),
    'fulfilment_enabled',coalesce(v_settings.fulfilment_enabled,false),'branch_open',coalesce((SELECT is_open FROM public.stores WHERE id=p_store_id),false),
    'paused',coalesce(v_settings.intake_paused,true),'version',coalesce(v_settings.operations_version,0),
    'currency',v_settings.currency,'pending',v_pending,'server_time',clock_timestamp());
END; $$;

CREATE FUNCTION public.list_branch_menu(p_store_id UUID,p_after UUID DEFAULT NULL,p_limit INTEGER DEFAULT 100) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows JSONB; v_more BOOLEAN; v_next UUID;
BEGIN
  IF NOT public.cash_staff_access(p_store_id,auth.uid()) THEN RAISE EXCEPTION 'Branch access with MFA required' USING ERRCODE='42501'; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid page size' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY id),'[]'::jsonb) INTO v_rows FROM (
    SELECT m.id,m.name,c.name AS category,m.price::text AS price,
      (m.is_available AND c.is_active) AS base_available,coalesce(a.available,true) AS branch_available,coalesce(a.version,0) AS version
    FROM public.menu_items m JOIN public.menu_categories c ON c.id=m.category_id
    LEFT JOIN public.branch_menu_availability a ON a.store_id=p_store_id AND a.menu_item_id=m.id
    WHERE (m.store_id IS NULL OR m.store_id=p_store_id) AND (p_after IS NULL OR m.id>p_after)
    ORDER BY m.id LIMIT p_limit+1
  ) page;
  v_more:=jsonb_array_length(v_rows)>p_limit;
  IF v_more THEN v_rows:=v_rows-p_limit; v_next:=(v_rows->(p_limit-1)->>'id')::uuid; END IF;
  RETURN jsonb_build_object('store_id',p_store_id,'items',v_rows,'next_after',v_next);
END; $$;

CREATE FUNCTION public.operate_branch(p_id UUID,p_store_id UUID,p_expected_version INTEGER,p_action TEXT,
  p_value BOOLEAN,p_reason TEXT,p_menu_item_id UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old public.branch_operation_commands%ROWTYPE; v_request JSONB; v_version INTEGER; v_result JSONB;
BEGIN
  PERFORM public.privacy_assert_account_available();
  IF NOT public.cash_staff_access(p_store_id,auth.uid()) THEN RAISE EXCEPTION 'Branch access with MFA required' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL OR p_store_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_value IS NULL OR
    p_action IS NULL OR p_action NOT IN ('intake','availability') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 300 OR
    (p_action='intake' AND p_menu_item_id IS NOT NULL) OR (p_action='availability' AND p_menu_item_id IS NULL)
    THEN RAISE EXCEPTION 'Provide a valid branch action, version and reason' USING ERRCODE='22023'; END IF;
  v_request:=jsonb_build_object('store',p_store_id,'version',p_expected_version,'action',p_action,'value',p_value,'reason',btrim(p_reason),'item',p_menu_item_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('branch-command:'||p_id,0));
  SELECT * INTO v_old FROM public.branch_operation_commands WHERE id=p_id;
  IF FOUND THEN
    IF v_old.actor_id<>auth.uid() OR v_old.request<>v_request THEN RAISE EXCEPTION 'Command reference already used' USING ERRCODE='22023'; END IF;
    RETURN v_old.result;
  END IF;
  -- Quote/submit take the shared side of this lock, including absent overrides.
  PERFORM pg_advisory_xact_lock(hashtextextended('branch-operations:'||p_store_id,0));
  IF p_action='intake' THEN
    SELECT operations_version INTO v_version FROM public.cash_order_settings WHERE store_id=p_store_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Branch configuration needs administrator approval' USING ERRCODE='22023'; END IF;
    IF v_version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Branch settings changed; refresh before retrying' USING ERRCODE='40001'; END IF;
    UPDATE public.cash_order_settings SET intake_paused=p_value,operations_version=operations_version+1 WHERE store_id=p_store_id RETURNING operations_version INTO v_version;
  ELSE
    PERFORM 1 FROM public.menu_items WHERE id=p_menu_item_id AND (store_id IS NULL OR store_id=p_store_id) FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item is unavailable in this branch' USING ERRCODE='22023'; END IF;
    SELECT version INTO v_version FROM public.branch_menu_availability WHERE store_id=p_store_id AND menu_item_id=p_menu_item_id FOR UPDATE;
    v_version:=coalesce(v_version,0);
    IF v_version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Item availability changed; refresh before retrying' USING ERRCODE='40001'; END IF;
    INSERT INTO public.branch_menu_availability(store_id,menu_item_id,available,version) VALUES(p_store_id,p_menu_item_id,p_value,v_version+1)
      ON CONFLICT (store_id,menu_item_id) DO UPDATE SET available=EXCLUDED.available,version=EXCLUDED.version;
    v_version:=v_version+1;
  END IF;
  v_result:=jsonb_build_object('command_id',p_id,'store_id',p_store_id,'action',p_action,'menu_item_id',p_menu_item_id,'value',p_value,'version',v_version);
  INSERT INTO public.branch_operation_commands(id,actor_id,store_id,action,menu_item_id,expected_version,request,result,reason)
    VALUES(p_id,auth.uid(),p_store_id,p_action,p_menu_item_id,p_expected_version,v_request,v_result,btrim(p_reason));
  RETURN v_result;
END; $$;

CREATE FUNCTION public.branch_operations_history(p_store_id UUID,p_before TIMESTAMPTZ DEFAULT NULL,p_before_id UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF NOT public.cash_staff_access(p_store_id,auth.uid()) THEN RAISE EXCEPTION 'Branch access with MFA required' USING ERRCODE='42501'; END IF;
  IF (p_before IS NULL)<>(p_before_id IS NULL) THEN RAISE EXCEPTION 'Supply both history cursor fields' USING ERRCODE='22023'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id DESC),'[]'::jsonb) FROM (
    SELECT id,action,menu_item_id,reason,result->'value' AS value,result->'version' AS version,created_at,actor_id=auth.uid() AS was_actor
    FROM public.branch_operation_commands WHERE store_id=p_store_id AND (p_before IS NULL OR (created_at,id)<(p_before,p_before_id))
    ORDER BY created_at DESC,id DESC LIMIT 50) page);
END; $$;

-- Keep existing private-account, idempotent recovery and pricing behavior. Apply
-- narrowly checked edits to the current definitions, including earlier overlays.
DO $$ DECLARE v_signature TEXT; v_definition TEXT; v_old TEXT; v_new TEXT; v_store TEXT; BEGIN
  -- The public quote wrapper must take the branch lock before its settings row
  -- lock, matching the command lock order and avoiding shared/exclusive deadlock.
  v_definition:=pg_get_functiondef('public.quote_cash_order(jsonb)'::regprocedure);
  v_old:='PERFORM 1 FROM public.cash_order_settings WHERE store_id = v_store AND fulfilment_enabled';
  IF strpos(v_definition,v_old)=0 THEN RAISE EXCEPTION 'Public quote lock overlay missing'; END IF;
  EXECUTE replace(v_definition,v_old,'PERFORM pg_advisory_xact_lock_shared(hashtextextended(''branch-operations:''||v_store,0)); '||v_old);
  FOREACH v_signature IN ARRAY ARRAY['public.quote_cash_order_internal(jsonb)','public.place_cash_order(uuid,uuid)'] LOOP
    v_definition:=pg_get_functiondef(v_signature::regprocedure);
    v_store:=CASE WHEN v_signature LIKE '%quote_cash%' THEN 'v_store' ELSE 'v_quote.store_id' END;
    v_old:='SELECT * INTO v_settings FROM public.cash_order_settings WHERE store_id = '||v_store||' FOR SHARE;';
    IF strpos(v_definition,v_old)=0 THEN RAISE EXCEPTION 'Branch settings lock overlay missing: %',v_signature; END IF;
    v_new:='PERFORM pg_advisory_xact_lock_shared(hashtextextended(''branch-operations:''||'||v_store||',0)); '||v_old;
    v_definition:=replace(v_definition,v_old,v_new);
    v_old:='NOT v_settings.pricing_approved';
    IF strpos(v_definition,v_old)=0 THEN RAISE EXCEPTION 'Branch intake overlay missing: %',v_signature; END IF;
    v_definition:=replace(v_definition,v_old,v_old||' OR v_settings.intake_paused');
    v_old:='AND (m.store_id IS NULL OR m.store_id = '||v_store||')';
    IF strpos(v_definition,v_old)=0 THEN RAISE EXCEPTION 'Branch stock overlay missing: %',v_signature; END IF;
    v_definition:=replace(v_definition,v_old,v_old||' AND NOT EXISTS (SELECT 1 FROM public.branch_menu_availability a WHERE a.store_id='||v_store||' AND a.menu_item_id=m.id AND NOT a.available)');
    EXECUTE v_definition;
  END LOOP;
END; $$;

-- Include the actor's new audit data in the bounded self-service export, without
-- another operator's identity, arbitrary internal notes or command payloads.
DO $$ DECLARE v_definition TEXT; v_old TEXT:='WHEN ''access_history'' THEN'; BEGIN
  v_definition:=pg_get_functiondef('public.privacy_export_rows(uuid,text,uuid,timestamptz,integer)'::regprocedure);
  IF strpos(v_definition,v_old)=0 THEN RAISE EXCEPTION 'Privacy export overlay missing'; END IF;
  v_definition:=replace(v_definition,v_old,$patch$WHEN 'branch_operations' THEN $q$SELECT id,created_at,jsonb_build_object('id',id,'store_id',store_id,'action',action,'menu_item_id',menu_item_id,'version',result->'version','value',result->'value','created_at',created_at) AS data FROM public.branch_operation_commands WHERE actor_id=$1$q$
    WHEN 'access_history' THEN$patch$);
  EXECUTE v_definition;
  v_definition:=pg_get_functiondef('public.privacy_export_sections()'::regprocedure);
  IF strpos(v_definition,'''privacy_requests''')=0 THEN RAISE EXCEPTION 'Privacy sections overlay missing'; END IF;
  EXECUTE replace(v_definition,'''privacy_requests''','''privacy_requests'',''branch_operations''');
END; $$;

REVOKE ALL ON FUNCTION public.get_branch_operations(UUID),public.list_branch_menu(UUID,UUID,INTEGER),
  public.operate_branch(UUID,UUID,INTEGER,TEXT,BOOLEAN,TEXT,UUID),public.branch_operations_history(UUID,TIMESTAMPTZ,UUID) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_branch_operations(UUID),public.list_branch_menu(UUID,UUID,INTEGER),
  public.operate_branch(UUID,UUID,INTEGER,TEXT,BOOLEAN,TEXT,UUID),public.branch_operations_history(UUID,TIMESTAMPTZ,UUID) TO authenticated;

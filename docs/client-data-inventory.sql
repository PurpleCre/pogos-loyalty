-- Run only with authorised read-only access against a representative clone or
-- the explicitly identified project. Save output in restricted client storage.
-- No customer contacts, addresses, tokens, raw payloads or staff email lists.
-- Historical demo rows are evidence to classify, never deletion instructions.
BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name,
       current_setting('server_version') AS server_version,
       to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS migration_history_present;

SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
       pg_get_userbyid(c.relowner) AS owner_name
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;

SELECT tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;

SELECT table_name,grantee,privilege_type
FROM information_schema.table_privileges
WHERE table_schema='public' ORDER BY table_name,grantee,privilege_type;
SELECT table_name,column_name,grantee,privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public' ORDER BY table_name,column_name,grantee,privilege_type;

SELECT id,name,address,latitude,longitude,is_open FROM public.stores ORDER BY id;
SELECT id,name,is_active,sort_order FROM public.menu_categories ORDER BY id;
SELECT id,store_id,category_id,name,((price*100)::bigint)::text AS price_minor,
       image_url,is_available FROM public.menu_items ORDER BY id;
SELECT id,menu_item_id,name,is_required,max_choices,sort_order FROM public.menu_item_options ORDER BY id;
SELECT id,option_id,name,((price_adjustment*100)::bigint)::text AS price_adjustment_minor,
       is_default,sort_order FROM public.menu_item_option_choices ORDER BY id;
SELECT * FROM public.cash_order_settings ORDER BY store_id;
SELECT id,store_id,name,boundary::text,fee_minor::text,priority,active FROM public.cash_delivery_zones ORDER BY id;
SELECT id,store_id,currency,basis,spend_unit_minor::text,points_per_unit,max_points,effective_from,active
FROM public.cash_loyalty_rules ORDER BY id;
SELECT store_id,enabled,terms_approved,max_active_per_customer FROM public.reward_branch_settings ORDER BY store_id;
SELECT id,store_id,reward_id,name,points_cost,reservation_minutes,available_units::text,enabled
FROM public.reward_branch_offers ORDER BY id;

SELECT role,count(*)::text AS role_rows FROM public.user_roles GROUP BY role ORDER BY role;
SELECT store_id,count(*) FILTER(WHERE active)::text AS active_memberships
FROM public.staff_memberships GROUP BY store_id ORDER BY store_id;
SELECT store_id,count(*) FILTER(WHERE active)::text AS approved_cashiers
FROM public.cash_branch_cashiers GROUP BY store_id ORDER BY store_id;
SELECT count(*)::text AS accounts,
       coalesce(sum(opening_balance),0)::text AS historical_opening_spendable,
       coalesce(sum(balance),0)::text AS current_spendable,
       coalesce(sum(reserved_points),0)::text AS current_held,
       count(*) FILTER(WHERE NOT opening_reviewed)::text AS unreviewed_openings
FROM public.loyalty_accounts;
SELECT store_id,currency,count(*)::text AS unsettled_receipts,coalesce(sum(amount_minor),0)::text AS outstanding_minor
FROM public.cash_receipts WHERE settled_at IS NULL GROUP BY store_id,currency ORDER BY store_id,currency;

ROLLBACK;

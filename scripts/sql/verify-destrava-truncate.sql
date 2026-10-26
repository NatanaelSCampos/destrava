BEGIN TRANSACTION READ ONLY;
-- Read-only acceptance checks for F2-ACL. A failed assertion raises an error.
-- No TRUNCATE is attempted; positive Storage privileges are reported separately.
SET LOCAL statement_timeout = '20s';
DO $verify$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relkind IN ('r','p') AND c.relowner='postgres'::regrole;
  IF n<>36 THEN RAISE EXCEPTION 'F2_ACL_UNEXPECTED_DOMAIN_TABLE_COUNT: %',n; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relkind IN ('r','p') AND c.relowner='postgres'::regrole
      AND pg_catalog.has_table_privilege('anon',c.oid,'TRUNCATE'))
    THEN RAISE EXCEPTION 'F2_ACL_TRUNCATE_ANON'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relkind IN ('r','p') AND c.relowner='postgres'::regrole
      AND pg_catalog.has_table_privilege('authenticated',c.oid,'TRUNCATE'))
    THEN RAISE EXCEPTION 'F2_ACL_TRUNCATE_AUTHENTICATED'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
    WHERE ns.nspname='public' AND c.relkind IN ('r','p') AND c.relowner='postgres'::regrole
      AND a.grantee=0 AND a.privilege_type='TRUNCATE')
    THEN RAISE EXCEPTION 'F2_ACL_TRUNCATE_PUBLIC'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a WHERE d.defaclrole='postgres'::regrole AND d.defaclobjtype='r' AND d.defaclnamespace=0 AND a.privilege_type='TRUNCATE' AND CASE WHEN a.grantee=0 THEN true ELSE pg_catalog.pg_has_role('anon',a.grantee,'USAGE') OR pg_catalog.pg_has_role('authenticated',a.grantee,'USAGE') END) THEN RAISE EXCEPTION 'F2_ACL_GLOBAL_DEFAULT'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a WHERE d.defaclrole='postgres'::regrole AND d.defaclobjtype='r' AND d.defaclnamespace='public'::regnamespace AND a.privilege_type='TRUNCATE' AND CASE WHEN a.grantee=0 THEN true ELSE pg_catalog.pg_has_role('anon',a.grantee,'USAGE') OR pg_catalog.pg_has_role('authenticated',a.grantee,'USAGE') END) THEN RAISE EXCEPTION 'F2_ACL_SCHEMA_DEFAULT'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname IN ('public','destrava_private') AND c.relkind IN ('r','p') AND NOT c.relrowsecurity)
    THEN RAISE EXCEPTION 'F2_ACL_RLS_DISABLED'; END IF;
  IF pg_catalog.has_table_privilege('authenticated','public.interactive_lesson_sessions','INSERT,UPDATE,DELETE')
    OR pg_catalog.has_table_privilege('anon','public.interactive_lesson_sessions','INSERT,UPDATE,DELETE')
    OR pg_catalog.has_table_privilege('authenticated','public.interactive_lesson_receipts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
    OR NOT pg_catalog.has_table_privilege('service_role','public.interactive_lesson_receipts','SELECT')
    THEN RAISE EXCEPTION 'F2_ACL_B1_PRIVILEGE_REGRESSION'; END IF;
  RAISE NOTICE 'F2_ACL: 8 assertion groups passed';
END
$verify$;
ROLLBACK;

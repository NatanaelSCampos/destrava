-- F2-ACL: domain tables only. Storage and other creators are managed separately.
-- Fail closed on an unexpected executor, owner, or global default grant.
-- The migration runner supplies one transaction, including its history receipt.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog;

DO $preflight$
DECLARE
  expected constant text[] := ARRAY['activities','activity_answers','activity_options','ai_feedback','ai_requests','assessment_attempts','assessment_items','assessments','courses','exercise_attempts','interactive_lesson_receipts','interactive_lesson_sessions','lesson_progress','lessons','mistakes','profiles','review_schedules','reviews','skill_progress','speaking_submissions','study_events','study_session_activities','study_sessions','trusted_devices','trusted_sessions','unit_progress','units','user_activity_progress','user_course_profiles','user_course_state','user_feature_announcements','user_review_targets','user_study_state','user_vocabulary','vocabulary_items','writing_submissions']::text[];
  target text;
  relation oid;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'F2_ACL_EXECUTOR_REQUIRED'; END IF;
  FOREACH target IN ARRAY expected LOOP
    relation := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(target));
    IF relation IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      WHERE c.oid=relation AND c.relkind IN ('r','p')
        AND c.relowner=current_user::regrole
    ) THEN RAISE EXCEPTION 'F2_ACL_OWNER_REQUIRED: %', target; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a WHERE d.defaclrole='postgres'::regrole AND d.defaclobjtype='r' AND d.defaclnamespace=0 AND a.privilege_type='TRUNCATE' AND CASE WHEN a.grantee=0 THEN true ELSE pg_catalog.pg_has_role('anon',a.grantee,'USAGE') OR pg_catalog.pg_has_role('authenticated',a.grantee,'USAGE') END) THEN
    RAISE EXCEPTION 'F2_ACL_GLOBAL_DEFAULT_REQUIRES_DECISION';
  END IF;
END
$preflight$;

REVOKE TRUNCATE ON TABLE
  public.activities,
  public.activity_answers,
  public.activity_options,
  public.ai_feedback,
  public.ai_requests,
  public.assessment_attempts,
  public.assessment_items,
  public.assessments,
  public.courses,
  public.exercise_attempts,
  public.interactive_lesson_receipts,
  public.interactive_lesson_sessions,
  public.lesson_progress,
  public.lessons,
  public.mistakes,
  public.profiles,
  public.review_schedules,
  public.reviews,
  public.skill_progress,
  public.speaking_submissions,
  public.study_events,
  public.study_session_activities,
  public.study_sessions,
  public.trusted_devices,
  public.trusted_sessions,
  public.unit_progress,
  public.units,
  public.user_activity_progress,
  public.user_course_profiles,
  public.user_course_state,
  public.user_feature_announcements,
  public.user_review_targets,
  public.user_study_state,
  public.user_vocabulary,
  public.vocabulary_items,
  public.writing_submissions
FROM PUBLIC, anon, authenticated RESTRICT;

-- Per-schema defaults cannot cancel a global grant; the preflight rejects one.
-- Preserve default privileges of all other creators and all other schemas.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM PUBLIC, anon, authenticated RESTRICT;

DO $postflight$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['activities','activity_answers','activity_options','ai_feedback','ai_requests','assessment_attempts','assessment_items','assessments','courses','exercise_attempts','interactive_lesson_receipts','interactive_lesson_sessions','lesson_progress','lessons','mistakes','profiles','review_schedules','reviews','skill_progress','speaking_submissions','study_events','study_session_activities','study_sessions','trusted_devices','trusted_sessions','unit_progress','units','user_activity_progress','user_course_profiles','user_course_state','user_feature_announcements','user_review_targets','user_study_state','user_vocabulary','vocabulary_items','writing_submissions']::text[] LOOP
    IF pg_catalog.has_table_privilege('anon', 'public.'||pg_catalog.quote_ident(target),'TRUNCATE')
       OR pg_catalog.has_table_privilege('authenticated', 'public.'||pg_catalog.quote_ident(target),'TRUNCATE')
    THEN RAISE EXCEPTION 'F2_ACL_EFFECTIVE_PRIVILEGE_REMAINS: %', target; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a WHERE d.defaclrole='postgres'::regrole AND d.defaclobjtype='r' AND d.defaclnamespace=0 AND a.privilege_type='TRUNCATE' AND CASE WHEN a.grantee=0 THEN true ELSE pg_catalog.pg_has_role('anon',a.grantee,'USAGE') OR pg_catalog.pg_has_role('authenticated',a.grantee,'USAGE') END) OR EXISTS (SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a WHERE d.defaclrole='postgres'::regrole AND d.defaclobjtype='r' AND d.defaclnamespace='public'::regnamespace AND a.privilege_type='TRUNCATE' AND CASE WHEN a.grantee=0 THEN true ELSE pg_catalog.pg_has_role('anon',a.grantee,'USAGE') OR pg_catalog.pg_has_role('authenticated',a.grantee,'USAGE') END) THEN
    RAISE EXCEPTION 'F2_ACL_UNSAFE_DEFAULT_REMAINS';
  END IF;
END
$postflight$;

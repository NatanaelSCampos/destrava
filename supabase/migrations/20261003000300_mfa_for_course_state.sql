-- Match the existing MFA gate on the older user_study_state and review tables.
create policy user_course_state_mfa on public.user_course_state
  as restrictive for all to authenticated
  using ((select public.mfa_access_allowed()))
  with check ((select public.mfa_access_allowed()));

create policy user_review_targets_mfa on public.user_review_targets
  as restrictive for all to authenticated
  using ((select public.mfa_access_allowed()))
  with check ((select public.mfa_access_allowed()));

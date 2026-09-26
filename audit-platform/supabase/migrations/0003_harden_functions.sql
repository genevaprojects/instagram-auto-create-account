-- Pin search_path on invoker functions
alter function public.audit_log_immutable() set search_path = public;
alter function public._audit_hash(text, timestamptz, uuid, text, text, text, uuid, jsonb) set search_path = public;
alter function public.block_locked_engagement() set search_path = public;
alter function public.guard_engagement_update() set search_path = public;
alter function public.guard_document_update() set search_path = public;

-- Trigger functions are never called over the API
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.enforce_staff_allowlist() from public, anon, authenticated;
revoke all on function public.handle_new_staff_user() from public, anon, authenticated;
revoke all on function public.guard_profile_update() from public, anon, authenticated;
revoke all on function public.guard_signoff_insert() from public, anon, authenticated;
revoke all on function public.lock_on_partner_signoff() from public, anon, authenticated;
revoke all on function public.audit_log_immutable() from public, anon, authenticated;
revoke all on function public.block_locked_engagement() from public, anon, authenticated;
revoke all on function public.guard_engagement_update() from public, anon, authenticated;
revoke all on function public.guard_document_update() from public, anon, authenticated;
revoke all on function public._audit_hash(text, timestamptz, uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;

-- RLS helpers and staff RPCs: signed-in staff only, never anonymous
revoke all on function public.is_active_staff() from public, anon;
revoke all on function public.has_role(public.staff_role[]) from public, anon;
revoke all on function public.engagement_is_locked(uuid) from public, anon;
revoke all on function public.verify_audit_chain() from public, anon;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.has_role(public.staff_role[]) to authenticated;
grant execute on function public.engagement_is_locked(uuid) to authenticated;
grant execute on function public.verify_audit_chain() to authenticated;

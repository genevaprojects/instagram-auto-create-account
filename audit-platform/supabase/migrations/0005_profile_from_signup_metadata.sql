-- Use the name and initials typed at sign-up when the partner did not pre-fill them on the staff list
create or replace function public.handle_new_staff_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.staff_allowlist;
begin
  select * into a from public.staff_allowlist where email = lower(new.email);
  insert into public.profiles (id, email, full_name, initials, role)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(a.full_name, ''), nullif(trim(new.raw_user_meta_data->>'full_name'), ''), ''),
    upper(coalesce(nullif(a.initials, ''), nullif(trim(new.raw_user_meta_data->>'initials'), ''), '')),
    coalesce(a.role, 'associate')
  );
  return new;
end $$;
revoke all on function public.handle_new_staff_user() from public, anon, authenticated;

-- Bootstrap: the firm owner is the first person allowed to sign up.
-- Applied to the live project with the owner's email; it is withheld here because this repository is public.
-- Further staff are added from the Staff screen by a partner or administrator.
insert into public.staff_allowlist (email, full_name, initials, role)
values (lower('owner@example.com'), null, null, 'partner')
on conflict (email) do nothing;

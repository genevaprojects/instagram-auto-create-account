-- Training centre: knowledge-check results per staff member (append-only, audited)
create table public.training_records (
  id              uuid primary key default gen_random_uuid(),
  staff_id        uuid not null references public.profiles(id) default auth.uid(),
  module_id       text not null,
  module_version  integer not null,
  score           integer not null,
  total           integer not null,
  passed          boolean not null,
  completed_at    timestamptz not null default now()
);
create index training_records_staff_idx on public.training_records (staff_id, module_id, completed_at desc);
alter table public.training_records enable row level security;

create policy "own or supervisors read training" on public.training_records for select to authenticated
  using (public.is_active_staff() and (staff_id = auth.uid() or public.has_role(array['admin','partner','manager']::public.staff_role[])));
create policy "record own training" on public.training_records for insert to authenticated
  with check (public.is_active_staff() and staff_id = auth.uid());

create trigger audit_training_records after insert on public.training_records
  for each row execute function public.audit_row_change();

-- =====================================================================
-- AuditFlow core schema: staff gate, engagements, documents with sign-off,
-- AI pipeline outputs, adjustments, working papers, review points,
-- sign-offs and a tamper-evident (hash-chained) audit trail.
-- Amount convention everywhere: Debit = positive, Credit = negative.
-- =====================================================================

create type public.staff_role as enum ('admin', 'partner', 'manager', 'senior', 'associate');
create type public.staff_status as enum ('active', 'suspended');

-- ---------------------------------------------------------------------
-- Staff gate: only emails on this list can create an account.
-- ---------------------------------------------------------------------
create table public.staff_allowlist (
  email       text primary key check (email = lower(email)),
  full_name   text,
  initials    text,
  role        public.staff_role not null default 'associate',
  added_by    uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete restrict,
  email          text not null unique,
  full_name      text not null default '',
  initials       text not null default '',
  role           public.staff_role not null default 'associate',
  status         public.staff_status not null default 'active',
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);

-- ---------------------------------------------------------------------
-- Helper predicates used by RLS
-- ---------------------------------------------------------------------
create or replace function public.is_active_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.staff_allowlist a on a.email = p.email and a.revoked_at is null
    where p.id = auth.uid() and p.status = 'active'
  );
$$;

create or replace function public.has_role(roles public.staff_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_staff() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = any(roles)
  );
$$;

-- ---------------------------------------------------------------------
-- Tamper-evident audit trail (append only, SHA-256 hash chain)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default clock_timestamp(),
  actor_id       uuid,
  actor_email    text,
  actor_name     text,
  action         text not null,
  entity_type    text,
  entity_id      text,
  engagement_id  uuid,
  details        jsonb not null default '{}'::jsonb,
  ip             text,
  user_agent     text,
  prev_hash      text,
  hash           text not null
);
create index audit_log_engagement_idx on public.audit_log (engagement_id, id desc);
create index audit_log_actor_idx on public.audit_log (actor_id, id desc);

create or replace function public._audit_hash(
  p_prev text, p_at timestamptz, p_actor uuid, p_action text,
  p_entity_type text, p_entity_id text, p_engagement uuid, p_details jsonb
) returns text language sql immutable as $$
  select encode(sha256(convert_to(
    coalesce(p_prev, 'GENESIS') || '|' ||
    to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' ||
    coalesce(p_actor::text, 'system') || '|' || p_action || '|' ||
    coalesce(p_entity_type, '') || '|' || coalesce(p_entity_id, '') || '|' ||
    coalesce(p_engagement::text, '') || '|' || coalesce(p_details::text, '{}'),
  'UTF8')), 'hex');
$$;

create or replace function public._audit_insert(
  p_action text, p_entity_type text, p_entity_id text, p_engagement uuid,
  p_details jsonb, p_ip text default null, p_ua text default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_prev text; v_actor uuid := auth.uid(); v_email text; v_name text;
  v_at timestamptz := clock_timestamp(); v_id bigint;
begin
  perform pg_advisory_xact_lock(424242);
  select hash into v_prev from public.audit_log order by id desc limit 1;
  select email, full_name into v_email, v_name from public.profiles where id = v_actor;
  insert into public.audit_log (at, actor_id, actor_email, actor_name, action, entity_type,
    entity_id, engagement_id, details, ip, user_agent, prev_hash, hash)
  values (v_at, v_actor, v_email, v_name, p_action, p_entity_type, p_entity_id, p_engagement,
    coalesce(p_details, '{}'::jsonb), p_ip, p_ua, v_prev,
    public._audit_hash(v_prev, v_at, v_actor, p_action, p_entity_type, p_entity_id, p_engagement, coalesce(p_details, '{}'::jsonb)))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public._audit_insert(text, text, text, uuid, jsonb, text, text) from public, anon, authenticated;

-- Public entry point for explicit events (logins, downloads, AI runs, views)
create or replace function public.log_event(
  p_action text, p_entity_type text default null, p_entity_id text default null,
  p_engagement uuid default null, p_details jsonb default '{}'::jsonb,
  p_ip text default null, p_ua text default null
) returns bigint language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_staff() then
    raise exception 'Not an active staff member';
  end if;
  return public._audit_insert(p_action, p_entity_type, p_entity_id, p_engagement, p_details, p_ip, p_ua);
end $$;
revoke all on function public.log_event(text, text, text, uuid, jsonb, text, text) from public, anon;
grant execute on function public.log_event(text, text, text, uuid, jsonb, text, text) to authenticated;

-- Recompute the chain; returns the first id whose hash does not verify (null = intact)
create or replace function public.verify_audit_chain()
returns table (checked bigint, first_broken_id bigint) language plpgsql stable security definer set search_path = public as $$
declare r record; v_prev text := null; v_n bigint := 0;
begin
  if not public.is_active_staff() then raise exception 'Not an active staff member'; end if;
  for r in select * from public.audit_log order by id loop
    v_n := v_n + 1;
    if r.prev_hash is distinct from v_prev or r.hash <> public._audit_hash(v_prev, r.at, r.actor_id, r.action,
         r.entity_type, r.entity_id, r.engagement_id, r.details) then
      checked := v_n; first_broken_id := r.id; return next; return;
    end if;
    v_prev := r.hash;
  end loop;
  checked := v_n; first_broken_id := null; return next;
end $$;
grant execute on function public.verify_audit_chain() to authenticated;

create or replace function public.audit_log_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'The audit trail is append-only; % is not permitted', tg_op;
end $$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_log_immutable();

-- Generic row-change trigger: every insert/update/delete on business tables is logged
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb := '{}'::jsonb; k text;
  v_eng uuid;
begin
  v_eng := coalesce(
    nullif(v_row->>'engagement_id', '')::uuid,
    case when tg_table_name = 'engagements' then (v_row->>'id')::uuid end
  );
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if (v_new->k) is distinct from (v_old->k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', v_old->k, 'to', v_new->k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then return new; end if;
  end if;
  perform public._audit_insert(
    tg_table_name || '.' || lower(tg_op), tg_table_name, coalesce(v_row->>'id', v_row->>'email'), v_eng,
    case tg_op when 'INSERT' then jsonb_build_object('row', v_new)
               when 'UPDATE' then jsonb_build_object('changes', v_changes)
               else jsonb_build_object('row', v_old) end,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent');
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- Signup gate on auth.users
-- ---------------------------------------------------------------------
create or replace function public.enforce_staff_allowlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.staff_allowlist a
                 where a.email = lower(new.email) and a.revoked_at is null) then
    raise exception 'STAFF_NOT_AUTHORISED: % is not on the firm staff list', new.email;
  end if;
  return new;
end $$;
create trigger enforce_staff_allowlist before insert on auth.users
  for each row execute function public.enforce_staff_allowlist();

create or replace function public.handle_new_staff_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.staff_allowlist;
begin
  select * into a from public.staff_allowlist where email = lower(new.email);
  insert into public.profiles (id, email, full_name, initials, role)
  values (new.id, lower(new.email), coalesce(a.full_name, ''), coalesce(upper(a.initials), ''), coalesce(a.role, 'associate'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_staff_user();

-- Staff may edit their own name/initials only; role/status need admin or partner
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status or new.email is distinct from old.email)
     and not public.has_role(array['admin','partner']::public.staff_role[]) then
    raise exception 'Only an administrator or partner can change role, status or email';
  end if;
  if new.id = auth.uid() and new.status = 'suspended' then
    raise exception 'You cannot suspend yourself';
  end if;
  return new;
end $$;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------
-- Clients & engagements
-- ---------------------------------------------------------------------
create table public.clients (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  registration_no      text,
  principal_activity   text,
  framework            text not null default 'MPERS' check (framework in ('MPERS', 'MFRS')),
  registered_address   text,
  business_address     text,
  contact_person       text,
  contact_phone        text,
  contact_email        text,
  directors            text[] not null default '{}',
  created_by           uuid references public.profiles(id) default auth.uid(),
  created_at           timestamptz not null default now()
);

create table public.engagements (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete restrict,
  fy_start            date not null,
  fy_end              date not null check (fy_end > fy_start),
  audit_fee           numeric(14,2),
  reporting_deadline  date,
  status              text not null default 'planning'
                      check (status in ('planning', 'fieldwork', 'review', 'completed', 'locked')),
  preparer_id         uuid references public.profiles(id),
  reviewer_id         uuid references public.profiles(id),
  partner_id          uuid references public.profiles(id),
  materiality         jsonb,
  tax_computation     jsonb,
  settings            jsonb not null default '{}'::jsonb,
  created_by          uuid references public.profiles(id) default auth.uid(),
  created_at          timestamptz not null default now(),
  locked_at           timestamptz,
  unique (client_id, fy_end)
);

create or replace function public.engagement_is_locked(p_engagement uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'locked' from public.engagements where id = p_engagement), false);
$$;

create or replace function public.block_locked_engagement()
returns trigger language plpgsql as $$
declare v_eng uuid := coalesce((to_jsonb(new)->>'engagement_id')::uuid, (to_jsonb(old)->>'engagement_id')::uuid);
begin
  if public.engagement_is_locked(v_eng) then
    raise exception 'Engagement is locked after partner sign-off; changes are not permitted';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.guard_engagement_update()
returns trigger language plpgsql as $$
begin
  if old.status = 'locked' then
    raise exception 'Engagement is locked after partner sign-off; changes are not permitted';
  end if;
  return new;
end $$;
create trigger guard_engagement_update before update on public.engagements
  for each row execute function public.guard_engagement_update();

-- ---------------------------------------------------------------------
-- Documents (uploaded evidence) with staff attestation
-- ---------------------------------------------------------------------
create table public.documents (
  id                 uuid primary key default gen_random_uuid(),
  engagement_id      uuid not null references public.engagements(id) on delete restrict,
  kind               text not null check (kind in ('cy_bs', 'cy_pl', 'cy_tb', 'cy_gl', 'py_fs', 'py_awp', 'py_planning', 'supporting')),
  description        text,
  filename           text not null,
  storage_path       text not null unique,
  mime_type          text,
  size_bytes         bigint,
  sha256             text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by        uuid not null references public.profiles(id) default auth.uid(),
  uploaded_at        timestamptz not null default now(),
  status             text not null default 'awaiting_signoff' check (status in ('awaiting_signoff', 'signed', 'superseded')),
  signed_by          uuid references public.profiles(id),
  signed_name        text,
  signed_initials    text,
  signed_at          timestamptz,
  signed_ip          text,
  signed_user_agent  text,
  declaration        text,
  superseded_by      uuid references public.documents(id)
);
create index documents_engagement_idx on public.documents (engagement_id);

create or replace function public.guard_document_update()
returns trigger language plpgsql as $$
begin
  if new.storage_path is distinct from old.storage_path or new.sha256 is distinct from old.sha256
     or new.uploaded_by is distinct from old.uploaded_by or new.filename is distinct from old.filename
     or new.engagement_id is distinct from old.engagement_id then
    raise exception 'Uploaded file identity fields are immutable';
  end if;
  if old.status = 'signed' and (new.signed_by is distinct from old.signed_by or new.signed_at is distinct from old.signed_at
     or new.signed_name is distinct from old.signed_name or new.declaration is distinct from old.declaration) then
    raise exception 'A signed attestation cannot be altered';
  end if;
  if old.status = 'superseded' then
    raise exception 'A superseded document cannot be changed';
  end if;
  if new.status = 'signed' and old.status <> 'signed' and new.signed_by is distinct from auth.uid() then
    raise exception 'You can only sign an attestation as yourself';
  end if;
  return new;
end $$;
create trigger guard_document_update before update on public.documents
  for each row execute function public.guard_document_update();

-- ---------------------------------------------------------------------
-- AI pipeline outputs
-- ---------------------------------------------------------------------
create table public.pipeline_runs (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.engagements(id) on delete restrict,
  step           text not null check (step in ('extract', 'map', 'adjust', 'analyse', 'papers')),
  status         text not null default 'running' check (status in ('running', 'succeeded', 'needs_review', 'failed')),
  started_by     uuid references public.profiles(id) default auth.uid(),
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  summary        text,
  error          text,
  output         jsonb
);
create index pipeline_runs_engagement_idx on public.pipeline_runs (engagement_id, started_at desc);

create table public.extractions (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.engagements(id) on delete restrict,
  document_id    uuid not null references public.documents(id),
  run_id         uuid references public.pipeline_runs(id),
  statement      text not null,
  data           jsonb not null,
  checks         jsonb not null,
  passed         boolean not null,
  created_at     timestamptz not null default now()
);

create table public.tb_lines (
  id                   uuid primary key default gen_random_uuid(),
  engagement_id        uuid not null references public.engagements(id) on delete restrict,
  source_document_id   uuid references public.documents(id),
  line_no              integer not null,
  account_name         text not null,
  statement            text not null check (statement in ('BS', 'PL')),
  section              text not null,
  cy_amount            numeric(18,2) not null,
  py_client_amount     numeric(18,2),
  fs_caption           text,
  fs_group             text,
  wp_ref               text,
  mapping_rationale    text,
  mapping_confidence   numeric(4,3),
  mapping_flags        text[] not null default '{}',
  mapped_by            text not null default 'ai',
  verified_by          uuid references public.profiles(id),
  verified_at          timestamptz,
  created_at           timestamptz not null default now()
);
create index tb_lines_engagement_idx on public.tb_lines (engagement_id, line_no);

create table public.py_balances (
  id                   uuid primary key default gen_random_uuid(),
  engagement_id        uuid not null references public.engagements(id) on delete restrict,
  fs_caption           text not null,
  wp_ref               text,
  amount               numeric(18,2) not null,
  source_document_id   uuid references public.documents(id),
  note                 text,
  unique (engagement_id, fs_caption)
);

create table public.adjustments (
  id              uuid primary key default gen_random_uuid(),
  engagement_id   uuid not null references public.engagements(id) on delete restrict,
  ref             text not null,
  kind            text not null default 'AJE' check (kind in ('AJE', 'RJE')),
  description     text not null,
  rationale       text,
  evidence        text,
  source          text not null default 'ai' check (source in ('ai', 'staff')),
  status          text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected', 'uncorrected')),
  lines           jsonb not null,
  total           numeric(18,2) not null,
  proposed_by     uuid references public.profiles(id) default auth.uid(),
  decided_by      uuid references public.profiles(id),
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz not null default now(),
  unique (engagement_id, ref)
);

create table public.working_papers (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.engagements(id) on delete restrict,
  ref            text not null,
  title          text not null,
  content        jsonb not null default '{}'::jsonb,
  status         text not null default 'draft' check (status in ('draft', 'prepared', 'reviewed')),
  prepared_by    uuid references public.profiles(id),
  prepared_at    timestamptz,
  reviewed_by    uuid references public.profiles(id),
  reviewed_at    timestamptz,
  updated_at     timestamptz not null default now(),
  unique (engagement_id, ref)
);

create table public.review_points (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.engagements(id) on delete restrict,
  wp_ref         text,
  body           text not null,
  raised_by      uuid not null references public.profiles(id) default auth.uid(),
  raised_at      timestamptz not null default now(),
  status         text not null default 'open' check (status in ('open', 'responded', 'cleared')),
  response       text,
  responded_by   uuid references public.profiles(id),
  responded_at   timestamptz,
  cleared_by     uuid references public.profiles(id),
  cleared_at     timestamptz
);

create table public.signoffs (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.engagements(id) on delete restrict,
  stage          text not null check (stage in ('preparer', 'reviewer', 'partner')),
  signed_by      uuid not null references public.profiles(id) default auth.uid(),
  signed_name    text not null,
  initials       text not null,
  role           public.staff_role not null,
  signed_at      timestamptz not null default now(),
  ip             text,
  user_agent     text,
  statement      text not null,
  snapshot_hash  text not null,
  unique (engagement_id, stage)
);

create or replace function public.guard_signoff_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role public.staff_role;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if new.signed_by is distinct from auth.uid() then raise exception 'You can only sign as yourself'; end if;
  if new.role is distinct from v_role then raise exception 'Role on sign-off must match your profile'; end if;
  if new.stage = 'reviewer' and v_role not in ('manager', 'partner') then
    raise exception 'Reviewer sign-off requires a manager or partner';
  end if;
  if new.stage = 'partner' and v_role <> 'partner' then
    raise exception 'Partner sign-off requires a partner';
  end if;
  if new.stage = 'reviewer' and not exists (select 1 from public.signoffs where engagement_id = new.engagement_id and stage = 'preparer') then
    raise exception 'Preparer must sign off before review';
  end if;
  if new.stage = 'partner' and not exists (select 1 from public.signoffs where engagement_id = new.engagement_id and stage = 'reviewer') then
    raise exception 'Reviewer must sign off before the partner';
  end if;
  if new.stage in ('reviewer', 'partner') and exists (select 1 from public.signoffs where engagement_id = new.engagement_id and signed_by = auth.uid()) then
    raise exception 'The same person cannot sign two stages of one engagement';
  end if;
  if new.stage = 'partner' and exists (select 1 from public.review_points where engagement_id = new.engagement_id and status <> 'cleared') then
    raise exception 'All review points must be cleared before partner sign-off';
  end if;
  return new;
end $$;
create trigger guard_signoff_insert before insert on public.signoffs
  for each row execute function public.guard_signoff_insert();

create or replace function public.lock_on_partner_signoff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stage = 'partner' then
    update public.engagements set status = 'locked', locked_at = now() where id = new.engagement_id;
  end if;
  return new;
end $$;
create trigger lock_on_partner_signoff after insert on public.signoffs
  for each row execute function public.lock_on_partner_signoff();

-- Locked engagements freeze all child records
create trigger lock_documents before insert or update or delete on public.documents for each row execute function public.block_locked_engagement();
create trigger lock_tb_lines before insert or update or delete on public.tb_lines for each row execute function public.block_locked_engagement();
create trigger lock_py_balances before insert or update or delete on public.py_balances for each row execute function public.block_locked_engagement();
create trigger lock_adjustments before insert or update or delete on public.adjustments for each row execute function public.block_locked_engagement();
create trigger lock_working_papers before insert or update or delete on public.working_papers for each row execute function public.block_locked_engagement();
create trigger lock_review_points before insert or update or delete on public.review_points for each row execute function public.block_locked_engagement();
create trigger lock_pipeline_runs before insert on public.pipeline_runs for each row execute function public.block_locked_engagement();

-- Row-level audit logging on every business table
create trigger audit_staff_allowlist after insert or update or delete on public.staff_allowlist for each row execute function public.audit_row_change();
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function public.audit_row_change();
create trigger audit_clients after insert or update or delete on public.clients for each row execute function public.audit_row_change();
create trigger audit_engagements after insert or update or delete on public.engagements for each row execute function public.audit_row_change();
create trigger audit_documents after insert or update or delete on public.documents for each row execute function public.audit_row_change();
create trigger audit_pipeline_runs after insert or update on public.pipeline_runs for each row execute function public.audit_row_change();
create trigger audit_tb_lines after update or delete on public.tb_lines for each row execute function public.audit_row_change();
create trigger audit_py_balances after update or delete on public.py_balances for each row execute function public.audit_row_change();
create trigger audit_adjustments after insert or update or delete on public.adjustments for each row execute function public.audit_row_change();
create trigger audit_working_papers after insert or update or delete on public.working_papers for each row execute function public.audit_row_change();
create trigger audit_review_points after insert or update or delete on public.review_points for each row execute function public.audit_row_change();
create trigger audit_signoffs after insert on public.signoffs for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.staff_allowlist enable row level security;
alter table public.profiles        enable row level security;
alter table public.audit_log       enable row level security;
alter table public.clients         enable row level security;
alter table public.engagements     enable row level security;
alter table public.documents       enable row level security;
alter table public.pipeline_runs   enable row level security;
alter table public.extractions     enable row level security;
alter table public.tb_lines        enable row level security;
alter table public.py_balances     enable row level security;
alter table public.adjustments     enable row level security;
alter table public.working_papers  enable row level security;
alter table public.review_points   enable row level security;
alter table public.signoffs        enable row level security;

create policy "admins read allowlist" on public.staff_allowlist for select to authenticated
  using (public.has_role(array['admin','partner']::public.staff_role[]));
create policy "admins add staff" on public.staff_allowlist for insert to authenticated
  with check (public.has_role(array['admin','partner']::public.staff_role[]));
create policy "admins update staff" on public.staff_allowlist for update to authenticated
  using (public.has_role(array['admin','partner']::public.staff_role[]));

create policy "staff read profiles" on public.profiles for select to authenticated
  using (public.is_active_staff() or id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(array['admin','partner']::public.staff_role[]));

create policy "staff read audit trail" on public.audit_log for select to authenticated
  using (public.is_active_staff());

-- Business tables: active staff read/write; no hard deletes anywhere
do $$
declare t text;
begin
  foreach t in array array['clients','engagements','documents','pipeline_runs','extractions','tb_lines',
                           'py_balances','adjustments','working_papers','review_points'] loop
    execute format('create policy "staff read %1$s" on public.%1$I for select to authenticated using (public.is_active_staff())', t);
    execute format('create policy "staff insert %1$s" on public.%1$I for insert to authenticated with check (public.is_active_staff())', t);
    execute format('create policy "staff update %1$s" on public.%1$I for update to authenticated using (public.is_active_staff())', t);
  end loop;
end $$;
-- Mapping rows are re-generated when the AI mapping step is re-run (before any verification)
create policy "staff delete unverified tb lines" on public.tb_lines for delete to authenticated
  using (public.is_active_staff() and verified_by is null);
create policy "staff delete py balances" on public.py_balances for delete to authenticated
  using (public.is_active_staff());
create policy "staff delete proposed adjustments" on public.adjustments for delete to authenticated
  using (public.is_active_staff() and status = 'proposed' and source = 'ai');

create policy "staff read signoffs" on public.signoffs for select to authenticated using (public.is_active_staff());
create policy "staff sign" on public.signoffs for insert to authenticated with check (public.is_active_staff());

-- ---------------------------------------------------------------------
-- Private storage bucket: upload + read only (no overwrite, no delete)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('engagement-files', 'engagement-files', false, 52428800)
on conflict (id) do nothing;

create policy "staff read engagement files" on storage.objects for select to authenticated
  using (bucket_id = 'engagement-files' and public.is_active_staff());
create policy "staff upload engagement files" on storage.objects for insert to authenticated
  with check (bucket_id = 'engagement-files' and public.is_active_staff());

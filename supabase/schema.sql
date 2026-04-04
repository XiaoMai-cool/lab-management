-- ============================================================
-- Lab Management System - Complete SQL Schema
-- For Supabase (PostgreSQL)
-- ============================================================

-- ========================
-- ENUM TYPES
-- ========================

create type user_role as enum ('super_admin', 'admin', 'manager', 'teacher', 'student');
create type announcement_priority as enum ('normal', 'important', 'urgent');
create type reservation_status as enum ('pending', 'approved', 'rejected', 'completed');
create type purchase_status as enum ('pending', 'approved', 'purchased', 'received');
create type duty_area as enum ('lab', 'office');
create type equipment_status as enum ('normal', 'maintenance', 'broken');
create type reimbursement_status as enum ('pending', 'approved', 'rejected', 'completed');

-- ========================
-- TABLES
-- ========================

-- 1. profiles - 用户信息（扩展 auth.users）
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'student',
  managed_modules text[] default '{}',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on profiles (role);
create index idx_profiles_email on profiles (email);

-- 2. announcements - 公告
create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  priority announcement_priority not null default 'normal',
  author_id uuid not null references profiles (id) on delete cascade,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_announcements_published on announcements (published, created_at desc);
create index idx_announcements_author on announcements (author_id);

-- 3. documents - 文档资料
create table documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  content text not null,
  author_id uuid not null references profiles (id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_documents_category on documents (category);
create index idx_documents_sort on documents (sort_order);

-- 4. supply_categories - 耗材分类
create table supply_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

-- 5. supplies - 耗材库存
create table supplies (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references supply_categories (id) on delete restrict,
  name text not null,
  specification text not null default '',
  stock numeric not null default 0,
  unit text not null,
  min_stock numeric not null default 0,
  updated_at timestamptz not null default now()
);

create index idx_supplies_category on supplies (category_id);
create index idx_supplies_name on supplies (name);

-- 6. supply_reservations - 耗材预约
create table supply_reservations (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references supplies (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  quantity numeric not null,
  purpose text not null,
  is_returnable boolean not null default false,
  status reservation_status not null default 'pending',
  reviewer_id uuid references profiles (id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index idx_supply_reservations_user on supply_reservations (user_id);
create index idx_supply_reservations_supply on supply_reservations (supply_id);
create index idx_supply_reservations_status on supply_reservations (status);

-- 7. chemicals - 危化品
create table chemicals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cas_number text,
  specification text not null default '',
  stock numeric not null default 0,
  unit text not null,
  location text not null default '',
  updated_at timestamptz not null default now()
);

create index idx_chemicals_name on chemicals (name);
create index idx_chemicals_cas on chemicals (cas_number);

-- 8. chemical_usage_logs - 危化品使用记录
create table chemical_usage_logs (
  id uuid primary key default gen_random_uuid(),
  chemical_id uuid not null references chemicals (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  amount numeric not null,
  unit text not null,
  purpose text not null,
  used_at timestamptz not null default now()
);

create index idx_chemical_usage_chemical on chemical_usage_logs (chemical_id);
create index idx_chemical_usage_user on chemical_usage_logs (user_id);
create index idx_chemical_usage_date on chemical_usage_logs (used_at desc);

-- 9. chemical_purchases - 危化品采购
create table chemical_purchases (
  id uuid primary key default gen_random_uuid(),
  chemical_id uuid references chemicals (id) on delete set null,
  name text not null,
  specification text not null default '',
  quantity numeric not null,
  unit text not null,
  requester_id uuid not null references profiles (id) on delete cascade,
  status purchase_status not null default 'pending',
  approved_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_chemical_purchases_requester on chemical_purchases (requester_id);
create index idx_chemical_purchases_status on chemical_purchases (status);

-- 10. duty_roster - 值日排班
create table duty_roster (
  id uuid primary key default gen_random_uuid(),
  area duty_area not null,
  user_id uuid not null references profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create index idx_duty_roster_dates on duty_roster (start_date, end_date);
create index idx_duty_roster_user on duty_roster (user_id);

-- 11. equipment - 仪器设备
create table equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null default '',
  responsible_user_id uuid not null references profiles (id) on delete cascade,
  status equipment_status not null default 'normal',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_equipment_status on equipment (status);
create index idx_equipment_responsible on equipment (responsible_user_id);

-- 12. meetings - 组会
create table meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scheduled_at timestamptz not null,
  location text not null default '',
  notes text,
  created_at timestamptz not null default now()
);

create index idx_meetings_scheduled on meetings (scheduled_at desc);

-- 13. meeting_reports - 组会汇报 / Progress Report
create table meeting_reports (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings (id) on delete set null,
  user_id uuid not null references profiles (id) on delete cascade,
  content text not null,
  file_url text,
  submitted_at timestamptz not null default now()
);

create index idx_meeting_reports_meeting on meeting_reports (meeting_id);
create index idx_meeting_reports_user on meeting_reports (user_id);

-- 14. reimbursements - 报销申请
create table reimbursements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  amount numeric not null,
  description text not null default '',
  receipt_urls text[] default '{}',
  status reimbursement_status not null default 'pending',
  reviewer_id uuid references profiles (id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index idx_reimbursements_user on reimbursements (user_id);
create index idx_reimbursements_status on reimbursements (status);

-- 15. purchase_logs - 物资购买登记
create table purchase_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  item_name text not null,
  specification text not null default '',
  quantity numeric not null,
  unit text not null,
  purpose text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_purchase_logs_user on purchase_logs (user_id);
create index idx_purchase_logs_date on purchase_logs (created_at desc);

-- ========================
-- TRIGGER: auto-update updated_at
-- ========================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger trg_announcements_updated_at
  before update on announcements
  for each row execute function update_updated_at();

create trigger trg_documents_updated_at
  before update on documents
  for each row execute function update_updated_at();

create trigger trg_supplies_updated_at
  before update on supplies
  for each row execute function update_updated_at();

create trigger trg_chemicals_updated_at
  before update on chemicals
  for each row execute function update_updated_at();

create trigger trg_equipment_updated_at
  before update on equipment
  for each row execute function update_updated_at();

-- ========================
-- TRIGGER: auto-create profile on signup
-- ========================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ========================
-- ROW LEVEL SECURITY
-- ========================

-- Helper: check if current user has admin-level role
create or replace function is_admin_or_above()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('super_admin', 'admin')
  );
$$ language sql security definer stable;

-- Helper: check if current user manages a given module
create or replace function manages_module(module_name text)
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (
        role in ('super_admin', 'admin')
        or module_name = any(managed_modules)
      )
  );
$$ language sql security definer stable;

-- ---- profiles ----
alter table profiles enable row level security;

create policy "profiles_select" on profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on profiles
  for update to authenticated using (id = auth.uid());

create policy "profiles_update_admin" on profiles
  for update to authenticated using (is_admin_or_above());

create policy "profiles_insert_admin" on profiles
  for insert to authenticated with check (is_admin_or_above() or id = auth.uid());

-- ---- announcements ----
alter table announcements enable row level security;

create policy "announcements_select" on announcements
  for select to authenticated using (true);

create policy "announcements_insert" on announcements
  for insert to authenticated with check (manages_module('announcements') or is_admin_or_above());

create policy "announcements_update" on announcements
  for update to authenticated using (manages_module('announcements') or is_admin_or_above());

create policy "announcements_delete" on announcements
  for delete to authenticated using (manages_module('announcements') or is_admin_or_above());

-- ---- documents ----
alter table documents enable row level security;

create policy "documents_select" on documents
  for select to authenticated using (true);

create policy "documents_insert" on documents
  for insert to authenticated with check (manages_module('documents') or is_admin_or_above());

create policy "documents_update" on documents
  for update to authenticated using (manages_module('documents') or is_admin_or_above());

create policy "documents_delete" on documents
  for delete to authenticated using (manages_module('documents') or is_admin_or_above());

-- ---- supply_categories ----
alter table supply_categories enable row level security;

create policy "supply_categories_select" on supply_categories
  for select to authenticated using (true);

create policy "supply_categories_manage" on supply_categories
  for all to authenticated using (manages_module('supplies'));

-- ---- supplies ----
alter table supplies enable row level security;

create policy "supplies_select" on supplies
  for select to authenticated using (true);

create policy "supplies_insert" on supplies
  for insert to authenticated with check (manages_module('supplies'));

create policy "supplies_update" on supplies
  for update to authenticated using (manages_module('supplies'));

create policy "supplies_delete" on supplies
  for delete to authenticated using (manages_module('supplies'));

-- ---- supply_reservations ----
alter table supply_reservations enable row level security;

create policy "supply_reservations_select" on supply_reservations
  for select to authenticated using (true);

create policy "supply_reservations_insert_own" on supply_reservations
  for insert to authenticated with check (user_id = auth.uid());

create policy "supply_reservations_update_reviewer" on supply_reservations
  for update to authenticated using (manages_module('supplies'));

create policy "supply_reservations_update_own" on supply_reservations
  for update to authenticated using (user_id = auth.uid() and status = 'pending');

-- ---- chemicals ----
alter table chemicals enable row level security;

create policy "chemicals_select" on chemicals
  for select to authenticated using (true);

create policy "chemicals_insert" on chemicals
  for insert to authenticated with check (manages_module('chemicals'));

create policy "chemicals_update" on chemicals
  for update to authenticated using (manages_module('chemicals'));

create policy "chemicals_delete" on chemicals
  for delete to authenticated using (manages_module('chemicals'));

-- ---- chemical_usage_logs ----
alter table chemical_usage_logs enable row level security;

create policy "chemical_usage_select" on chemical_usage_logs
  for select to authenticated using (true);

create policy "chemical_usage_insert" on chemical_usage_logs
  for insert to authenticated with check (user_id = auth.uid());

-- ---- chemical_purchases ----
alter table chemical_purchases enable row level security;

create policy "chemical_purchases_select" on chemical_purchases
  for select to authenticated using (true);

create policy "chemical_purchases_insert" on chemical_purchases
  for insert to authenticated with check (requester_id = auth.uid());

create policy "chemical_purchases_update" on chemical_purchases
  for update to authenticated using (manages_module('chemicals'));

-- ---- duty_roster ----
alter table duty_roster enable row level security;

create policy "duty_roster_select" on duty_roster
  for select to authenticated using (true);

create policy "duty_roster_manage" on duty_roster
  for all to authenticated using (manages_module('duty') or is_admin_or_above());

-- ---- equipment ----
alter table equipment enable row level security;

create policy "equipment_select" on equipment
  for select to authenticated using (true);

create policy "equipment_insert" on equipment
  for insert to authenticated with check (manages_module('equipment') or is_admin_or_above());

create policy "equipment_update" on equipment
  for update to authenticated using (manages_module('equipment') or is_admin_or_above());

create policy "equipment_delete" on equipment
  for delete to authenticated using (manages_module('equipment') or is_admin_or_above());

-- ---- meetings ----
alter table meetings enable row level security;

create policy "meetings_select" on meetings
  for select to authenticated using (true);

create policy "meetings_insert" on meetings
  for insert to authenticated with check (manages_module('meetings') or is_admin_or_above());

create policy "meetings_update" on meetings
  for update to authenticated using (manages_module('meetings') or is_admin_or_above());

create policy "meetings_delete" on meetings
  for delete to authenticated using (manages_module('meetings') or is_admin_or_above());

-- ---- meeting_reports ----
alter table meeting_reports enable row level security;

create policy "meeting_reports_select" on meeting_reports
  for select to authenticated using (true);

create policy "meeting_reports_insert_own" on meeting_reports
  for insert to authenticated with check (user_id = auth.uid());

create policy "meeting_reports_update_own" on meeting_reports
  for update to authenticated using (user_id = auth.uid());

create policy "meeting_reports_delete_own" on meeting_reports
  for delete to authenticated using (user_id = auth.uid());

-- ---- reimbursements ----
alter table reimbursements enable row level security;

create policy "reimbursements_select_own" on reimbursements
  for select to authenticated using (user_id = auth.uid() or manages_module('reimbursements') or is_admin_or_above());

create policy "reimbursements_insert_own" on reimbursements
  for insert to authenticated with check (user_id = auth.uid());

create policy "reimbursements_update_reviewer" on reimbursements
  for update to authenticated using (manages_module('reimbursements') or is_admin_or_above());

create policy "reimbursements_update_own" on reimbursements
  for update to authenticated using (user_id = auth.uid() and status = 'pending');

-- ---- purchase_logs ----
alter table purchase_logs enable row level security;

create policy "purchase_logs_select" on purchase_logs
  for select to authenticated using (true);

create policy "purchase_logs_insert_own" on purchase_logs
  for insert to authenticated with check (user_id = auth.uid());

create policy "purchase_logs_update_own" on purchase_logs
  for update to authenticated using (user_id = auth.uid());

-- ========================
-- SEED DATA
-- ========================

insert into supply_categories (name, sort_order) values
  ('非一次性耗材', 1),
  ('玻璃器皿', 2),
  ('一次性耗材', 3),
  ('其他', 4);

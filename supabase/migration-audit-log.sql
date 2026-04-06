-- ============================================================
-- 操作日志表 (audit_log)
-- 记录关键操作，用于追踪和问题排查
-- ============================================================

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  action text not null,          -- 操作类型：approve, reject, create, update, delete, recall 等
  target_table text not null,    -- 目标表名：purchases, supply_reservations 等
  target_id uuid,                -- 目标记录 ID
  details jsonb default '{}',    -- 操作详情（如：旧状态→新状态、审批备注等）
  created_at timestamptz not null default now()
);

create index idx_audit_log_user on audit_log (user_id);
create index idx_audit_log_target on audit_log (target_table, target_id);
create index idx_audit_log_action on audit_log (action);
create index idx_audit_log_date on audit_log (created_at desc);

-- RLS: 所有登录用户可写自己的日志，管理员可查看全部
alter table audit_log enable row level security;

create policy "audit_log_insert_own" on audit_log
  for insert to authenticated with check (user_id = auth.uid());

create policy "audit_log_select_admin" on audit_log
  for select to authenticated using (is_admin_or_above());

create policy "audit_log_select_own" on audit_log
  for select to authenticated using (user_id = auth.uid());

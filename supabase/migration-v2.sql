-- ============================================================
-- V2 Migration - 实验室管理系统
-- ============================================================

-- ========================
-- 1. 药品预警表
-- ========================
CREATE TABLE IF NOT EXISTS chemical_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chemical_id uuid NOT NULL REFERENCES chemicals(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'arrived')),
  reported_at timestamptz NOT NULL DEFAULT now(),
  estimated_delivery_date date,
  arrived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chemical_warnings_chemical ON chemical_warnings(chemical_id);
CREATE INDEX IF NOT EXISTS idx_chemical_warnings_status ON chemical_warnings(status);

ALTER TABLE chemical_warnings ENABLE ROW LEVEL SECURITY;

-- 所有人可读（包括匿名，登录页展示）
CREATE POLICY "chemical_warnings_select_auth" ON chemical_warnings FOR SELECT TO authenticated USING (true);
CREATE POLICY "chemical_warnings_select_anon" ON chemical_warnings FOR SELECT TO anon USING (true);
-- 登录用户可上报预警
CREATE POLICY "chemical_warnings_insert" ON chemical_warnings FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());
-- 药品专人/管理员可更新（处理预警）
CREATE POLICY "chemical_warnings_update" ON chemical_warnings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role IN ('super_admin', 'admin') OR 'chemicals' = ANY(managed_modules)))
);

GRANT ALL ON chemical_warnings TO authenticated;
GRANT SELECT ON chemical_warnings TO anon;

-- ========================
-- 2. 采购审批单表
-- ========================
CREATE TABLE IF NOT EXISTS purchase_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT '其他' CHECK (category IN ('个人药品', '外送检测', '设备配件', '加工定制', '办公打印', '差旅费', '邮寄快递', '其他')),
  estimated_amount numeric,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_purchase_approvals_requester ON purchase_approvals(requester_id);
CREATE INDEX IF NOT EXISTS idx_purchase_approvals_approver ON purchase_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_purchase_approvals_status ON purchase_approvals(status);

ALTER TABLE purchase_approvals ENABLE ROW LEVEL SECURITY;

-- 所有登录用户可读
CREATE POLICY "purchase_approvals_select" ON purchase_approvals FOR SELECT TO authenticated USING (true);
-- 本人可创建
CREATE POLICY "purchase_approvals_insert" ON purchase_approvals FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
-- 审批人/管理员可更新
CREATE POLICY "purchase_approvals_update" ON purchase_approvals FOR UPDATE TO authenticated USING (
  approver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
);

GRANT ALL ON purchase_approvals TO authenticated;

-- ========================
-- 3. 报销表增加字段
-- ========================
ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS category text DEFAULT '其他';
ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS purchase_approval_id uuid REFERENCES purchase_approvals(id) ON DELETE SET NULL;
ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS file_paths jsonb DEFAULT '[]';

-- ========================
-- 4. 确保匿名访问药品表（登录页预警需要读药品名）
-- ========================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chemicals' AND policyname = 'chemicals_select_anon') THEN
    CREATE POLICY "chemicals_select_anon" ON chemicals FOR SELECT TO anon USING (true);
  END IF;
END $$;
GRANT SELECT ON chemicals TO anon;

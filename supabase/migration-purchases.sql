-- migration-purchases.sql
-- 统一采购流程：合并 purchase_approvals + reimbursements 为一张表

-- 统一采购表
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  purchase_type text NOT NULL DEFAULT 'personal' CHECK (purchase_type IN ('personal', 'public')),
  category text NOT NULL DEFAULT '其他' CHECK (category IN (
    '试剂药品', '实验耗材', '设备配件', '服装劳保',
    '测试加工', '会议培训', '出版知产',
    '办公用品', '差旅交通', '邮寄物流', '其他'
  )),
  estimated_amount numeric,
  description text NOT NULL DEFAULT '',
  attachments jsonb DEFAULT '[]',

  -- 审批阶段
  approver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_note text,
  approved_at timestamptz,
  auto_approved boolean NOT NULL DEFAULT false,

  -- 流程控制
  skip_registration boolean NOT NULL DEFAULT false,

  -- 报销阶段
  actual_amount numeric,
  receipt_attachments jsonb DEFAULT '[]',
  reimbursement_status text CHECK (reimbursement_status IN ('pending', 'approved', 'rejected')),
  reimbursement_reviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reimbursement_note text,
  reimbursed_at timestamptz,

  -- 入库阶段
  registration_status text CHECK (registration_status IN ('registered')),
  registered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  registered_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 学生-教师对应关系（一对一）
CREATE TABLE student_teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 自动更新 updated_at
CREATE TRIGGER trg_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_student_teacher_assignments_updated_at
  BEFORE UPDATE ON student_teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: purchases
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_select" ON purchases
  FOR SELECT TO authenticated USING (
    applicant_id = auth.uid()
    OR approver_id = auth.uid()
    OR manages_module('reimbursements')
    OR manages_module('supplies')
    OR manages_module('chemicals')
    OR is_admin_or_above()
  );

CREATE POLICY "purchases_insert" ON purchases
  FOR INSERT TO authenticated WITH CHECK (
    applicant_id = auth.uid()
  );

CREATE POLICY "purchases_update" ON purchases
  FOR UPDATE TO authenticated USING (
    applicant_id = auth.uid()
    OR approver_id = auth.uid()
    OR manages_module('reimbursements')
    OR manages_module('supplies')
    OR manages_module('chemicals')
    OR is_admin_or_above()
  );

CREATE POLICY "purchases_delete" ON purchases
  FOR DELETE TO authenticated USING (
    applicant_id = auth.uid()
    OR is_admin_or_above()
  );

-- RLS: student_teacher_assignments
ALTER TABLE student_teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sta_select" ON student_teacher_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sta_insert" ON student_teacher_assignments
  FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_above()
  );

CREATE POLICY "sta_update" ON student_teacher_assignments
  FOR UPDATE TO authenticated USING (
    is_admin_or_above()
  );

CREATE POLICY "sta_delete" ON student_teacher_assignments
  FOR DELETE TO authenticated USING (
    is_admin_or_above()
  );

-- 索引
CREATE INDEX idx_purchases_applicant ON purchases(applicant_id);
CREATE INDEX idx_purchases_approver ON purchases(approver_id);
CREATE INDEX idx_purchases_approval_status ON purchases(approval_status);
CREATE INDEX idx_purchases_reimbursement_status ON purchases(reimbursement_status);
CREATE INDEX idx_purchases_category ON purchases(category);

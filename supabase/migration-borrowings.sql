-- 耗材借用/归还系统 - 数据库迁移
-- 如果 psql 不可用，请将此 SQL 粘贴到 Supabase Dashboard → SQL Editor 执行

-- 1. 创建借用记录表
CREATE TABLE IF NOT EXISTS supply_borrowings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id uuid NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  purpose text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'lost')),
  borrowed_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. 索引
CREATE INDEX IF NOT EXISTS idx_borrowings_user ON supply_borrowings(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_supply ON supply_borrowings(supply_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_status ON supply_borrowings(status);

-- 3. RLS
ALTER TABLE supply_borrowings ENABLE ROW LEVEL SECURITY;

-- 所有人可查看
CREATE POLICY "borrowings_select" ON supply_borrowings
  FOR SELECT TO authenticated USING (true);

-- 用户可以创建自己的借用记录
CREATE POLICY "borrowings_insert" ON supply_borrowings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 用户可以更新自己的借用记录（归还），管理员可以更新任何记录
CREATE POLICY "borrowings_update_own" ON supply_borrowings
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "borrowings_update_admin" ON supply_borrowings
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role IN ('super_admin', 'admin') OR 'supplies' = ANY(managed_modules)))
  );

-- 4. 权限
GRANT ALL ON supply_borrowings TO authenticated;
GRANT SELECT ON supply_borrowings TO anon;

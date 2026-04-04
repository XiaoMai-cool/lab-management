-- migration-supply-improvements.sql
-- 耗材申领改进：合并申领+借用、多选支持、is_returnable属性

-- 1. supplies 表新增 is_returnable 字段
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS is_returnable boolean NOT NULL DEFAULT false;

-- 2. 新增 supply_reservation_items 表（支持多选申领）
CREATE TABLE supply_reservation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES supply_reservations(id) ON DELETE CASCADE,
  supply_id uuid NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  approved_quantity integer,
  removed boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_reservation_items_reservation ON supply_reservation_items(reservation_id);
CREATE INDEX idx_reservation_items_supply ON supply_reservation_items(supply_id);

-- RLS
ALTER TABLE supply_reservation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sri_select" ON supply_reservation_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sri_insert" ON supply_reservation_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "sri_update" ON supply_reservation_items
  FOR UPDATE TO authenticated USING (
    manages_module('supplies') OR is_admin_or_above()
  );

CREATE POLICY "sri_delete" ON supply_reservation_items
  FOR DELETE TO authenticated USING (
    manages_module('supplies') OR is_admin_or_above()
  );

-- 3. supply_borrowings: 将 lost 状态改为 damaged
-- 更新现有数据（测试数据）
UPDATE supply_borrowings SET status = 'damaged' WHERE status = 'lost';

-- 更新 CHECK 约束
ALTER TABLE supply_borrowings DROP CONSTRAINT IF EXISTS supply_borrowings_status_check;
ALTER TABLE supply_borrowings ADD CONSTRAINT supply_borrowings_status_check
  CHECK (status IN ('borrowed', 'returned', 'damaged'));

-- 4. 新增取药清单表
CREATE TABLE reagent_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_reagent_lists_updated_at
  BEFORE UPDATE ON reagent_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE reagent_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rl_select" ON reagent_lists
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "rl_insert" ON reagent_lists
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "rl_update" ON reagent_lists
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "rl_delete" ON reagent_lists
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_reagent_lists_user ON reagent_lists(user_id);

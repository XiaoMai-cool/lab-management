-- 值班规则配置表
CREATE TABLE duty_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE CHECK (type IN ('lab', 'office')),
  people text[] NOT NULL DEFAULT '{}',
  rotation_period integer NOT NULL DEFAULT 4,
  ref_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 手动覆盖表
CREATE TABLE duty_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('lab', 'office')),
  target_date date NOT NULL,
  people text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(type, target_date)
);

CREATE TRIGGER trg_duty_config_updated_at
  BEFORE UPDATE ON duty_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE duty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dc_select" ON duty_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "dc_modify" ON duty_config FOR ALL TO authenticated
  USING (manages_module('duty') OR is_admin_or_above())
  WITH CHECK (manages_module('duty') OR is_admin_or_above());

CREATE POLICY "do_select" ON duty_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "do_insert" ON duty_overrides FOR INSERT TO authenticated
  WITH CHECK (manages_module('duty') OR is_admin_or_above());
CREATE POLICY "do_update" ON duty_overrides FOR UPDATE TO authenticated
  USING (manages_module('duty') OR is_admin_or_above());
CREATE POLICY "do_delete" ON duty_overrides FOR DELETE TO authenticated
  USING (manages_module('duty') OR is_admin_or_above());

-- 插入默认数据
INSERT INTO duty_config (type, people, rotation_period, ref_date) VALUES
  ('lab', ARRAY['陈鸿琳', '麦宏博', '彭鸿昌', '邓岩昊', '林弋杰'], 4, '2026-03-30'),
  ('office', ARRAY['林弋杰', '陈鸿琳', '麦宏博', '彭鸿昌', '邓岩昊'], 1, '2026-03-01');

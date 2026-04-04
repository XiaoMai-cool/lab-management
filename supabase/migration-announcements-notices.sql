-- migration-announcements-notices.sql
-- 公告附件+登录页展示 + 日常须知表

-- 公告表增强
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS show_on_login boolean NOT NULL DEFAULT false;

-- 日常须知表
CREATE TABLE daily_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('实验室', '办公室')),
  content text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_daily_notices_updated_at
  BEFORE UPDATE ON daily_notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE daily_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dn_select" ON daily_notices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dn_insert" ON daily_notices
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_above());

CREATE POLICY "dn_update" ON daily_notices
  FOR UPDATE TO authenticated USING (is_admin_or_above());

CREATE POLICY "dn_delete" ON daily_notices
  FOR DELETE TO authenticated USING (is_admin_or_above());

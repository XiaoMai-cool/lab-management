-- 公告登录页排序字段
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS login_sort_order integer NOT NULL DEFAULT 0;

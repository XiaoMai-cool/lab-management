-- 公告表新增首页排序字段
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS dashboard_sort_order integer NOT NULL DEFAULT 0;

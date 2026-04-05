-- 文档表新增附件字段
ALTER TABLE documents ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';

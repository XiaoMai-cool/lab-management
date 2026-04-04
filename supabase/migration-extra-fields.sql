-- migration-extra-fields.sql
-- 采购表单增强：额外字段、文件格式扩展

-- purchases 表新增 extra_fields 列（存储类别相关的额外信息）
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS extra_fields jsonb DEFAULT '{}';

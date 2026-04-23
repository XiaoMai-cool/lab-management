-- migration-borrowings-reservation-link.sql
-- 目的：在 supply_borrowings 上新增 reservation_id 外键，
-- 使得申领审批通过时可以为"可归还"的物品自动创建借用记录，
-- 并允许用户在归还页按"申领单"批量归还。

ALTER TABLE supply_borrowings
  ADD COLUMN IF NOT EXISTS reservation_id uuid
  REFERENCES supply_reservations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_borrowings_reservation
  ON supply_borrowings(reservation_id);

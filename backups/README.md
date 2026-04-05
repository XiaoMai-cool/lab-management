# 数据库备份

此文件夹存放实验室管理系统的数据库备份。

## 备份机制

- **自动备份**：每周一、周四早上 9:00（北京时间），由 GitHub Actions 自动运行
- **手动备份**：在 GitHub 仓库 → Actions → 定期数据库备份 → Run workflow
- **保留策略**：最近 10 次备份，旧备份自动清理

## 文件夹命名

格式：`日期_时间`，例如 `2026-04-05_145431` 表示 2026年4月5日 14:54:31 的备份。

## 包含的表（25 张）

| 分类 | 表名 | 说明 |
|------|------|------|
| 用户 | profiles | 用户信息与角色 |
| 公告 | announcements, daily_notices | 公告通知、日常须知 |
| 文档 | documents | 制度文档 |
| 耗材 | supply_categories, supplies | 耗材分类与库存 |
| 耗材使用 | supply_reservations, supply_reservation_items, supply_borrowings | 申领、借用记录 |
| 药品 | chemicals, chemical_usage_logs, chemical_purchases, chemical_warnings | 药品库存与使用 |
| 值日 | duty_roster, duty_config, duty_overrides | 值日排班 |
| 设备 | equipment | 实验设备 |
| 会议 | meetings, meeting_reports | 组会与汇报 |
| 采购 | purchases, purchase_logs, purchase_approvals, student_teacher_assignments | 采购与审批 |
| 报销 | reimbursements | 报销记录 |
| 其他 | reagent_lists | 取药清单 |

## 如何恢复

详见项目根目录 README.md 的「数据备份与恢复」章节。

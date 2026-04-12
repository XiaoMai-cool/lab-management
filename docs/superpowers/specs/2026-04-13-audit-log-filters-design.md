# 操作日志筛选增强 — 设计文档

> 日期: 2026-04-13

## 背景

当前 AuditLogTab 只有操作类型和时间范围两个筛选，不够细致。需要增加按业务模块多选筛选、按操作人筛选、自定义日期范围。

## 方案

改造 `AuditLogTab.tsx`，增强筛选维度。

---

## 1. 筛选栏布局

```
第一行: [操作人 ▼]  [7天] [30天] [全部] [自定义: 起始 ~ 结束]  [导出当前结果]

第二行: 业务模块标签（多选）
  [全部]
  [采购审批 全选] [批准] [拒绝] [撤回]
  [报销审批 全选] [批准] [拒绝] [撤回]
  [药品管理 全选] [新建] [增加库存]
  [物资申领 全选] [批准] [拒绝]
  [物资借用 全选] [借出] [归还]
  [用户管理 全选] [新建] [更新] [删除]
```

---

## 2. 业务标签多选逻辑

### 三层选择

- **全部**：点击选中/取消所有标签
- **模块全选**（如"采购审批 全选"）：选中/取消该模块下所有标签
- **单个标签**（如"批准"）：单独切换

### 标签与数据映射

每个标签对应一组过滤条件（target_table + action + details 条件）：

| 标签 | target_table | action | details 条件 |
|------|-------------|--------|-------------|
| 采购-批准 | purchases | approve | type != 'reimbursement' |
| 采购-拒绝 | purchases | reject | type != 'reimbursement' |
| 采购-撤回 | purchases | recall | type != 'reimbursement' |
| 报销-批准 | purchases | approve | type = 'reimbursement' |
| 报销-拒绝 | purchases | reject | type = 'reimbursement' |
| 报销-撤回 | purchases | recall | type = 'reimbursement' |
| 药品-新建 | chemicals | create | — |
| 药品-增加库存 | chemicals | stock_add | — |
| 物资-批准 | supply_reservations | approve | — |
| 物资-拒绝 | supply_reservations | reject | — |
| 借用-借出 | supply_borrowings | create | — |
| 借用-归还 | supply_borrowings | return | — |
| 用户-新建 | profiles | create | — |
| 用户-更新 | profiles | update | — |
| 用户-删除 | profiles | delete | — |

### 过滤方式

由于 Supabase 不支持复杂的 OR+AND 组合查询（多个 target_table+action 组合），采用**客户端过滤**：
- 从数据库查询时只过滤时间范围和操作人（减少数据量）
- 业务标签筛选在前端对结果进行过滤
- 不选任何标签 = 显示全部（不过滤）

---

## 3. 操作人筛选

- 下拉框，从 profiles 表加载用户列表
- 超级管理员：看到全部用户
- 老师/板块负责人：只看到自己
- 选择后按 user_id 过滤
- 默认"全部"（超级管理员）或当前用户（非超级管理员）

---

## 4. 时间筛选

- 快捷按钮：7天、30天、全部
- 自定义：展开两个 date input（起始日期 ~ 结束日期）
- 快捷和自定义互斥 — 点快捷清除自定义日期，设置自定义日期取消快捷选中

---

## 5. 涉及文件

| 文件 | 改动 |
|------|------|
| `src/pages/admin/AuditLogTab.tsx` | 重写筛选逻辑和 UI |

# 数据导出重构 + 操作日志浏览 — 设计文档

> 日期: 2026-04-13

## 背景

当前数据导出存在的问题：
1. "导出药品记录"查的是 `chemical_usage_logs`，命名与"导出药品库存"混淆，且无数据时无反应
2. 不支持多 Sheet 全量导出
3. 缺少耗材借用记录、药品补货记录、操作日志的导出
4. 无操作日志浏览功能

## 方案

重构 `/admin/export` 页面，加 Tab 切换（数据导出 | 操作日志），新增全量导出和操作日志浏览。

---

## 1. 页面结构

`/admin/export` 页面顶部加 Tab：

```
[ 数据导出 ] [ 操作日志 ]
```

权限：teacher 及以上可访问（与当前一致）。学生不可见操作日志。

---

## 2. 数据导出 Tab

### 单独导出（卡片式，每个可单独下载）

| 导出项 | key | 数据源 | 状态 |
|--------|-----|--------|------|
| 耗材库存 | supplies | supplies + supply_categories | 已有 |
| 耗材申领记录 | reservations | supply_reservations + items + profiles | 已有 |
| 耗材借用记录 | borrowings | supply_borrowings + supplies + profiles | **新增** |
| 药品库存 | chemical_inventory | chemicals | 已有 |
| 药品使用记录 | chemical_usage | chemical_usage_logs + chemicals + profiles | 已有（改 key 和标题） |
| 药品补货记录 | chemical_warnings | chemical_warnings + chemicals + profiles | **新增** |
| 采购记录 | purchases | purchases + profiles | 已有 |
| 操作日志 | audit_log | audit_log + profiles | **新增** |

### 全量导出

顶部新增"全量导出"按钮，点击后生成一个 Excel 文件包含 8 个 Sheet（每个对应上面一个导出项）。空数据的 Sheet 也创建（仅表头无数据行）。

---

## 3. 新增导出项字段

### 耗材借用记录

| 列名 | 字段 |
|------|------|
| 物品名称 | supply.name |
| 借用人 | user.name |
| 数量 | quantity |
| 用途 | purpose |
| 状态 | status (borrowed/returned/damaged) |
| 借出时间 | borrowed_at |
| 归还时间 | returned_at |

### 药品补货记录

| 列名 | 字段 |
|------|------|
| 药品名称 | chemical.name |
| 编号 | chemical.batch_number |
| 报告人 | reporter.name |
| 状态 | status (pending/ordered/arrived) |
| 报告时间 | reported_at |
| 预计送达 | estimated_delivery_date |
| 实际送达 | arrived_at |

### 操作日志

| 列名 | 字段 |
|------|------|
| 操作人 | user.name |
| 操作类型 | action |
| 目标表 | target_table |
| 详情 | details (JSON 转文本) |
| 时间 | created_at |

---

## 4. 操作日志 Tab

### 列表展示

每条日志显示：操作人、操作类型、目标、详情摘要、时间。

支持加载更多（每次加载 50 条）。

### 权限过滤

| 角色 | 可见范围 |
|------|---------|
| 超级管理员 | 所有日志 |
| 老师/板块负责人 | 自己的操作 + 自己审批过的学生相关日志 |
| 学生 | 不可见 |

实现方式：
- 超级管理员：无 filter
- 老师/板块负责人：`user_id = 当前用户` 的日志

### 筛选

- 按操作类型：全部 / create / approve / reject / recall / stock_add
- 按时间范围：最近 7 天 / 30 天 / 全部

### 导出

操作日志 Tab 内有"导出当前筛选结果"按钮，导出为单 Sheet Excel。

---

## 5. exportExcel 改造

新增函数：

```ts
function downloadMultiSheetExcel(
  sheets: { name: string; data: Record<string, unknown>[] }[],
  filename: string
): void
```

- 创建一个 workbook，依次添加每个 sheet
- 空数据的 sheet 也创建（从第一个非空同类导出推断表头，或使用预定义表头）
- 现有 `downloadExcel` 保持不变（单独导出继续用）

---

## 6. 修正现有问题

- "导出药品记录" key 从 `chemicals` 改为 `chemical_usage`，标题改为"药品使用记录"
- 空数据时仍触发下载（空 Excel 只有表头）

---

## 7. 涉及文件

| 文件 | 改动 |
|------|------|
| `src/lib/exportExcel.ts` | 新增 `downloadMultiSheetExcel` 函数 |
| `src/pages/admin/DataExport.tsx` | 重构为 Tab 页面，新增全量导出、3 个新导出项、操作日志浏览 |

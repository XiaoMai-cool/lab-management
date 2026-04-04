# Bug 修复与体验优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 5 个 Bug + 3 个小改进，涵盖个人中心、采购页面、报销统计、药品补货、申购药品。

**Architecture:** 均为单文件修改，互不依赖，可并行执行。

**Tech Stack:** React, TypeScript, TailwindCSS v4

---

### Task 1: 修复个人中心 MODULE_LABELS 英文显示

**Files:**
- Modify: `src/pages/profile/ProfilePage.tsx`

**问题：** `managed_modules` 中 `announcements` 和 `members` 没有中文映射，显示英文原文。

- [ ] **Step 1:** 在 `MODULE_LABELS` 中补充缺失的映射

找到约第40行的 `MODULE_LABELS`，补充 `announcements` 和 `members`：

```typescript
const MODULE_LABELS: Record<string, string> = {
  supplies: '物资管理',
  chemicals: '化学品管理',
  duty: '值日排班',
  reimbursements: '报销管理',
  documents: '文档管理',
  announcements: '公告管理',
  members: '人员管理',
};
```

- [ ] **Step 2:** 验证构建 + Commit

---

### Task 2: 修复个人中心管理功能分组

**Files:**
- Modify: `src/pages/profile/ProfilePage.tsx`

**问题：** 个人中心的"管理功能"列表还是旧的平铺方式，没有按职责分组；还显示"借用管理"而非"物资追踪"。

- [ ] **Step 1:** 重写管理功能区域

将约第249-298行的管理功能 Card 内容改为按分组展示，与 Layout.tsx 的分组逻辑一致：
- 采购审批（独立，教师可见）
- 报销管理（报销审批人 + 耗材/药品专人看报销统计）
- 耗材管理（申领审批、库存管理、物资追踪、入库登记）
- 药品管理（药品库存、补货管理、入库登记）
- 系统管理（公告、人员、数据导出）

使用分组标题 + 子项列表，每组用不同颜色区分。

- [ ] **Step 2:** 验证构建 + Commit

---

### Task 3: 修复报销统计 filterExpanded 报错

**Files:**
- Modify: `src/pages/reimbursements/ReimbursementStats.tsx`

**问题：** 控制台报 `filterExpanded is not defined`。之前添加了折叠功能但 state 变量可能未正确添加。

- [ ] **Step 1:** 确认 `filterExpanded` state 声明存在

检查文件中是否有 `const [filterExpanded, setFilterExpanded] = useState(false)`。如果没有，添加到其他 state 声明附近。

- [ ] **Step 2:** 验证构建 + 确认控制台无报错 + Commit

---

### Task 4: 修复采购页面 SubNav 旧入口

**Files:**
- Modify: `src/pages/purchase-approvals/PurchaseApprovalList.tsx`

**问题：** SubNav 还显示「报销记录」「新建报销」等旧入口。

- [ ] **Step 1:** 更新 SubNav items

将约第15-20行的 `subNavItems` 改为：

```typescript
const subNavItems = [
  { to: '/purchase-approvals/new', label: '新建采购' },
  { to: '/purchase-approvals', label: '我的采购' },
];
```

- [ ] **Step 2:** 验证构建 + Commit

---

### Task 5: 药品补货管理 — 送达显示上报人和时间

**Files:**
- Modify: `src/pages/reagents/ChemicalWarnings.tsx`

**问题：** 已送达的药品补货记录不显示上报人姓名。

- [ ] **Step 1:** 在已送达记录卡片中增加上报人显示

在"最近送达"区域的每条记录中，已有 `reporter` 关联数据。在送达信息下方增加：

```
上报人: {w.reporter?.name} | 上报: MM-DD | 送达: MM-DD HH:mm
```

将送达时间格式从 `MM-DD` 改为 `MM-DD HH:mm` 更精确。

- [ ] **Step 2:** 验证构建 + Commit

---

### Task 6: 申购药品 — 用途改选填，去掉紧急程度

**Files:**
- Modify: `src/pages/reagents/ReagentPurchaseRequest.tsx`

- [ ] **Step 1:** 修改用途字段

将约第453行的用途 label 中的 `<span className="text-red-500">*</span>` 删除，`required` 属性删除。

- [ ] **Step 2:** 删除紧急程度字段

删除约第466-476行的紧急程度 select 字段。

同时从 `RequestFormData` 接口和 `defaultForm` 中移除 `urgency` 字段，以及提交逻辑中的 `urgency` 引用。

- [ ] **Step 3:** 验证构建 + Commit

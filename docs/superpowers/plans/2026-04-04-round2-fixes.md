# 第二轮修复与优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复药品库存链接、申领提交问题，优化入库登记、采购筛选、公告附件等功能。

**Architecture:** 多个独立文件修改，互不依赖。

**Tech Stack:** React, TypeScript, TailwindCSS v4, Supabase

---

### Task 1: 修复药品库存链接

**Files:**
- Modify: `src/components/Layout.tsx`

**问题：** 管理面板「药品库存」链接到 `/reagents/new`（添加药品表单），应该链接到 `/reagents`（药品列表）。

- [ ] **Step 1:** 将 `path: '/reagents/new'` 改为 `path: '/reagents'`
- [ ] **Step 2:** 构建验证 + Commit

---

### Task 2: 修复申领物资提交问题

**Files:**
- Modify: `src/pages/supplies/SupplyReserve.tsx`

**问题：** 选了耗材后提交不了。需要排查 submit handler。

- [ ] **Step 1:** 检查 `handleSubmit` 函数中的表单验证和 Supabase 插入逻辑
- [ ] **Step 2:** 检查提交按钮的 `disabled` 条件是否有误
- [ ] **Step 3:** 确认 `supply_reservations` 表的 `supply_id` 列是否允许插入（可能是 NOT NULL 约束 + 多选后 supply_id 取第一项的问题）
- [ ] **Step 4:** 测试修复 + Commit

---

### Task 3: 数据导出清理

**Files:**
- Modify: `src/pages/admin/DataExport.tsx`

**问题：** 「导出购买登记」查的是旧的 `purchase_logs` 表，已过时。应改为导出 `purchases` 表数据。

- [ ] **Step 1:** 将 `purchase_logs` 查询改为 `purchases` 表查询
- [ ] **Step 2:** 更新导出字段映射：标题、类别、采购类型、金额、申请人、审批状态、报销状态、入库状态、日期
- [ ] **Step 3:** 卡片标题从「导出购买登记」改为「导出采购记录」
- [ ] **Step 4:** 构建验证 + Commit

---

### Task 4: 我的采购筛选优化

**Files:**
- Modify: `src/pages/purchase-approvals/PurchaseApprovalList.tsx`

**问题：** 6个筛选标签在手机端太多。

- [ ] **Step 1:** 合并筛选项，减少为 4 个：
  - 全部
  - 进行中（待审批 + 已批准未报销 + 报销中）
  - 已完成（报销已通过）
  - 已拒绝（审批或报销被驳回）

- [ ] **Step 2:** 构建验证 + Commit

---

### Task 5: 入库登记优化

**Files:**
- Modify: `src/pages/purchases/RegistrationPage.tsx`

**问题：** 没有审批记录时页面空白不可操作。需要优化空状态提示。

- [ ] **Step 1:** 待登记 tab 空状态文案改为更友好的提示："采购审批通过后，需要入库的物资会出现在这里"
- [ ] **Step 2:** 已登记 tab 增加编辑和删除功能（按钮在每条记录上）
  - 编辑：修改 `registration_status`
  - 删除：清除登记信息（`registration_status = null, registered_by = null, registered_at = null`）
- [ ] **Step 3:** 构建验证 + Commit

---

### Task 6: 公告管理支持附件

**Files:**
- Modify: `src/pages/admin/AnnouncementManage.tsx`

**问题：** 公告只支持文字，不支持文件和图片。

- [ ] **Step 1:** 需要数据库支持。在 `announcements` 表新增 `attachments jsonb DEFAULT '[]'` 列。创建迁移文件 `supabase/migration-announcement-attachments.sql`。

- [ ] **Step 2:** 在公告编辑表单中添加文件上传区域（支持图片、PDF、Word、Excel）
  - 上传到 supabase storage `attachments` bucket，路径 `announcements/{timestamp}.{ext}`
  - 存储为 jsonb 数组 `[{ name, url, type, size }]`

- [ ] **Step 3:** 在公告显示中展示附件列表（可点击下载/查看）

- [ ] **Step 4:** 构建验证 + Commit

---

### Task 7: 药品总览「分类」改名

**Files:**
- Modify: `src/pages/reagents/ReagentList.tsx`

**问题：** 折叠按钮文字为「分类」，应改为「药品分类」更明确。

- [ ] **Step 1:** 找到折叠按钮的文字 `分类`，改为 `药品分类`
- [ ] **Step 2:** 构建验证 + Commit

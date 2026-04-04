# 第二轮修复与优化 V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 2 个 Bug，实现 9 个改进/新功能，涵盖药品链接、申领提交、数据导出、采购筛选、入库登记、公告附件+登录页展示、日常须知管理、制度文档入口。

**Architecture:** 大部分为独立文件修改。公告附件和日常须知需要数据库变更。

**Tech Stack:** React, TypeScript, TailwindCSS v4, Supabase

---

### Task 1: 修复药品库存链接

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1:** 找到药品管理分组中 `path: '/reagents/new'`，改为 `path: '/reagents'`
- [ ] **Step 2:** 构建验证 + Commit

---

### Task 2: 修复手机端申领提交按钮被挡住

**Files:**
- Modify: `src/pages/supplies/SupplyReserve.tsx`

**问题：** 底部提交按钮被手机端底部导航栏（高度 64px + safe area）挡住。

- [ ] **Step 1:** 给提交按钮区域添加底部安全间距。找到提交按钮的容器，添加 `pb-24`（或 `mb-24`）确保按钮不被底部导航遮挡
- [ ] **Step 2:** 手机端验证按钮可见可点击（不被底部导航遮挡）+ Commit

---

### Task 3: 数据导出调整

**Files:**
- Modify: `src/pages/admin/DataExport.tsx`

- [ ] **Step 1:** 删除「导出购买登记」的 export card 和对应的 case 分支
- [ ] **Step 2:** 将「导出报销记录」改为「导出采购记录」：
  - 查询 `purchases` 表：`select('*, applicant:profiles!purchases_applicant_id_fkey(name), approver:profiles!purchases_approver_id_fkey(name)')`
  - 导出字段：申请人、标题、类别、采购类型（个人/公共）、金额、审批状态、审批人、报销状态、入库状态、日期
- [ ] **Step 3:** 构建验证 + Commit

---

### Task 4: 我的采购筛选简化

**Files:**
- Modify: `src/pages/purchase-approvals/PurchaseApprovalList.tsx`

- [ ] **Step 1:** 将筛选项从 6 个改为 4 个：
```typescript
const filterOptions = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },   // 待审批 + 已批准未报销 + 报销中
  { value: 'completed', label: '已完成' }, // 报销已通过
  { value: 'rejected', label: '已拒绝' }, // 审批或报销被驳回
];
```
- [ ] **Step 2:** 更新筛选逻辑 `matchesFilter` 函数
- [ ] **Step 3:** 构建验证 + Commit

---

### Task 5: 入库登记优化

**Files:**
- Modify: `src/pages/purchases/RegistrationPage.tsx`

- [ ] **Step 1:** 待登记 tab 空状态改为："采购审批通过后，需要入库的物资会出现在这里"
- [ ] **Step 2:** 已登记 tab 每条记录增加「删除登记」按钮：
  - 点击确认后更新 `registration_status = null, registered_by = null, registered_at = null`
  - 记录回到待登记 tab
- [ ] **Step 3:** 构建验证 + Commit

---

### Task 6: 药品总览「分类」改名

**Files:**
- Modify: `src/pages/reagents/ReagentList.tsx`

- [ ] **Step 1:** 找到折叠按钮中的文字 `分类`，改为 `药品分类`
- [ ] **Step 2:** 构建验证 + Commit

---

### Task 7: 归还时提醒耗材专人

**Files:**
- Modify: `src/pages/supplies/SupplyReturn.tsx`

**说明：** 系统暂无推送功能，用轻量方式实现——在 Dashboard 的管理端待办中显示"今日有 N 项物资被归还"。

- [ ] **Step 1:** 在 `src/pages/Dashboard.tsx` 中，耗材专人的待办区域增加查询：从 `supply_borrowings` 表查询今天 `status = 'returned'` 且 `returned_at` 在今天的记录数量
- [ ] **Step 2:** 显示为待办卡片："今日 N 项物资已归还，请确认"，链接到物资追踪页面
- [ ] **Step 3:** 构建验证 + Commit

---

### Task 8: 公告支持附件 + 登录页展示

**Files:**
- Create: `supabase/migration-announcement-enhancements.sql`
- Modify: `src/pages/admin/AnnouncementManage.tsx`
- Modify: `src/pages/auth/LoginPage.tsx`

- [ ] **Step 1:** 创建数据库迁移：
```sql
-- announcements 表新增字段
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS show_on_login boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2:** 在公告编辑表单中添加：
  - 附件上传区域（支持图片/PDF/Word/Excel），存储到 supabase storage `attachments/announcements/`
  - 「在登录页展示」勾选框
- [ ] **Step 3:** 在公告展示中（Dashboard + 公告列表）：
  - 图片附件直接展示（img 标签）
  - 非图片附件显示为可下载的文件链接
- [ ] **Step 4:** 在 LoginPage 中查询 `show_on_login = true` 的公告，展示标题列表，点击可展开查看内容
- [ ] **Step 5:** 构建验证 + Commit

---

### Task 9: 日常须知管理化

**Files:**
- Create: `supabase/migration-daily-notices.sql`
- Create: `src/pages/admin/DailyNoticesManage.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1:** 创建数据库迁移：
```sql
CREATE TABLE daily_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('实验室', '办公室')),
  content text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_daily_notices_updated_at
  BEFORE UPDATE ON daily_notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE daily_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dn_select" ON daily_notices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dn_modify" ON daily_notices
  FOR ALL TO authenticated USING (is_admin_or_above())
  WITH CHECK (is_admin_or_above());
```

- [ ] **Step 2:** 创建管理页面 `DailyNoticesManage.tsx`：
  - 分「实验室」「办公室」两个区域
  - 每个区域显示条目列表，可增删改
  - 每条就是一句话（text input）
  - 可拖拽排序或上下移动调整顺序

- [ ] **Step 3:** 在 `App.tsx` 添加路由 `/admin/daily-notices`
- [ ] **Step 4:** 在管理面板系统管理分组中添加「日常须知」入口
- [ ] **Step 5:** Dashboard 首页的日常须知区域从硬编码改为查询 `daily_notices` 表
- [ ] **Step 6:** 构建验证 + Commit

---

### Task 10: Dashboard 优化

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1:** 公告栏标题旁增加「查看全部 →」链接，跳转到公告列表页（如果有的话，否则跳到 `/documents`）
- [ ] **Step 2:** 库存预警区域只对管理角色显示（isSuppliesManager || isChemicalsManager || isAdmin），学生端不显示
- [ ] **Step 3:** 构建验证 + Commit

---

### Task 11: 制度文档入口

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/profile/ProfilePage.tsx`

- [ ] **Step 1:** Dashboard 快捷操作增加「制度文档」入口，链接到 `/documents`。快捷操作从 4 个变为 5 个。
- [ ] **Step 2:** 个人中心快捷入口增加「制度文档」，链接到 `/documents`
- [ ] **Step 3:** 构建验证 + Commit

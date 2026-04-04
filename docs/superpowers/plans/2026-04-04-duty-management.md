# 值班管理重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将值班管理从硬编码改为数据库驱动，管理员可通过界面配置人员、轮换规则和手动覆盖排班。

**Architecture:** 新建 `duty_config` 和 `duty_overrides` 两张表，创建管理页面 `DutyManage.tsx` 供值日管理员配置。改造 `DutyRoster.tsx` 和 `Dashboard.tsx` 从数据库读取规则并自动计算排班。

**Tech Stack:** React, TypeScript, TailwindCSS v4, Supabase, dayjs

**Design Spec:** `docs/superpowers/specs/2026-04-04-duty-management-design.md`

---

### Task 1: 数据库迁移

**Files:**
- Create: `supabase/migration-duty-config.sql`

- [ ] **Step 1: 创建迁移文件**

```sql
-- 值班规则配置表
CREATE TABLE duty_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE CHECK (type IN ('lab', 'office')),
  people text[] NOT NULL DEFAULT '{}',
  rotation_period integer NOT NULL DEFAULT 4,
  ref_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 手动覆盖表
CREATE TABLE duty_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('lab', 'office')),
  target_date date NOT NULL,
  people text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(type, target_date)
);

CREATE TRIGGER trg_duty_config_updated_at
  BEFORE UPDATE ON duty_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE duty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dc_select" ON duty_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "dc_modify" ON duty_config FOR ALL TO authenticated
  USING (manages_module('duty') OR is_admin_or_above())
  WITH CHECK (manages_module('duty') OR is_admin_or_above());

CREATE POLICY "do_select" ON duty_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "do_insert" ON duty_overrides FOR INSERT TO authenticated
  WITH CHECK (manages_module('duty') OR is_admin_or_above());
CREATE POLICY "do_update" ON duty_overrides FOR UPDATE TO authenticated
  USING (manages_module('duty') OR is_admin_or_above());
CREATE POLICY "do_delete" ON duty_overrides FOR DELETE TO authenticated
  USING (manages_module('duty') OR is_admin_or_above());

-- 插入默认数据（当前硬编码的值）
INSERT INTO duty_config (type, people, rotation_period, ref_date) VALUES
  ('lab', ARRAY['陈鸿琳', '麦宏博', '彭鸿昌', '邓岩昊', '林弋杰'], 4, '2026-03-30'),
  ('office', ARRAY['林弋杰', '陈鸿琳', '麦宏博', '彭鸿昌', '邓岩昊'], 1, '2026-03-01');
```

- [ ] **Step 2:** Commit

---

### Task 2: 创建值日管理页面

**Files:**
- Create: `src/pages/admin/DutyManage.tsx`
- Modify: `src/App.tsx` — 添加路由
- Modify: `src/components/Layout.tsx` — 管理面板添加入口

管理页面包含：
- 实验室值日设置：人员列表（从系统用户选择添加、删除、上下移动）、轮换周期、起始日期
- 办公室值日设置：同上
- 手动覆盖区域：选日期，指定人员

- [ ] **Step 1:** 创建 `DutyManage.tsx`，包含完整的管理界面
- [ ] **Step 2:** 在 `App.tsx` 添加路由 `/admin/duty-manage`（lazy loaded, duty module protected）
- [ ] **Step 3:** 在 `Layout.tsx` 系统管理分组中添加「值日管理」入口
- [ ] **Step 4:** 构建验证 + Commit

---

### Task 3: 创建值班计算工具函数

**Files:**
- Create: `src/lib/dutyCalculation.ts`

纯计算函数，从配置数据计算排班结果：

```typescript
interface DutyConfig {
  type: 'lab' | 'office';
  people: string[];
  rotation_period: number;
  ref_date: string;
}

interface DutyOverride {
  type: 'lab' | 'office';
  target_date: string;
  people: string[];
}

// 计算实验室本周排班（周一到周五）
function getLabWeekSchedule(config: DutyConfig, overrides: DutyOverride[], targetMonday: Date): string[]

// 计算实验室今日值日人（周末返回 null）
function getLabDutyToday(config: DutyConfig, overrides: DutyOverride[]): string | null

// 计算办公室本月负责人
function getOfficeDutyThisMonth(config: DutyConfig, overrides: DutyOverride[]): string
```

- [ ] **Step 1:** 创建工具文件，实现三个计算函数
- [ ] **Step 2:** 构建验证 + Commit

---

### Task 4: 改造 Dashboard 值日显示

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1:** 移除硬编码的值日常量（LAB_DUTY_PEOPLE 等）和计算函数
- [ ] **Step 2:** 从 `duty_config` 和 `duty_overrides` 表查询数据
- [ ] **Step 3:** 使用 `dutyCalculation.ts` 的函数计算排班
- [ ] **Step 4:** 保持现有的显示样式（今日值日 + 本周排班 + 办公室本月）
- [ ] **Step 5:** 构建验证 + Commit

---

### Task 5: 改造值日排班页面

**Files:**
- Modify: `src/pages/duty/DutyRoster.tsx`

- [ ] **Step 1:** 移除硬编码常量
- [ ] **Step 2:** 从数据库查询配置和覆盖数据
- [ ] **Step 3:** 使用计算函数显示排班
- [ ] **Step 4:** 管理员看到「编辑排班」按钮跳转到 `/admin/duty-manage`
- [ ] **Step 5:** 移除旧的添加排班弹窗（由新的管理页面替代）
- [ ] **Step 6:** 构建验证 + Commit

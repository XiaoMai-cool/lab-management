# 采购流程合并 2A: 数据库 + 类型 + 采购表单

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建统一采购表 `purchases`、学生-教师对应表 `student_teacher_assignments`，更新 TypeScript 类型定义，改造采购申请表单为统一入口。

**Architecture:** 新建 Supabase 迁移脚本创建两张新表和 RLS 策略。更新 `types.ts` 新增 `Purchase` 接口和扩充后的类别类型。改造 `PurchaseApprovalForm.tsx` 为统一采购申请表单，支持采购类型、扩充类别、无需入库开关、老师自动审批、学生-教师默认选中。

**Tech Stack:** Supabase (PostgreSQL, RLS), React, TypeScript, TailwindCSS v4

**Design Spec:** `docs/superpowers/specs/2026-04-04-management-restructure-design.md` — 第二部分「采购流程合并」

**Sub-plan 顺序:** 2A（本计划）→ 2B（列表+审批+报销补充）→ 2C（报销审批+统计+入库）→ 2D（Dashboard+导航+清理）

---

### Task 1: 创建数据库迁移脚本

**Files:**
- Create: `supabase/migration-purchases.sql`

- [ ] **Step 1: 创建迁移文件，定义 purchases 表**

```sql
-- migration-purchases.sql
-- 统一采购流程：合并 purchase_approvals + reimbursements 为一张表

-- 扩充后的采购类别
CREATE TYPE purchase_category AS ENUM (
  '试剂药品', '实验耗材', '设备配件', '服装劳保',
  '测试加工', '会议培训', '出版知产',
  '办公用品', '差旅交通', '邮寄物流', '其他'
);

-- 采购类型
CREATE TYPE purchase_type AS ENUM ('personal', 'public');

-- 统一采购表
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  purchase_type purchase_type NOT NULL DEFAULT 'personal',
  category purchase_category NOT NULL DEFAULT '其他',
  estimated_amount numeric,
  description text NOT NULL DEFAULT '',
  attachments jsonb DEFAULT '[]',

  -- 审批阶段
  approver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_note text,
  approved_at timestamptz,
  auto_approved boolean NOT NULL DEFAULT false,

  -- 流程控制
  skip_registration boolean NOT NULL DEFAULT false,

  -- 报销阶段
  actual_amount numeric,
  receipt_attachments jsonb DEFAULT '[]',
  reimbursement_status text CHECK (reimbursement_status IN ('pending', 'approved', 'rejected')),
  reimbursement_reviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reimbursement_note text,
  reimbursed_at timestamptz,

  -- 入库阶段
  registration_status text CHECK (registration_status IN ('registered')),
  registered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  registered_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 学生-教师对应关系（一对一）
CREATE TABLE student_teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 自动更新 updated_at
CREATE TRIGGER trg_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_student_teacher_assignments_updated_at
  BEFORE UPDATE ON student_teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: purchases
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_select" ON purchases
  FOR SELECT TO authenticated USING (
    applicant_id = auth.uid()
    OR approver_id = auth.uid()
    OR manages_module('reimbursements')
    OR manages_module('supplies')
    OR manages_module('chemicals')
    OR is_admin_or_above()
  );

CREATE POLICY "purchases_insert" ON purchases
  FOR INSERT TO authenticated WITH CHECK (
    applicant_id = auth.uid()
  );

CREATE POLICY "purchases_update" ON purchases
  FOR UPDATE TO authenticated USING (
    applicant_id = auth.uid()
    OR approver_id = auth.uid()
    OR manages_module('reimbursements')
    OR manages_module('supplies')
    OR manages_module('chemicals')
    OR is_admin_or_above()
  );

CREATE POLICY "purchases_delete" ON purchases
  FOR DELETE TO authenticated USING (
    applicant_id = auth.uid()
    OR is_admin_or_above()
  );

-- RLS: student_teacher_assignments
ALTER TABLE student_teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sta_select" ON student_teacher_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sta_insert" ON student_teacher_assignments
  FOR INSERT TO authenticated WITH CHECK (
    is_admin_or_above()
  );

CREATE POLICY "sta_update" ON student_teacher_assignments
  FOR UPDATE TO authenticated USING (
    is_admin_or_above()
  );

CREATE POLICY "sta_delete" ON student_teacher_assignments
  FOR DELETE TO authenticated USING (
    is_admin_or_above()
  );

-- 索引
CREATE INDEX idx_purchases_applicant ON purchases(applicant_id);
CREATE INDEX idx_purchases_approver ON purchases(approver_id);
CREATE INDEX idx_purchases_approval_status ON purchases(approval_status);
CREATE INDEX idx_purchases_reimbursement_status ON purchases(reimbursement_status);
CREATE INDEX idx_purchases_category ON purchases(category);
```

- [ ] **Step 2: 在 Supabase Dashboard 中执行迁移**

打开 Supabase 项目的 SQL Editor，粘贴 `supabase/migration-purchases.sql` 的内容并执行。

验证：在 Table Editor 中确认 `purchases` 和 `student_teacher_assignments` 两张表已创建。

- [ ] **Step 3: Commit**

```bash
git add supabase/migration-purchases.sql
git commit -m "feat: add purchases and student_teacher_assignments tables with RLS"
```

---

### Task 2: 更新 TypeScript 类型定义

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: 新增采购类别类型和 Purchase 接口**

在 `types.ts` 文件末尾（`PurchaseLog` 接口之后）添加：

```typescript
export type PurchaseCategory =
  | '试剂药品'
  | '实验耗材'
  | '设备配件'
  | '服装劳保'
  | '测试加工'
  | '会议培训'
  | '出版知产'
  | '办公用品'
  | '差旅交通'
  | '邮寄物流'
  | '其他';

export type PurchaseType = 'personal' | 'public';

export interface Purchase {
  id: string;
  applicant_id: string;
  applicant?: Profile;
  title: string;
  purchase_type: PurchaseType;
  category: PurchaseCategory;
  estimated_amount: number | null;
  description: string;
  attachments: ReimbursementFile[];

  // 审批阶段
  approver_id: string | null;
  approver?: Profile;
  approval_status: 'pending' | 'approved' | 'rejected';
  approval_note: string | null;
  approved_at: string | null;
  auto_approved: boolean;

  // 流程控制
  skip_registration: boolean;

  // 报销阶段
  actual_amount: number | null;
  receipt_attachments: ReimbursementFile[];
  reimbursement_status: 'pending' | 'approved' | 'rejected' | null;
  reimbursement_reviewer_id: string | null;
  reimbursement_reviewer?: Profile;
  reimbursement_note: string | null;
  reimbursed_at: string | null;

  // 入库阶段
  registration_status: 'registered' | null;
  registered_by: string | null;
  registered_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface StudentTeacherAssignment {
  id: string;
  student_id: string;
  student?: Profile;
  teacher_id: string;
  teacher?: Profile;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: 新增类别配置常量**

创建新文件 `src/lib/purchaseCategories.ts`：

```typescript
import type { PurchaseCategory } from './types';

interface CategoryConfig {
  label: PurchaseCategory;
  description: string;
  defaultSkipRegistration: boolean;
}

export const PURCHASE_CATEGORIES: CategoryConfig[] = [
  { label: '试剂药品', description: '化学/生物试剂、标准品、培养基', defaultSkipRegistration: false },
  { label: '实验耗材', description: '一次性耗材、玻璃器皿、样品瓶等', defaultSkipRegistration: false },
  { label: '设备配件', description: '仪器维修、零配件、升级改造', defaultSkipRegistration: false },
  { label: '服装劳保', description: '实验服、防护用品', defaultSkipRegistration: false },
  { label: '测试加工', description: '外送检测、样品加工', defaultSkipRegistration: true },
  { label: '会议培训', description: '会议费、培训费', defaultSkipRegistration: true },
  { label: '出版知产', description: '版面费、专利费、文献数据库', defaultSkipRegistration: true },
  { label: '办公用品', description: '打印、文具、办公耗材', defaultSkipRegistration: true },
  { label: '差旅交通', description: '出差、交通费', defaultSkipRegistration: true },
  { label: '邮寄物流', description: '快递、运输费', defaultSkipRegistration: true },
  { label: '其他', description: '以上未覆盖的支出', defaultSkipRegistration: true },
];

export function getDefaultSkipRegistration(category: PurchaseCategory): boolean {
  const config = PURCHASE_CATEGORIES.find(c => c.label === category);
  return config?.defaultSkipRegistration ?? true;
}
```

- [ ] **Step 3: 验证构建**

Run: `cd /Users/xiaomai/Claude/lab-management && npx vite build 2>&1 | tail -5`
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/purchaseCategories.ts
git commit -m "feat: add Purchase types and category configuration"
```

---

### Task 3: 改造采购申请表单

**Files:**
- Modify: `src/pages/purchase-approvals/PurchaseApprovalForm.tsx`

这是最大的改动。将当前的采购审批表单改为统一的采购申请表单，新增：采购类型、扩充类别、无需入库开关、老师自动审批、学生-教师默认选中。

- [ ] **Step 1: 重写 PurchaseApprovalForm.tsx**

完全重写该文件。新文件需要：

**数据获取：**
- 从 `profiles` 表获取教师列表（用于审批人选择）
- 从 `student_teacher_assignments` 表获取当前学生的默认教师

**表单字段：**
- `title`（必填）— 采购标题
- `purchaseType`（必填）— personal / public，默认 personal
- `category`（必填）— 从 `PURCHASE_CATEGORIES` 中选择，默认「其他」
- `estimatedAmount`（选填）— 预估金额
- `description`（选填）— 描述
- `skipRegistration`（开关）— 根据 category 自动设置默认值，可手动修改
- `approverId`（学生必填，老师不需要）— 审批教师选择

**逻辑：**
- 老师（isTeacher）提交时：`auto_approved = true`，`approval_status = 'approved'`，`approved_at = now()`，`approver_id = 自己的ID`
- 学生提交时：`auto_approved = false`，`approval_status = 'pending'`，`approver_id = 选择的教师ID`
- 切换 category 时自动更新 `skipRegistration` 默认值
- 已配置学生-教师关系时自动选中默认教师

**插入目标表：** `purchases`（不是旧的 `purchase_approvals`）

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile, PurchaseCategory, PurchaseType } from '../../lib/types';
import { PURCHASE_CATEGORIES, getDefaultSkipRegistration } from '../../lib/purchaseCategories';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function PurchaseApprovalForm() {
  const navigate = useNavigate();
  const { profile, isTeacher } = useAuth();

  // Form state
  const [title, setTitle] = useState('');
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('personal');
  const [category, setCategory] = useState<PurchaseCategory>('其他');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [description, setDescription] = useState('');
  const [skipRegistration, setSkipRegistration] = useState(true);
  const [approverId, setApproverId] = useState('');

  // Data state
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [defaultTeacherId, setDefaultTeacherId] = useState<string | null>(null);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Fetch teachers and default assignment
  useEffect(() => {
    async function load() {
      if (!profile) return;

      // Fetch teachers
      const { data: teacherData } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['teacher', 'admin', 'super_admin'])
        .neq('email', 'fengfamily@lab')
        .order('name');

      if (teacherData) setTeachers(teacherData as Profile[]);

      // Fetch student-teacher assignment (only for students)
      if (!isTeacher) {
        const { data: assignment } = await supabase
          .from('student_teacher_assignments')
          .select('teacher_id')
          .eq('student_id', profile.id)
          .single();

        if (assignment) {
          setDefaultTeacherId(assignment.teacher_id);
          setApproverId(assignment.teacher_id);
        }
      }

      setLoadingTeachers(false);
    }
    load();
  }, [profile, isTeacher]);

  // Update skipRegistration when category changes
  useEffect(() => {
    setSkipRegistration(getDefaultSkipRegistration(category));
  }, [category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    // Validation
    if (!title.trim()) {
      setError('请输入采购标题');
      return;
    }
    if (!isTeacher && !approverId) {
      setError('请选择审批教师');
      return;
    }

    setSubmitting(true);
    setError('');

    const now = new Date().toISOString();
    const isAutoApproved = isTeacher;

    const record = {
      applicant_id: profile.id,
      title: title.trim(),
      purchase_type: purchaseType,
      category,
      estimated_amount: estimatedAmount ? parseFloat(estimatedAmount) : null,
      description: description.trim(),
      skip_registration: skipRegistration,
      approver_id: isAutoApproved ? profile.id : approverId,
      approval_status: isAutoApproved ? 'approved' : 'pending',
      approval_note: isAutoApproved ? '教师自行采购，自动通过' : null,
      approved_at: isAutoApproved ? now : null,
      auto_approved: isAutoApproved,
    };

    const { error: insertErr } = await supabase.from('purchases').insert(record);

    if (insertErr) {
      setError('提交失败：' + insertErr.message);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  }

  if (!profile) return <LoadingSpinner />;

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">提交成功</h2>
        <p className="text-gray-500 mb-6 text-center">
          {isTeacher ? '采购申请已自动通过，请前往采购完成后提交报销。' : '采购申请已提交，请等待教师审批。'}
        </p>
        <div className="flex gap-3">
          <button onClick={() => navigate('/purchase-approvals')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            查看我的采购
          </button>
          <button onClick={() => { setSuccess(false); setTitle(''); setDescription(''); setEstimatedAmount(''); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
            继续提交
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <PageHeader title="采购申请" subtitle="提交采购申请，审批通过后进行采购和报销" />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 采购标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">采购标题 *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例如：3月水质检测试剂"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* 采购类型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">采购类型</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPurchaseType('personal')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  purchaseType === 'personal'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                个人采购
              </button>
              <button
                type="button"
                onClick={() => setPurchaseType('public')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  purchaseType === 'public'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                公共采购
              </button>
            </div>
          </div>

          {/* 类别 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">类别 *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as PurchaseCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PURCHASE_CATEGORIES.map(c => (
                <option key={c.label} value={c.label}>{c.label} — {c.description}</option>
              ))}
            </select>
          </div>

          {/* 无需入库 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">无需入库</p>
              <p className="text-xs text-gray-500">勾选后不流转给耗材/药品专人登记</p>
            </div>
            <button
              type="button"
              onClick={() => setSkipRegistration(!skipRegistration)}
              className={`relative w-11 h-6 rounded-full transition-colors ${skipRegistration ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${skipRegistration ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* 预估金额 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">预估金额</label>
            <input
              type="number"
              value={estimatedAmount}
              onChange={e => setEstimatedAmount(e.target.value)}
              placeholder="选填"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="选填，补充说明采购内容"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* 审批教师（学生可见） */}
          {!isTeacher && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">审批教师 *</label>
              {loadingTeachers ? (
                <p className="text-sm text-gray-400">加载中...</p>
              ) : (
                <select
                  value={approverId}
                  onChange={e => setApproverId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">请选择审批教师</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.id === defaultTeacherId ? '（默认）' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* 老师提示 */}
          {isTeacher && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">教师提交的采购申请将自动通过审批，无需其他人审批。</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '提交采购申请'}
          </button>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `cd /Users/xiaomai/Claude/lab-management && npx vite build 2>&1 | tail -5`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src/pages/purchase-approvals/PurchaseApprovalForm.tsx
git commit -m "feat: rewrite purchase form as unified purchase request with categories and auto-approval"
```

---

### Task 4: 更新管理面板中的命名

**Files:**
- Modify: `src/components/Layout.tsx`

Plan 1 已实现的管理面板代码中，耗材管理分组里还是叫「借用管理」，需要改为「物资追踪」。

- [ ] **Step 1: 修改 Layout.tsx 中的标签**

找到 `getManageConfig` 函数中耗材管理分组的 items 数组，将 `借用管理` 改为 `物资追踪`：

```typescript
// 旧代码
{ label: '借用管理', icon: Package, path: '/supplies/borrowings' },
// 新代码
{ label: '物资追踪', icon: Package, path: '/supplies/borrowings' },
```

- [ ] **Step 2: 验证构建**

Run: `cd /Users/xiaomai/Claude/lab-management && npx vite build 2>&1 | tail -5`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat: rename 借用管理 to 物资追踪 in management panel"
```

---

### Task 5: 验证完整流程

**Files:** 无代码变更

- [ ] **Step 1: 启动开发服务器**

Run: `cd /Users/xiaomai/Claude/lab-management && npm run dev`

- [ ] **Step 2: 验证数据库表**

在 Supabase Dashboard 的 Table Editor 中确认：
1. `purchases` 表已创建，字段完整
2. `student_teacher_assignments` 表已创建
3. RLS 策略已生效

- [ ] **Step 3: 验证采购申请表单**

1. **学生账号登录**：
   - 访问 `/purchase-approvals/new`
   - 确认表单字段：标题、采购类型、类别、无需入库开关、预估金额、描述、审批教师
   - 切换类别验证「无需入库」开关自动变化（试剂药品→关闭，差旅交通→开启）
   - 提交采购申请，确认 `purchases` 表中有新记录，`approval_status = 'pending'`

2. **教师账号登录**：
   - 访问 `/purchase-approvals/new`
   - 确认不显示审批教师选择
   - 确认显示绿色提示"教师提交的采购申请将自动通过审批"
   - 提交采购申请，确认 `purchases` 表中有新记录，`approval_status = 'approved'`，`auto_approved = true`

- [ ] **Step 4: 如果发现问题，修复并提交**

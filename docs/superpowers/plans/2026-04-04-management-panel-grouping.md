# 管理面板分组 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将手机端和桌面端管理面板从平铺展示改为按职责分组展示，每个用户只看到自己有权限的分组。

**Architecture:** 修改 `Layout.tsx` 中的 `getManageItems()` 返回分组结构，手机端管理面板和桌面端侧边栏同步调整渲染逻辑。采购审批作为独立入口，其余功能按报销管理、耗材管理、药品管理、系统管理四个分组呈现。

**Tech Stack:** React, TypeScript, TailwindCSS v4, Lucide React icons

**Design Spec:** `docs/superpowers/specs/2026-04-04-management-restructure-design.md` — 第一部分「管理面板分组」

---

### Task 1: 定义分组数据结构和生成函数

**Files:**
- Modify: `src/components/Layout.tsx:24-77`

- [ ] **Step 1: 定义分组相关的 TypeScript 接口和颜色映射**

在 `Layout.tsx` 文件顶部（`NavItem` 接口之后，`ROLE_LABELS` 之前），添加分组接口和颜色配置：

```typescript
interface ManageGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorScheme: 'green' | 'yellow' | 'blue' | 'purple' | 'gray';
  items: NavItem[];
}

interface ManageConfig {
  standalone: NavItem[]; // 独立入口（采购审批）
  groups: ManageGroup[]; // 分组
}

const GROUP_COLORS = {
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
    label: 'text-green-800',
    activeBg: 'bg-green-50',
    activeText: 'text-green-700',
  },
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    iconBg: 'bg-yellow-100',
    iconText: 'text-yellow-600',
    label: 'text-yellow-800',
    activeBg: 'bg-yellow-50',
    activeText: 'text-yellow-700',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    label: 'text-blue-800',
    activeBg: 'bg-blue-50',
    activeText: 'text-blue-700',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600',
    label: 'text-purple-800',
    activeBg: 'bg-purple-50',
    activeText: 'text-purple-700',
  },
  gray: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    iconBg: 'bg-gray-100',
    iconText: 'text-gray-600',
    label: 'text-gray-700',
    activeBg: 'bg-gray-100',
    activeText: 'text-gray-700',
  },
} as const;
```

- [ ] **Step 2: 替换 `getManageItems` 为 `getManageConfig`**

将现有的 `getManageItems` 函数（第44-77行）替换为：

```typescript
function getManageConfig(auth: ReturnType<typeof useAuth>): ManageConfig {
  const standalone: NavItem[] = [];
  const groups: ManageGroup[] = [];

  // 采购审批 — 独立入口，教师可见
  if (auth.isTeacher) {
    standalone.push({ label: '采购审批', icon: ClipboardCheck, path: '/purchase-approvals/review' });
  }

  // 报销管理分组
  const reimbursementItems: NavItem[] = [];
  if (auth.isReimbursementApprover) {
    reimbursementItems.push({ label: '报销审批', icon: FileText, path: '/reimbursements/review' });
  }
  if (auth.isReimbursementApprover || auth.isSuppliesManager || auth.isChemicalsManager) {
    reimbursementItems.push({ label: '报销统计', icon: BarChart3, path: '/reimbursements/stats' });
  }
  if (reimbursementItems.length > 0) {
    groups.push({ label: '报销管理', icon: FileText, colorScheme: 'yellow', items: reimbursementItems });
  }

  // 耗材管理分组
  if (auth.isSuppliesManager) {
    groups.push({
      label: '耗材管理',
      icon: Package,
      colorScheme: 'blue',
      items: [
        { label: '申领审批', icon: ClipboardCheck, path: '/supplies/review' },
        { label: '库存管理', icon: Package, path: '/admin/supplies' },
        { label: '借用管理', icon: Package, path: '/supplies/borrowings' },
      ],
    });
  }

  // 药品管理分组
  if (auth.isChemicalsManager) {
    groups.push({
      label: '药品管理',
      icon: FlaskConical,
      colorScheme: 'purple',
      items: [
        { label: '药品库存', icon: FlaskConical, path: '/reagents/new' },
        { label: '补货管理', icon: AlertTriangle, path: '/reagents/warnings' },
      ],
    });
  }

  // 系统管理分组
  if (auth.isAdmin) {
    groups.push({
      label: '系统管理',
      icon: Settings,
      colorScheme: 'gray',
      items: [
        { label: '公告管理', icon: Bell, path: '/admin/announcements' },
        { label: '人员管理', icon: User, path: '/admin/members' },
        { label: '数据导出', icon: BarChart3, path: '/admin/export' },
      ],
    });
  }

  return { standalone, groups };
}
```

- [ ] **Step 3: 更新组件内变量引用**

在 `Layout` 组件内，将旧的 `manageItems` 替换为新的 `manageConfig`。找到第89行：

```typescript
// 旧代码
const manageItems = hasManagePermission ? getManageItems(auth) : [];
```

替换为：

```typescript
// 新代码
const manageConfig = hasManagePermission ? getManageConfig(auth) : { standalone: [], groups: [] };
const hasManageItems = manageConfig.standalone.length > 0 || manageConfig.groups.length > 0;
```

然后将所有 `manageItems.length > 0` 替换为 `hasManageItems`（出现在第86行和第136行附近）。

- [ ] **Step 4: 运行开发服务器确认无编译错误**

Run: `cd /Users/xiaomai/Claude/lab-management && npx vite build 2>&1 | head -20`
Expected: 编译成功（可能有渲染层面的问题，但不应有 TypeScript 错误）

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "refactor: replace flat manage items with grouped config"
```

---

### Task 2: 改造手机端管理面板渲染

**Files:**
- Modify: `src/components/Layout.tsx:239-269`

- [ ] **Step 1: 替换手机端管理面板的 grid 渲染**

找到手机端管理面板部分（`{/* Mobile 管理面板（从顶部展开） */}` 注释后面，约第239-269行），将整个 `{showManagePanel && (...)}` 块替换为：

```tsx
{showManagePanel && (
  <>
    <div className="md:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setShowManagePanel(false)} />
    <div className="md:hidden fixed top-14 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-lg animate-slide-up max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-900">管理功能</p>
        <button onClick={() => setShowManagePanel(false)} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 space-y-4">
        {/* 独立入口（采购审批） */}
        {manageConfig.standalone.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setShowManagePanel(false); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                <Icon className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-green-800">{item.label}</div>
                <div className="text-[10px] text-green-600">审批学生采购申请</div>
              </div>
            </button>
          );
        })}

        {/* 分组 */}
        {manageConfig.groups.map((group) => {
          const colors = GROUP_COLORS[group.colorScheme];
          return (
            <div key={group.label}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 px-0.5 ${colors.label}`}>
                {group.label}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setShowManagePanel(false); }}
                      className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border transition-colors ${colors.bg} ${colors.border} hover:opacity-80`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.iconBg}`}>
                        <Icon className={`w-4 h-4 ${colors.iconText}`} />
                      </div>
                      <span className={`text-[10px] font-medium ${colors.label} text-center leading-tight`}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </>
)}
```

- [ ] **Step 2: 运行开发服务器确认编译通过**

Run: `cd /Users/xiaomai/Claude/lab-management && npx vite build 2>&1 | head -20`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat: render grouped management panel on mobile"
```

---

### Task 3: 改造桌面端侧边栏渲染

**Files:**
- Modify: `src/components/Layout.tsx:136-158`

- [ ] **Step 1: 替换桌面端侧边栏管理功能部分**

找到侧边栏的管理入口部分（`{/* 管理入口（桌面侧边栏） */}` 注释后面，约第136-158行），将 `{hasManagePermission && manageItems.length > 0 && (...)}` 块替换为：

```tsx
{hasManagePermission && hasManageItems && (
  <>
    {/* 独立入口（采购审批） */}
    {manageConfig.standalone.length > 0 && (
      <>
        <div className="pt-3 pb-1 px-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">审批</p>
        </div>
        {manageConfig.standalone.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                active ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 ${active ? 'text-green-500' : 'text-gray-400'}`} />
              {item.label}
            </button>
          );
        })}
      </>
    )}

    {/* 分组 */}
    {manageConfig.groups.map((group) => {
      const colors = GROUP_COLORS[group.colorScheme];
      return (
        <div key={group.label}>
          <div className="pt-3 pb-1 px-1">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${colors.label}`}>{group.label}</p>
          </div>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active ? `${colors.activeBg} ${colors.activeText}` : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${active ? colors.iconText : 'text-gray-400'}`} />
                {item.label}
              </button>
            );
          })}
        </div>
      );
    })}
  </>
)}
```

- [ ] **Step 2: 运行开发服务器确认编译通过**

Run: `cd /Users/xiaomai/Claude/lab-management && npx vite build 2>&1 | head -20`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat: render grouped management sidebar on desktop"
```

---

### Task 4: 清理旧代码和验证

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: 确认旧的 `getManageItems` 函数已被移除**

在 `Layout.tsx` 中搜索 `getManageItems`，确认没有残留引用。如果有，删除。

- [ ] **Step 2: 确认旧的 `manageItems` 变量没有残留引用**

在 `Layout.tsx` 中搜索 `manageItems`（不是 `manageConfig` 或 `hasManageItems`），确认没有残留引用。

- [ ] **Step 3: 完整构建验证**

Run: `cd /Users/xiaomai/Claude/lab-management && npx vite build`
Expected: 编译成功，无错误，无 TypeScript 类型错误

- [ ] **Step 4: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "chore: clean up old flat manage items code"
```

---

### Task 5: 视觉验证

**Files:** 无代码变更

- [ ] **Step 1: 启动开发服务器**

Run: `cd /Users/xiaomai/Claude/lab-management && npm run dev`

- [ ] **Step 2: 手机端验证**

用浏览器开发者工具切换到手机视图（375px 宽度），登录不同角色账号验证：

1. **超管账号（fengyujie@lab）**：应看到采购审批独立入口 + 报销管理、耗材管理、药品管理、系统管理四个分组
2. **耗材专人**：应看到采购审批 + 报销管理（仅报销统计）+ 耗材管理
3. **学生**：不应看到管理按钮

- [ ] **Step 3: 桌面端验证**

切换到桌面视图（1024px+），验证侧边栏分组标题和颜色正确显示。

- [ ] **Step 4: 确认无问题后标记完成**

如果发现视觉问题，在此 task 中修复并提交。

# 药品学生登记功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有用户（包括学生）可以登记新药品或为已有药品增加库存，表单按角色简化显示。

**Architecture:** 复用现有 ReagentForm 组件，通过 `isChemicalsManager` 判断角色，动态切换"精简模式"和"完整模式"。新增"增加库存"模式，选中同名药品后只更新 stock 字段。路由权限放开，编辑权限不变。

**Tech Stack:** React, Supabase, TypeScript, Tailwind CSS

---

### Task 1: 放开路由权限 + 列表页按钮

**Files:**
- Modify: `src/App.tsx:83`
- Modify: `src/pages/reagents/ReagentList.tsx:96,402-410`

- [ ] **Step 1: 放开 `/reagents/new` 路由权限**

在 `src/App.tsx` 第 83 行，移除 ProtectedRoute 包裹：

```tsx
// 改前:
<Route path="/reagents/new" element={<ProtectedRoute requiredModule="chemicals"><ReagentForm /></ProtectedRoute>} />

// 改后:
<Route path="/reagents/new" element={<ReagentForm />} />
```

注意：`/reagents/:id/edit` 的权限不变。

- [ ] **Step 2: 列表页"登记药品"按钮对所有用户可见**

在 `src/pages/reagents/ReagentList.tsx`，修改第 402-410 行的按钮区域：

```tsx
// 改前:
action={
  canManage ? (
    <button
      onClick={() => navigate('/reagents/new')}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
    >
      + 添加药品
    </button>
  ) : undefined
}

// 改后:
action={
  <button
    onClick={() => navigate('/reagents/new')}
    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
  >
    + 登记药品
  </button>
}
```

- [ ] **Step 3: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

Expected: 构建成功，无错误

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/reagents/ReagentList.tsx
git commit -m "放开药品登记权限，所有用户可新增药品"
```

---

### Task 2: ReagentForm 角色判断与精简模式

**Files:**
- Modify: `src/pages/reagents/ReagentForm.tsx`

- [ ] **Step 1: 引入权限判断**

在 `ReagentForm` 组件开头（第 73 行附近），修改 useAuth 解构并添加角色判断：

```tsx
// 改前:
const { } = useAuth();

// 改后:
const { isAdmin, canManageModule } = useAuth();
const isChemicalsManager = isAdmin || canManageModule('chemicals');
```

- [ ] **Step 2: 添加精简/展开状态**

在状态变量区域（第 82 行之后）添加：

```tsx
const [showMore, setShowMore] = useState(false);
```

- [ ] **Step 3: 重组"基本信息"卡片，按角色显示字段**

将第 362-461 行的"基本信息"Card 改为：

```tsx
<Card>
  <h3 className="mb-4 font-medium text-gray-900">基本信息</h3>
  <div className="grid gap-4 sm:grid-cols-2">
    {/* 所有用户可见：名称 */}
    <FormField label="药品名称" required>
      <input
        type="text"
        value={form.name}
        onChange={(e) => updateField('name', e.target.value)}
        className="input"
        placeholder="如: 硝酸"
        required
      />
      {nameSuggestions.length > 0 && (
        <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm">
          <p className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-100">已有相似药品</p>
          {nameSuggestions.map((s, i) => (
            <div key={i} className="px-3 py-1.5 text-xs text-gray-600 flex items-center gap-2 border-b border-gray-50 last:border-0">
              <span className="font-medium text-gray-900">{s.name}</span>
              {s.batch_number && <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold">{s.batch_number}</span>}
              {s.specification && <span className="text-gray-400">{s.specification}</span>}
            </div>
          ))}
        </div>
      )}
    </FormField>

    {/* 所有用户可见：规格 */}
    <FormField label="规格">
      <input
        type="text"
        value={form.specification}
        onChange={(e) => updateField('specification', e.target.value)}
        className="input"
        placeholder="如 500mL, 25g"
      />
    </FormField>

    {/* 管理员直接显示 / 学生折叠 */}
    {(isChemicalsManager || showMore) && (
      <>
        <FormField label="CAS号" hint="如 7697-37-2">
          <input
            type="text"
            value={form.cas_number}
            onChange={(e) => updateField('cas_number', e.target.value)}
            onBlur={handleCasBlur}
            className="input"
            placeholder="如 7697-37-2"
          />
        </FormField>

        <FormField label="分子式">
          <input
            type="text"
            value={form.molecular_formula}
            onChange={(e) => updateField('molecular_formula', e.target.value)}
            className="input"
            placeholder="如 HNO3"
          />
        </FormField>

        <FormField label="分类">
          <select
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
            className="input"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </FormField>

        <FormField label="浓度">
          <input
            type="text"
            value={form.concentration}
            onChange={(e) => updateField('concentration', e.target.value)}
            className="input"
            placeholder="如 65-68%"
          />
        </FormField>

        <FormField label="纯度">
          <input
            type="text"
            value={form.purity}
            onChange={(e) => updateField('purity', e.target.value)}
            className="input"
            placeholder="如 AR, GR, CP"
          />
        </FormField>

        <FormField label="厂家">
          <input
            type="text"
            value={form.manufacturer}
            onChange={(e) => updateField('manufacturer', e.target.value)}
            className="input"
            placeholder="如 国药集团"
          />
        </FormField>
      </>
    )}
  </div>

  {/* 学生模式下的展开按钮 */}
  {!isChemicalsManager && !showMore && (
    <button
      type="button"
      onClick={() => setShowMore(true)}
      className="mt-3 text-xs text-blue-600 hover:text-blue-800"
    >
      更多信息（选填）▼
    </button>
  )}
</Card>
```

- [ ] **Step 4: 重组"供应与库存"卡片**

将"供应与库存"Card 中，供应商、最低库存、有效期、价格、MSDS 等字段用同样的 `{(isChemicalsManager || showMore) && (...)}` 包裹。

始终显示的字段：库存数量（必填）、存放位置（必填）、编号区域选择、单位。

在编号区域选择部分，学生不能自定义前缀且编号不可手动修改：

```tsx
<FormField label="编号">
  <div className="flex flex-wrap gap-1.5 mb-2">
    {['A', 'B', 'C', 'D'].map(p => (
      <button
        key={p}
        type="button"
        disabled={generatingBatch}
        onClick={() => generateBatchNumber(p)}
        className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
          batchPrefix === p
            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
      >
        {p}
      </button>
    ))}
    {/* 管理员可自定义前缀 */}
    {isChemicalsManager && (
      <input
        type="text"
        placeholder="自定义前缀"
        className="w-20 px-2 py-1 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); generateBatchNumber((e.target as HTMLInputElement).value); } }}
        onBlur={e => { if (e.target.value.trim()) generateBatchNumber(e.target.value); }}
      />
    )}
  </div>
  <input
    type="text"
    value={form.batch_number}
    onChange={(e) => updateField('batch_number', e.target.value)}
    className="input"
    placeholder="选择区域自动生成"
    readOnly={!isChemicalsManager}
  />
</FormField>
```

- [ ] **Step 5: GHS 卡片按角色折叠**

将 GHS Card 整体用 `{(isChemicalsManager || showMore) && (...)}` 包裹。

- [ ] **Step 6: 修改页面标题**

```tsx
// 改前:
<PageHeader title={isEdit ? '编辑药品' : '添加药品'} />

// 改后:
<PageHeader title={isEdit ? '编辑药品' : '登记药品'} />
```

- [ ] **Step 7: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

Expected: 构建成功

- [ ] **Step 8: Commit**

```bash
git add src/pages/reagents/ReagentForm.tsx
git commit -m "ReagentForm 按角色动态显示字段，学生精简模式"
```

---

### Task 3: 同名药品搜索增强 + 增加库存模式

**Files:**
- Modify: `src/pages/reagents/ReagentForm.tsx`

- [ ] **Step 1: 扩展搜索结果类型，添加增加库存状态**

在组件状态区域添加：

```tsx
// 扩展搜索结果，包含 id, stock, unit
const [nameSuggestions, setNameSuggestions] = useState<{
  id: string;
  name: string;
  specification: string;
  batch_number: string | null;
  stock: number;
  unit: string;
}[]>([]);

// 增加库存模式
const [stockMode, setStockMode] = useState<{
  id: string;
  name: string;
  batch_number: string;
  currentStock: number;
  unit: string;
} | null>(null);
const [addStockAmount, setAddStockAmount] = useState<number>(0);
```

- [ ] **Step 2: 修改搜索查询，返回更多字段**

在 `updateField` 函数的名称搜索部分（约第 161-169 行），修改查询：

```tsx
const timer = setTimeout(async () => {
  const { data } = await supabase
    .from('chemicals')
    .select('id, name, specification, batch_number, stock, unit')
    .ilike('name', `%${keyword}%`)
    .limit(8);
  if (data) setNameSuggestions(data);
}, 300);
```

- [ ] **Step 3: 添加 CAS 号搜索**

在搜索逻辑中，同时支持 CAS 号精确匹配。在 `updateField` 中 `cas_number` 变化时也触发搜索：

```tsx
if (key === 'cas_number' && typeof value === 'string') {
  const cas = (value as string).trim();
  if (cas.length >= 5) {
    const { data } = await supabase
      .from('chemicals')
      .select('id, name, specification, batch_number, stock, unit')
      .eq('cas_number', cas)
      .limit(5);
    if (data && data.length > 0) {
      setNameSuggestions(data);
    }
  }
}
```

- [ ] **Step 4: 搜索结果改为可点击，支持选中进入增加库存模式**

替换搜索结果 UI（名称字段下方的下拉列表）：

```tsx
{nameSuggestions.length > 0 && !stockMode && (
  <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm">
    <p className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-100">
      已有相似药品（点击可直接增加库存）
    </p>
    {nameSuggestions.map((s) => (
      <button
        key={s.id}
        type="button"
        onClick={() => {
          setStockMode({
            id: s.id,
            name: s.name,
            batch_number: s.batch_number || '',
            currentStock: s.stock,
            unit: s.unit || '瓶',
          });
          setAddStockAmount(0);
          setNameSuggestions([]);
        }}
        className="w-full px-3 py-2 text-xs text-left text-gray-600 flex items-center gap-2 border-b border-gray-50 last:border-0 hover:bg-blue-50 transition-colors"
      >
        <span className="font-medium text-gray-900">{s.name}</span>
        {s.batch_number && (
          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold">
            {s.batch_number}
          </span>
        )}
        {s.specification && <span className="text-gray-400">{s.specification}</span>}
        <span className="ml-auto text-gray-400">库存 {s.stock}{s.unit}</span>
      </button>
    ))}
    <button
      type="button"
      onClick={() => setNameSuggestions([])}
      className="w-full px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-100"
    >
      添加为新药品
    </button>
  </div>
)}
```

- [ ] **Step 5: 增加库存模式 UI**

在表单开头（`<form>` 标签内，第一个 Card 之前）添加增加库存模式的 UI，当 `stockMode` 不为 null 时显示，替代整个新增表单：

```tsx
{stockMode ? (
  <Card>
    <h3 className="mb-4 font-medium text-gray-900">增加库存</h3>
    <div className="space-y-4">
      <div className="bg-gray-50 p-3 rounded-lg space-y-2">
        <div className="flex justify-between">
          <span className="text-xs text-gray-500">药品名称</span>
          <span className="text-sm font-medium">{stockMode.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-gray-500">编号</span>
          <span className="text-sm font-bold text-indigo-600">{stockMode.batch_number || '无'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-gray-500">当前库存</span>
          <span className="text-sm">{stockMode.currentStock} {stockMode.unit}</span>
        </div>
      </div>

      <FormField label="新增数量" required>
        <input
          type="number"
          min={1}
          value={addStockAmount || ''}
          onChange={(e) => setAddStockAmount(parseInt(e.target.value) || 0)}
          className="input"
          placeholder="输入新增数量"
        />
      </FormField>

      {addStockAmount > 0 && (
        <div className="bg-green-50 p-3 rounded-lg text-sm text-green-800">
          添加后总库存: {stockMode.currentStock} + {addStockAmount} = <strong>{stockMode.currentStock + addStockAmount}</strong> {stockMode.unit}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving || addStockAmount <= 0}
          onClick={handleStockAdd}
          className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? '提交中...' : '确认增加库存'}
        </button>
        <button
          type="button"
          onClick={() => { setStockMode(null); setAddStockAmount(0); }}
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          取消，添加为新药品
        </button>
      </div>
    </div>
  </Card>
) : (
  /* 现有的新增药品表单（所有 Card 都放在这里） */
  <>
    {/* 基本信息 Card */}
    {/* 供应与库存 Card */}
    {/* GHS Card */}
    {/* 提交按钮 */}
  </>
)}
```

- [ ] **Step 6: 实现 handleStockAdd 函数**

在组件内添加增加库存的提交函数：

```tsx
async function handleStockAdd() {
  if (!stockMode || addStockAmount <= 0) return;
  try {
    setSaving(true);
    setError(null);

    const newStock = stockMode.currentStock + addStockAmount;
    const { error: updateErr } = await supabase
      .from('chemicals')
      .update({ stock: newStock })
      .eq('id', stockMode.id);

    if (updateErr) throw updateErr;

    // 写审计日志
    await auditLog({
      action: 'stock_add',
      targetTable: 'chemicals',
      targetId: stockMode.id,
      details: {
        name: stockMode.name,
        batch_number: stockMode.batch_number,
        added: addStockAmount,
        before: stockMode.currentStock,
        after: newStock,
      },
    });

    navigate(`/reagents/${stockMode.id}`);
  } catch (err: any) {
    setError(err.message || '更新库存失败');
  } finally {
    setSaving(false);
  }
}
```

- [ ] **Step 7: 导入 auditLog**

在文件顶部添加：

```tsx
import { auditLog } from '../../lib/auditLog';
```

- [ ] **Step 8: 在新增药品的 handleSubmit 中也添加审计日志**

在 `handleSubmit` 函数的成功分支（`navigate` 之前）添加：

```tsx
if (!isEdit) {
  await auditLog({
    action: 'create',
    targetTable: 'chemicals',
    targetId: result.data.id,
    details: { name: form.name.trim(), batch_number: form.batch_number.trim() || null },
  });
}
```

- [ ] **Step 9: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

Expected: 构建成功

- [ ] **Step 10: Commit**

```bash
git add src/pages/reagents/ReagentForm.tsx
git commit -m "药品登记：同名搜索增强 + 增加库存模式 + 审计日志"
```

---

### Task 4: 部署与验证

**Files:**
- 无新文件

- [ ] **Step 1: 完整构建**

```bash
npx vite build 2>&1 | tail -5
```

Expected: 构建成功

- [ ] **Step 2: 推送到 GitHub**

```bash
git push origin main
```

- [ ] **Step 3: 部署到 Cloudflare Pages**

```bash
wrangler pages deploy dist --project-name=lab-management --commit-dirty=true --commit-message="Add student reagent registration feature"
```

Expected: Deployment complete

- [ ] **Step 4: 验证线上功能**

```bash
curl -s "https://lab-management-3w7.pages.dev" | grep -o 'index-[^"]*\.js'
ls dist/assets/index-*.js
```

Expected: 两个哈希一致，确认部署成功

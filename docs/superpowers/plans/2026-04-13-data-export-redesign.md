# 数据导出重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构数据导出页面：支持多 Sheet 全量导出、新增 3 个导出项、新增操作日志浏览 Tab。

**Architecture:** 改造 `exportExcel.ts` 新增多 Sheet 函数；重写 `DataExport.tsx` 为 Tab 页面，数据获取逻辑抽到 `exportDataFetchers.ts`；新增 `AuditLogTab.tsx` 组件。

**Tech Stack:** React, TypeScript, Supabase, xlsx, Tailwind CSS

---

### Task 1: exportExcel.ts — 新增多 Sheet 导出 + 修复空数据

**Files:**
- Modify: `src/lib/exportExcel.ts`

- [ ] **Step 1: 修改 downloadExcel 支持空数据**

在 `src/lib/exportExcel.ts`，移除第 14 行的空数据返回：

```tsx
// 改前:
if (data.length === 0) return;

// 改后: 删除这行
```

并修改第 21-31 行的列宽计算，处理空数据情况：

```tsx
// 在 const ws = XLSX.utils.json_to_sheet(data); 之后：
if (data.length > 0) {
  const headers = Object.keys(data[0]);
  ws['!cols'] = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...data.map((row) => {
        const val = row[h];
        return val === null || val === undefined ? 0 : String(val).length;
      })
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
}
```

- [ ] **Step 2: 新增 downloadMultiSheetExcel 函数**

在文件末尾添加：

```tsx
/**
 * 导出多 Sheet Excel 文件
 * @param sheets 每个 sheet 的名称和数据
 * @param filename 文件名（不含扩展名）
 */
export function downloadMultiSheetExcel(
  sheets: { name: string; data: Record<string, unknown>[] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data);

    if (sheet.data.length > 0) {
      const headers = Object.keys(sheet.data[0]);
      ws['!cols'] = headers.map((h) => {
        const maxLen = Math.max(
          h.length,
          ...sheet.data.map((row) => {
            const val = row[h];
            return val === null || val === undefined ? 0 : String(val).length;
          })
        );
        return { wch: Math.min(maxLen + 2, 40) };
      });
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
```

- [ ] **Step 3: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/exportExcel.ts
git commit -m "exportExcel: 新增多 Sheet 导出，修复空数据不下载的问题"
```

---

### Task 2: 数据获取逻辑抽取到 exportDataFetchers.ts

**Files:**
- Create: `src/lib/exportDataFetchers.ts`

- [ ] **Step 1: 创建 exportDataFetchers.ts**

创建 `src/lib/exportDataFetchers.ts`，将所有导出的数据获取逻辑集中在一个文件中。每个函数返回 `{ name: string; data: Record<string, unknown>[] }`。

```tsx
import { supabase } from './supabase';

export async function fetchSupplies() {
  const { data, error } = await supabase
    .from('supplies')
    .select('name, specification, stock, unit, min_stock, category:supply_categories(name), updated_at')
    .order('name');
  if (error) throw error;
  return {
    name: '耗材库存',
    data: (data ?? []).map((s: Record<string, unknown>) => ({
      '名称': s.name,
      '规格': s.specification,
      '库存': s.stock,
      '单位': s.unit,
      '最低库存': s.min_stock,
      '分类': (s.category as Record<string, unknown>)?.name ?? '',
      '更新时间': s.updated_at,
    })),
  };
}

export async function fetchReservations() {
  const { data, error } = await supabase
    .from('supply_reservations')
    .select('*, supply:supplies(name), user:profiles!user_id(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const reservationIds = (data ?? []).map((r: Record<string, unknown>) => r.id as string);
  let itemsByReservation: Record<string, { name: string; quantity: number }[]> = {};
  if (reservationIds.length > 0) {
    const { data: items } = await supabase
      .from('supply_reservation_items')
      .select('reservation_id, quantity, supply:supplies(name)')
      .in('reservation_id', reservationIds);
    if (items) {
      for (const item of items as any[]) {
        const rid = item.reservation_id as string;
        if (!itemsByReservation[rid]) itemsByReservation[rid] = [];
        itemsByReservation[rid].push({ name: item.supply?.name ?? '', quantity: item.quantity });
      }
    }
  }

  return {
    name: '耗材申领记录',
    data: (data ?? []).map((r: Record<string, unknown>) => {
      const rid = r.id as string;
      const items = itemsByReservation[rid];
      const itemsText = items && items.length > 0
        ? items.map(i => `${i.name}(${i.quantity})`).join(', ')
        : (r.supply as Record<string, unknown>)?.name ?? '';
      return {
        '物品明细': itemsText,
        '申请人': (r.user as Record<string, unknown>)?.name ?? '',
        '数量': r.quantity,
        '用途': r.purpose,
        '是否归还': r.is_returnable ? '是' : '否',
        '状态': r.status,
        '申请时间': r.created_at,
        '审批备注': r.review_note ?? '',
      };
    }),
  };
}

export async function fetchBorrowings() {
  const { data, error } = await supabase
    .from('supply_borrowings')
    .select('*, supply:supplies(name), user:profiles!user_id(name)')
    .order('borrowed_at', { ascending: false });
  if (error) throw error;
  return {
    name: '耗材借用记录',
    data: (data ?? []).map((b: Record<string, unknown>) => ({
      '物品名称': (b.supply as Record<string, unknown>)?.name ?? '',
      '借用人': (b.user as Record<string, unknown>)?.name ?? '',
      '数量': b.quantity,
      '用途': b.purpose,
      '状态': b.status === 'borrowed' ? '借用中' : b.status === 'returned' ? '已归还' : b.status === 'damaged' ? '已损坏' : b.status,
      '借出时间': b.borrowed_at,
      '归还时间': b.returned_at ?? '',
    })),
  };
}

export async function fetchChemicalInventory() {
  const { data, error } = await supabase
    .from('chemicals')
    .select('name, batch_number, cas_number, category, stock, unit, location, storage_location, molecular_formula, specification, purity, manufacturer, expiry_date, updated_at')
    .order('batch_number');
  if (error) throw error;
  const getZone = (bn: string | null) => {
    if (!bn) return '未编号';
    const prefix = bn.charAt(0).toUpperCase();
    const zones: Record<string, string> = { A: 'A区', B: 'B区', C: 'C区', D: 'D区' };
    return zones[prefix] ?? '上架';
  };
  return {
    name: '药品库存',
    data: (data ?? []).map((c: Record<string, unknown>) => ({
      '区域': getZone(c.batch_number as string | null),
      '编号': c.batch_number ?? '',
      '名称': c.name,
      'CAS号': c.cas_number ?? '',
      '规格': c.specification ?? '',
      '纯度': c.purity ?? '',
      '厂家': c.manufacturer ?? '',
      '库存': c.stock,
      '单位': c.unit,
      '存放位置': c.storage_location ?? c.location ?? '',
      '分类': c.category ?? '',
      '分子式': c.molecular_formula ?? '',
      '有效期': c.expiry_date ?? '',
      '更新时间': c.updated_at,
    })),
  };
}

export async function fetchChemicalUsage() {
  const { data, error } = await supabase
    .from('chemical_usage_logs')
    .select('*, chemical:chemicals(name), user:profiles!user_id(name)')
    .order('used_at', { ascending: false });
  if (error) throw error;
  return {
    name: '药品使用记录',
    data: (data ?? []).map((l: Record<string, unknown>) => ({
      '药品': (l.chemical as Record<string, unknown>)?.name ?? '',
      '使用人': (l.user as Record<string, unknown>)?.name ?? '',
      '用量': l.amount,
      '单位': l.unit,
      '用途': l.purpose,
      '使用时间': l.used_at,
    })),
  };
}

export async function fetchChemicalWarnings() {
  const { data, error } = await supabase
    .from('chemical_warnings')
    .select('*, chemical:chemicals(name, batch_number), reporter:profiles!reported_by(name)')
    .order('reported_at', { ascending: false });
  if (error) throw error;
  return {
    name: '药品补货记录',
    data: (data ?? []).map((w: Record<string, unknown>) => ({
      '药品名称': (w.chemical as Record<string, unknown>)?.name ?? '',
      '编号': (w.chemical as Record<string, unknown>)?.batch_number ?? '',
      '报告人': (w.reporter as Record<string, unknown>)?.name ?? '',
      '状态': w.status === 'pending' ? '待处理' : w.status === 'ordered' ? '已下单' : w.status === 'arrived' ? '已到货' : w.status,
      '报告时间': w.reported_at,
      '预计送达': w.estimated_delivery_date ?? '',
      '实际送达': w.arrived_at ?? '',
    })),
  };
}

export async function fetchPurchases() {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, applicant:profiles!purchases_applicant_id_fkey(name), approver:profiles!purchases_approver_id_fkey(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return {
    name: '采购记录',
    data: (data ?? []).map((p: Record<string, unknown>) => ({
      '申请人': (p.applicant as Record<string, unknown>)?.name ?? '',
      '标题': p.title,
      '类别': p.category,
      '采购类型': p.purchase_type === 'personal' ? '个人' : '公共',
      '预估金额': p.estimated_amount,
      '实际金额': p.actual_amount,
      '审批状态': p.approval_status,
      '审批人': (p.approver as Record<string, unknown>)?.name ?? '',
      '报销状态': p.reimbursement_status ?? '',
      '入库状态': p.skip_registration ? '无需登记' : (p.registration_status as string) === 'registered' ? '已登记' : '未登记',
      '日期': p.created_at,
    })),
  };
}

export async function fetchAuditLog(userId?: string) {
  let query = supabase
    .from('audit_log')
    .select('*, user:profiles!audit_log_user_id_fkey(name)')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return {
    name: '操作日志',
    data: (data ?? []).map((a: Record<string, unknown>) => ({
      '操作人': (a.user as Record<string, unknown>)?.name ?? '',
      '操作类型': a.action,
      '目标表': a.target_table,
      '详情': a.details ? JSON.stringify(a.details) : '',
      '时间': a.created_at,
    })),
  };
}

/** 获取所有导出数据（全量导出用） */
export async function fetchAllExportData(auditLogUserId?: string) {
  const results = await Promise.all([
    fetchSupplies(),
    fetchReservations(),
    fetchBorrowings(),
    fetchChemicalInventory(),
    fetchChemicalUsage(),
    fetchChemicalWarnings(),
    fetchPurchases(),
    fetchAuditLog(auditLogUserId),
  ]);
  return results;
}
```

- [ ] **Step 2: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/exportDataFetchers.ts
git commit -m "新增 exportDataFetchers：集中所有导出数据获取逻辑"
```

---

### Task 3: 重写 DataExport.tsx — Tab 页面 + 全量导出

**Files:**
- Modify: `src/pages/admin/DataExport.tsx`

- [ ] **Step 1: 完整重写 DataExport.tsx**

将整个 `src/pages/admin/DataExport.tsx` 重写。新版本包含：
- Tab 切换（数据导出 / 操作日志）
- 全量导出按钮
- 8 个单独导出卡片（修正命名，新增 3 个）
- 操作日志 Tab 用 lazy import

```tsx
import { useState } from 'react';
import {
  Package,
  ClipboardList,
  FlaskConical,
  Receipt,
  Download,
  CheckCircle,
  FileSpreadsheet,
  ArrowLeftRight,
  AlertTriangle,
  ScrollText,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { downloadExcel, downloadMultiSheetExcel } from '../../lib/exportExcel';
import {
  fetchSupplies,
  fetchReservations,
  fetchBorrowings,
  fetchChemicalInventory,
  fetchChemicalUsage,
  fetchChemicalWarnings,
  fetchPurchases,
  fetchAuditLog,
  fetchAllExportData,
} from '../../lib/exportDataFetchers';
import PageHeader from '../../components/PageHeader';
import AuditLogTab from './AuditLogTab';

interface ExportCard {
  key: string;
  title: string;
  description: string;
  icon: typeof Package;
  color: string;
  fetcher: () => Promise<{ name: string; data: Record<string, unknown>[] }>;
}

type TabKey = 'export' | 'audit';

export default function DataExport() {
  const { profile, isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<TabKey>('export');
  const [exporting, setExporting] = useState<string | null>(null);
  const [exported, setExported] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const exportCards: ExportCard[] = [
    { key: 'supplies', title: '耗材库存', description: '导出所有耗材的库存信息', icon: Package, color: 'bg-blue-50 text-blue-600', fetcher: fetchSupplies },
    { key: 'reservations', title: '耗材申领记录', description: '导出所有耗材申领记录', icon: ClipboardList, color: 'bg-green-50 text-green-600', fetcher: fetchReservations },
    { key: 'borrowings', title: '耗材借用记录', description: '导出物资借用与归还记录', icon: ArrowLeftRight, color: 'bg-teal-50 text-teal-600', fetcher: fetchBorrowings },
    { key: 'chemical_inventory', title: '药品库存', description: '导出药品库存（按区域编号）', icon: FlaskConical, color: 'bg-indigo-50 text-indigo-600', fetcher: fetchChemicalInventory },
    { key: 'chemical_usage', title: '药品使用记录', description: '导出药品使用日志', icon: FlaskConical, color: 'bg-purple-50 text-purple-600', fetcher: fetchChemicalUsage },
    { key: 'chemical_warnings', title: '药品补货记录', description: '导出药品补货与到货记录', icon: AlertTriangle, color: 'bg-orange-50 text-orange-600', fetcher: fetchChemicalWarnings },
    { key: 'purchases', title: '采购记录', description: '导出所有采购申请与审批记录', icon: Receipt, color: 'bg-amber-50 text-amber-600', fetcher: fetchPurchases },
    { key: 'audit_log', title: '操作日志', description: '导出系统操作日志', icon: ScrollText, color: 'bg-gray-100 text-gray-600', fetcher: () => fetchAuditLog(isSuperAdmin ? undefined : profile?.id) },
  ];

  async function handleSingleExport(card: ExportCard) {
    setExporting(card.key);
    setError(null);
    try {
      const result = await card.fetcher();
      downloadExcel(result.data, result.name);
      setExported((prev) => new Set([...prev, card.key]));
    } catch (err) {
      console.error('Export failed:', err);
      setError('导出失败，请重试');
    } finally {
      setExporting(null);
    }
  }

  async function handleFullExport() {
    setExporting('__all__');
    setError(null);
    try {
      const sheets = await fetchAllExportData(isSuperAdmin ? undefined : profile?.id);
      downloadMultiSheetExcel(sheets, '实验室管理系统数据导出');
      setExported((prev) => new Set([...prev, '__all__']));
    } catch (err) {
      console.error('Full export failed:', err);
      setError('全量导出失败，请重试');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <PageHeader title="数据管理" subtitle="导出数据与查看操作日志" />

      <div className="px-4 md:px-6 pb-6">
        {/* Tab 切换 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('export')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'export' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            数据导出
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'audit' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            操作日志
          </button>
        </div>

        {tab === 'export' && (
          <>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 全量导出 */}
            <div className="mb-4">
              <button
                onClick={handleFullExport}
                disabled={exporting !== null}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
              >
                {exporting === '__all__' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    全量导出中...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    全量导出（所有数据合并为一个 Excel）
                  </>
                )}
              </button>
            </div>

            {/* 单独导出卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {exportCards.map((card) => {
                const Icon = card.icon;
                const isExporting = exporting === card.key;
                const isExported = exported.has(card.key);

                return (
                  <div key={card.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSingleExport(card)}
                      disabled={exporting !== null}
                      className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        isExported ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isExporting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                          导出中...
                        </>
                      ) : isExported ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          重新导出
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          下载 Excel
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'audit' && <AuditLogTab />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

此时会报错因为 AuditLogTab 还不存在。先创建一个占位：

```tsx
// src/pages/admin/AuditLogTab.tsx
export default function AuditLogTab() {
  return <div className="text-sm text-gray-500">加载中...</div>;
}
```

```bash
npx vite build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/DataExport.tsx src/pages/admin/AuditLogTab.tsx
git commit -m "重写 DataExport：Tab 页面 + 全量导出 + 8 个导出项"
```

---

### Task 4: AuditLogTab — 操作日志浏览与导出

**Files:**
- Modify: `src/pages/admin/AuditLogTab.tsx`

- [ ] **Step 1: 实现完整的 AuditLogTab**

重写 `src/pages/admin/AuditLogTab.tsx`：

```tsx
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Download, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { downloadExcel } from '../../lib/exportExcel';
import LoadingSpinner from '../../components/LoadingSpinner';

interface AuditEntry {
  id: string;
  action: string;
  target_table: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  user: { name: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  create: '新建',
  approve: '批准',
  reject: '拒绝',
  recall: '撤回',
  stock_add: '增加库存',
  update: '更新',
  delete: '删除',
};

const TABLE_LABELS: Record<string, string> = {
  chemicals: '药品',
  purchases: '采购',
  supply_reservations: '物资申领',
  supply_borrowings: '物资借用',
  profiles: '用户',
};

const TIME_FILTERS = [
  { label: '最近 7 天', value: 7 },
  { label: '最近 30 天', value: 30 },
  { label: '全部', value: 0 },
];

export default function AuditLogTab() {
  const { profile, isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState(30);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, timeFilter]);

  async function fetchLogs() {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('audit_log')
        .select('id, action, target_table, target_id, details, created_at, user:profiles!audit_log_user_id_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(200);

      // 权限过滤
      if (!isSuperAdmin) {
        query = query.eq('user_id', profile.id);
      }

      // 操作类型筛选
      if (actionFilter) {
        query = query.eq('action', actionFilter);
      }

      // 时间范围筛选
      if (timeFilter > 0) {
        const since = dayjs().subtract(timeFilter, 'day').toISOString();
        query = query.gte('created_at', since);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setLogs((data as AuditEntry[]) ?? []);
    } catch (err: any) {
      setError(err.message || '加载日志失败');
    } finally {
      setLoading(false);
    }
  }

  function formatDetails(details: Record<string, unknown> | null): string {
    if (!details) return '';
    const parts: string[] = [];
    if (details.name) parts.push(String(details.name));
    if (details.title) parts.push(String(details.title));
    if (details.batch_number) parts.push(`编号 ${details.batch_number}`);
    if (details.added != null) parts.push(`+${details.added} (${details.before}→${details.after})`);
    if (details.note) parts.push(`备注: ${details.note}`);
    return parts.join(' · ') || JSON.stringify(details);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const rows = logs.map((a) => ({
        '操作人': a.user?.name ?? '',
        '操作类型': ACTION_LABELS[a.action] ?? a.action,
        '目标': TABLE_LABELS[a.target_table] ?? a.target_table,
        '详情': formatDetails(a.details),
        '时间': dayjs(a.created_at).format('YYYY-MM-DD HH:mm:ss'),
      }));
      downloadExcel(rows, '操作日志');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部操作</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1.5">
          {TIME_FILTERS.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeFilter(tf.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                timeFilter === tf.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || logs.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? '导出中...' : '导出当前结果'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* 日志列表 */}
      {loading ? (
        <LoadingSpinner />
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">暂无操作日志</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="bg-white border border-gray-100 rounded-lg p-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{log.user?.name ?? '未知'}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    log.action === 'approve' ? 'bg-green-50 text-green-700' :
                    log.action === 'reject' ? 'bg-red-50 text-red-700' :
                    log.action === 'create' ? 'bg-blue-50 text-blue-700' :
                    log.action === 'stock_add' ? 'bg-indigo-50 text-indigo-700' :
                    log.action === 'recall' ? 'bg-orange-50 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  <span className="text-xs text-gray-400">
                    {TABLE_LABELS[log.target_table] ?? log.target_table}
                  </span>
                </div>
                {log.details && (
                  <p className="text-xs text-gray-500 mt-1">{formatDetails(log.details)}</p>
                )}
              </div>
              <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                {dayjs(log.created_at).format('MM-DD HH:mm')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AuditLogTab.tsx
git commit -m "AuditLogTab: 操作日志浏览，支持筛选和导出"
```

---

### Task 5: 部署与验证

**Files:** 无

- [ ] **Step 1: 推送到 GitHub**

```bash
git push origin main
```

- [ ] **Step 2: 部署到 Cloudflare Pages**

```bash
npx vite build && wrangler pages deploy dist --project-name=lab-management --commit-dirty=true --commit-message="Data export redesign with multi-sheet and audit log"
```

- [ ] **Step 3: 验证**

```bash
curl -s "https://lab-management-3w7.pages.dev" | grep -o 'index-[^"]*\.js'
ls dist/assets/index-*.js
```

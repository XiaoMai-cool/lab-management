# 操作日志详情弹窗 + 附件图片预览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 操作日志条目可点击查看完整记录详情和操作时间线；所有附件展示统一为图片内联预览 + 非图片外链。

**Architecture:** 新建 FilePreview 组件统一附件展示，新建 AuditDetailModal 弹窗根据 target_table 动态查询并展示记录详情 + 操作时间线，然后将审批详情弹窗中的附件替换为 FilePreview。

**Tech Stack:** React, TypeScript, Supabase, Tailwind CSS, dayjs

---

### Task 1: FilePreview 组件

**Files:**
- Create: `src/components/FilePreview.tsx`

- [ ] **Step 1: 创建 FilePreview 组件**

创建 `src/components/FilePreview.tsx`：

```tsx
import { useState } from 'react';
import { FileText, ExternalLink, X } from 'lucide-react';

interface FileItem {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

interface FilePreviewProps {
  files: FileItem[];
  title?: string;
}

function isImage(file: FileItem): boolean {
  if (file.type?.startsWith('image/')) return true;
  const ext = file.url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
}

export default function FilePreview({ files, title }: FilePreviewProps) {
  const [expandedImg, setExpandedImg] = useState<string | null>(null);

  if (files.length === 0) return null;

  return (
    <>
      <div>
        {title && (
          <p className="text-xs font-medium text-gray-500 mb-1.5">
            {title}（{files.length}）
          </p>
        )}
        <div className="space-y-1.5">
          {files.map((file, idx) =>
            isImage(file) ? (
              <div key={idx} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setExpandedImg(file.url)}
                  className="block rounded-lg overflow-hidden border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer"
                >
                  <img
                    src={file.url}
                    alt={file.name}
                    className="max-h-48 w-auto object-contain bg-gray-50"
                    loading="lazy"
                  />
                </button>
                <p className="text-[10px] text-gray-400 truncate">{file.name}</p>
              </div>
            ) : (
              <a
                key={idx}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs hover:bg-gray-100 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-gray-700 truncate flex-1">{file.name}</span>
                <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
              </a>
            )
          )}
        </div>
      </div>

      {/* Fullscreen image overlay */}
      {expandedImg && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedImg(null)}
        >
          <button
            onClick={() => setExpandedImg(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={expandedImg}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/FilePreview.tsx
git commit -m "新建 FilePreview 组件：图片内联预览 + 非图片外链"
```

---

### Task 2: AuditDetailModal 组件

**Files:**
- Create: `src/components/AuditDetailModal.tsx`

- [ ] **Step 1: 创建 AuditDetailModal 组件**

创建 `src/components/AuditDetailModal.tsx`：

```tsx
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import FilePreview from './FilePreview';
import LoadingSpinner from './LoadingSpinner';

interface AuditDetailModalProps {
  open: boolean;
  onClose: () => void;
  targetTable: string;
  targetId: string;
}

interface TimelineEntry {
  id: string;
  action: string;
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

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-blue-500',
  approve: 'bg-green-500',
  reject: 'bg-red-500',
  recall: 'bg-orange-500',
  stock_add: 'bg-indigo-500',
  update: 'bg-gray-500',
  delete: 'bg-red-700',
};

export default function AuditDetailModal({ open, onClose, targetTable, targetId }: AuditDetailModalProps) {
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && targetId) {
      loadData();
    }
  }, [open, targetTable, targetId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch the target record
      let recordQuery;
      switch (targetTable) {
        case 'purchases':
          recordQuery = supabase.from('purchases')
            .select('*, applicant:profiles!purchases_applicant_id_fkey(name), approver:profiles!purchases_approver_id_fkey(name)')
            .eq('id', targetId).single();
          break;
        case 'chemicals':
          recordQuery = supabase.from('chemicals')
            .select('*')
            .eq('id', targetId).single();
          break;
        case 'supply_reservations':
          recordQuery = supabase.from('supply_reservations')
            .select('*, supply:supplies(name), user:profiles!user_id(name)')
            .eq('id', targetId).single();
          break;
        case 'supply_borrowings':
          recordQuery = supabase.from('supply_borrowings')
            .select('*, supply:supplies(name), user:profiles!user_id(name)')
            .eq('id', targetId).single();
          break;
        case 'profiles':
          recordQuery = supabase.from('profiles')
            .select('name, email, role, managed_modules')
            .eq('id', targetId).single();
          break;
        default:
          recordQuery = null;
      }

      const [recordResult, timelineResult] = await Promise.all([
        recordQuery,
        supabase
          .from('audit_log')
          .select('id, action, details, created_at, user:profiles!audit_log_user_id_fkey(name)')
          .eq('target_table', targetTable)
          .eq('target_id', targetId)
          .order('created_at', { ascending: true }),
      ]);

      if (recordResult?.data) setRecord(recordResult.data);
      setTimeline((timelineResult.data as TimelineEntry[]) ?? []);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function renderRecordDetail() {
    if (!record) return <p className="text-sm text-gray-400">记录不存在或已删除</p>;

    switch (targetTable) {
      case 'purchases':
        return <PurchaseDetail record={record} />;
      case 'chemicals':
        return <ChemicalDetail record={record} />;
      case 'supply_reservations':
        return <ReservationDetail record={record} />;
      case 'supply_borrowings':
        return <BorrowingDetail record={record} />;
      case 'profiles':
        return <ProfileDetail record={record} />;
      default:
        return <p className="text-sm text-gray-400">不支持的记录类型</p>;
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="操作详情">
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* Record detail */}
          {renderRecordDetail()}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-3">操作时间线</h4>
              <div className="relative pl-4 space-y-3">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-gray-200" />
                {timeline.map((entry) => (
                  <div key={entry.id} className="relative flex items-start gap-3">
                    <div className={`absolute left-[-9px] top-1 w-3 h-3 rounded-full border-2 border-white ${ACTION_COLORS[entry.action] ?? 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-900">{entry.user?.name ?? '未知'}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          entry.action === 'approve' ? 'bg-green-50 text-green-700' :
                          entry.action === 'reject' ? 'bg-red-50 text-red-700' :
                          entry.action === 'create' ? 'bg-blue-50 text-blue-700' :
                          entry.action === 'stock_add' ? 'bg-indigo-50 text-indigo-700' :
                          entry.action === 'recall' ? 'bg-orange-50 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {dayjs(entry.created_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                      {entry.details && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {formatTimelineDetails(entry.details)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function formatTimelineDetails(details: Record<string, unknown>): string {
  const parts: string[] = [];
  if (details.note) parts.push(`备注: ${details.note}`);
  if (details.added != null) parts.push(`库存 +${details.added} (${details.before}→${details.after})`);
  if (details.title) parts.push(String(details.title));
  if (details.batch_number) parts.push(`编号 ${details.batch_number}`);
  if (details.amount != null) parts.push(`金额 ¥${details.amount}`);
  return parts.join(' · ');
}

/* ---- Detail renderers ---- */

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function PurchaseDetail({ record }: { record: Record<string, unknown> }) {
  const applicant = record.applicant as Record<string, unknown> | null;
  const approver = record.approver as Record<string, unknown> | null;
  const attachments = (record.attachments ?? []) as { name: string; url: string; type?: string; size?: number }[];
  const receipts = (record.receipt_attachments ?? []) as { name: string; url: string; type?: string; size?: number }[];

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 rounded-lg p-3 space-y-1">
        <DetailRow label="标题" value={record.title as string} />
        <DetailRow label="申请人" value={applicant?.name as string} />
        <DetailRow label="类别" value={record.category as string} />
        <DetailRow label="采购类型" value={record.purchase_type === 'personal' ? '个人采购' : '公共采购'} />
        <DetailRow label="预估金额" value={record.estimated_amount != null ? `¥${Number(record.estimated_amount).toFixed(2)}` : undefined} />
        <DetailRow label="实际金额" value={record.actual_amount != null ? `¥${Number(record.actual_amount).toFixed(2)}` : undefined} />
        <DetailRow label="审批状态" value={record.approval_status as string} />
        <DetailRow label="审批人" value={approver?.name as string} />
        <DetailRow label="报销状态" value={record.reimbursement_status as string} />
      </div>
      {record.description && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1 font-medium">描述</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{record.description as string}</p>
        </div>
      )}
      <FilePreview files={attachments} title="采购附件" />
      <FilePreview files={receipts} title="报销凭证" />
    </div>
  );
}

function ChemicalDetail({ record }: { record: Record<string, unknown> }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      <DetailRow label="名称" value={record.name as string} />
      <DetailRow label="编号" value={record.batch_number as string} />
      <DetailRow label="CAS号" value={record.cas_number as string} />
      <DetailRow label="规格" value={record.specification as string} />
      <DetailRow label="纯度" value={record.purity as string} />
      <DetailRow label="厂家" value={record.manufacturer as string} />
      <DetailRow label="库存" value={`${record.stock ?? 0} ${record.unit ?? ''}`} />
      <DetailRow label="存放位置" value={record.storage_location as string} />
      <DetailRow label="分类" value={record.category as string} />
    </div>
  );
}

function ReservationDetail({ record }: { record: Record<string, unknown> }) {
  const supply = record.supply as Record<string, unknown> | null;
  const user = record.user as Record<string, unknown> | null;
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      <DetailRow label="物品" value={supply?.name as string} />
      <DetailRow label="申请人" value={user?.name as string} />
      <DetailRow label="数量" value={String(record.quantity)} />
      <DetailRow label="用途" value={record.purpose as string} />
      <DetailRow label="状态" value={record.status as string} />
      <DetailRow label="审批备注" value={record.review_note as string} />
    </div>
  );
}

function BorrowingDetail({ record }: { record: Record<string, unknown> }) {
  const supply = record.supply as Record<string, unknown> | null;
  const user = record.user as Record<string, unknown> | null;
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      <DetailRow label="物品" value={supply?.name as string} />
      <DetailRow label="借用人" value={user?.name as string} />
      <DetailRow label="数量" value={String(record.quantity)} />
      <DetailRow label="用途" value={record.purpose as string} />
      <DetailRow label="状态" value={record.status === 'borrowed' ? '借用中' : record.status === 'returned' ? '已归还' : String(record.status)} />
      <DetailRow label="借出时间" value={record.borrowed_at ? dayjs(record.borrowed_at as string).format('YYYY-MM-DD HH:mm') : undefined} />
      <DetailRow label="归还时间" value={record.returned_at ? dayjs(record.returned_at as string).format('YYYY-MM-DD HH:mm') : undefined} />
    </div>
  );
}

function ProfileDetail({ record }: { record: Record<string, unknown> }) {
  const ROLE_LABELS: Record<string, string> = { super_admin: '超级管理员', admin: '管理员', manager: '板块负责人', teacher: '教师', student: '学生' };
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      <DetailRow label="用户名" value={record.name as string} />
      <DetailRow label="邮箱" value={record.email as string} />
      <DetailRow label="角色" value={ROLE_LABELS[record.role as string] ?? (record.role as string)} />
      <DetailRow label="管理模块" value={(record.managed_modules as string[])?.join(', ') || '无'} />
    </div>
  );
}
```

Note: `dayjs` import is needed in BorrowingDetail. It's already imported at the top of the file.

- [ ] **Step 2: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AuditDetailModal.tsx
git commit -m "新建 AuditDetailModal：记录详情 + 附件预览 + 操作时间线"
```

---

### Task 3: AuditLogTab 接入详情弹窗

**Files:**
- Modify: `src/pages/admin/AuditLogTab.tsx`

- [ ] **Step 1: 导入 AuditDetailModal**

在文件顶部添加：

```tsx
import AuditDetailModal from '../../components/AuditDetailModal';
```

- [ ] **Step 2: 添加弹窗状态**

在组件的状态区域添加：

```tsx
const [detailModal, setDetailModal] = useState<{ targetTable: string; targetId: string } | null>(null);
```

- [ ] **Step 3: 日志条目改为可点击**

找到日志列表中的 `<div key={log.id} className="bg-white border ...">` 条目，对有 `target_id` 的日志添加点击事件和 hover 样式：

将条目的外层 div 改为：

```tsx
<div
  key={log.id}
  onClick={() => log.target_id && setDetailModal({ targetTable: log.target_table, targetId: log.target_id })}
  className={`bg-white border border-gray-100 rounded-lg p-3 flex items-start gap-3 ${
    log.target_id ? 'cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all' : ''
  }`}
>
```

- [ ] **Step 4: 在组件 return 末尾添加 Modal 渲染**

在 `</div>` 的最外层关闭标签之前添加：

```tsx
{detailModal && (
  <AuditDetailModal
    open={true}
    onClose={() => setDetailModal(null)}
    targetTable={detailModal.targetTable}
    targetId={detailModal.targetId}
  />
)}
```

- [ ] **Step 5: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/AuditLogTab.tsx
git commit -m "AuditLogTab: 日志条目可点击查看详情弹窗"
```

---

### Task 4: 审批详情弹窗改用 FilePreview

**Files:**
- Modify: `src/pages/purchase-approvals/PurchaseApprovalReview.tsx`
- Modify: `src/pages/reimbursements/ReimbursementReview.tsx`

- [ ] **Step 1: PurchaseApprovalReview 改用 FilePreview**

Read `src/pages/purchase-approvals/PurchaseApprovalReview.tsx`.

Add import at top:
```tsx
import FilePreview from '../../components/FilePreview';
```

Find the modal section that renders `reviewingItem.attachments` (the `<a>` links with FileText and ExternalLink icons for 采购申请附件). Replace the entire attachments block:

```tsx
{/* 采购申请附件 - old code with <a> links */}
```

With:

```tsx
<FilePreview
  files={(reviewingItem.attachments as { name: string; url: string; type?: string; size?: number }[]) ?? []}
  title="附件"
/>
```

Remove `ExternalLink` from the lucide-react import if it's no longer used elsewhere in the file. Check all usages first — if it's still used in the card list view, keep it.

- [ ] **Step 2: ReimbursementReview 改用 FilePreview**

Read `src/pages/reimbursements/ReimbursementReview.tsx`.

Add import at top:
```tsx
import FilePreview from '../../components/FilePreview';
```

Find the two attachment sections in the modal:
1. `reviewingItem.attachments` (采购申请附件) — replace the `<a>` links block with:
```tsx
<FilePreview
  files={(reviewingItem.attachments as { name: string; url: string; type?: string; size?: number }[]) ?? []}
  title="采购申请附件"
/>
```

2. `reviewingItem.receipt_attachments` (报销凭证) — replace the `<a>` links block with:
```tsx
<FilePreview
  files={(reviewingItem.receipt_attachments as { name: string; url: string; type?: string; size?: number }[]) ?? []}
  title="报销凭证"
/>
```

Remove unused imports (`ExternalLink`, `FileText` from lucide-react) if they are no longer used anywhere else in the file. Check first.

- [ ] **Step 3: 构建验证**

```bash
npx vite build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/purchase-approvals/PurchaseApprovalReview.tsx src/pages/reimbursements/ReimbursementReview.tsx
git commit -m "审批详情弹窗：附件改用 FilePreview，图片内联预览"
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
npx vite build && wrangler pages deploy dist --project-name=lab-management --commit-dirty=true --commit-message="Audit detail modal and file preview"
```

- [ ] **Step 3: 验证**

```bash
curl -s "https://lab-management-3w7.pages.dev" | grep -o 'index-[^"]*\.js'
ls dist/assets/index-*.js
```

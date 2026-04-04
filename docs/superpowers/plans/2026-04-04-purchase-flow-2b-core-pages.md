# 采购流程合并 2B: 列表 + 审批 + 报销补充

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改造采购记录列表（显示完整流程线）、教师审批页面（查看新 purchases 表 + 显示后续报销状态）、报销信息补充页面（在已批准记录上补充报销信息）。

**Architecture:** 三个页面都改为查询 `purchases` 表（替代旧的 `purchase_approvals` 和 `reimbursements` 表）。列表页显示采购→报销的完整流程线。审批页面增加已审批记录的报销状态展示。报销补充页面改为更新已有 `purchases` 记录的报销字段。

**Tech Stack:** React, TypeScript, TailwindCSS v4, Supabase

**Design Spec:** `docs/superpowers/specs/2026-04-04-management-restructure-design.md`

**依赖 Sub-plan 2A：** `purchases` 表、`Purchase` 类型、`PurchaseCategory` 类型已就绪。

---

### Task 1: 改造采购记录列表

**Files:**
- Modify: `src/pages/purchase-approvals/PurchaseApprovalList.tsx`

将当前的采购审批列表改为统一的采购记录列表，显示完整流程线（审批→报销）。

- [ ] **Step 1: 重写 PurchaseApprovalList.tsx**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Purchase } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import Card from '../../components/Card';

type StatusFilter = 'all' | 'pending' | 'approved' | 'reimbursing' | 'completed';

function getOverallStatus(p: Purchase): string {
  if (p.approval_status === 'pending') return '待审批';
  if (p.approval_status === 'rejected') return '审批被驳回';
  // approved
  if (!p.reimbursement_status) return '待报销';
  if (p.reimbursement_status === 'pending') return '报销审核中';
  if (p.reimbursement_status === 'rejected') return '报销被驳回';
  if (p.reimbursement_status === 'approved') return '已报销';
  return '未知';
}

function getOverallStatusColor(p: Purchase): 'yellow' | 'red' | 'blue' | 'green' | 'gray' {
  if (p.approval_status === 'pending') return 'yellow';
  if (p.approval_status === 'rejected') return 'red';
  if (!p.reimbursement_status) return 'blue';
  if (p.reimbursement_status === 'pending') return 'yellow';
  if (p.reimbursement_status === 'rejected') return 'red';
  if (p.reimbursement_status === 'approved') return 'green';
  return 'gray';
}

function matchesFilter(p: Purchase, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return p.approval_status === 'pending';
  if (filter === 'approved') return p.approval_status === 'approved' && !p.reimbursement_status;
  if (filter === 'reimbursing') return p.reimbursement_status === 'pending';
  if (filter === 'completed') return p.reimbursement_status === 'approved';
  return true;
}

export default function PurchaseApprovalList() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [list, setList] = useState<Purchase[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchList();
  }, [profile]);

  async function fetchList() {
    if (!profile) return;
    setLoading(true);

    const { data, error: fetchErr } = await supabase
      .from('purchases')
      .select('*, approver:profiles!purchases_approver_id_fkey(name)')
      .eq('applicant_id', profile.id)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      setError('加载失败：' + fetchErr.message);
    } else {
      setList((data || []) as Purchase[]);
    }
    setLoading(false);
  }

  async function handleWithdraw(id: string) {
    if (!confirm('确定要撤回此采购申请吗？')) return;
    setWithdrawingId(id);

    const { error: delErr } = await supabase.from('purchases').delete().eq('id', id);
    if (delErr) {
      alert('撤回失败：' + delErr.message);
    } else {
      setList(prev => prev.filter(p => p.id !== id));
    }
    setWithdrawingId(null);
  }

  const filtered = list.filter(p => matchesFilter(p, statusFilter));

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待审批' },
    { key: 'approved', label: '待报销' },
    { key: 'reimbursing', label: '报销中' },
    { key: 'completed', label: '已完成' },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <PageHeader
        title="我的采购"
        subtitle="查看采购申请和报销进度"
        action={{ label: '新建采购', onClick: () => navigate('/purchase-approvals/new') }}
      />

      {/* 状态筛选 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === f.key
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState message="暂无采购记录" />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{p.title}</h3>
                    {p.purchase_type === 'public' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-600 rounded">公共</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <span>{p.category}</span>
                    {p.estimated_amount && <span>¥{p.estimated_amount}</span>}
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* 流程线 */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded ${
                      p.approval_status === 'approved' ? 'bg-green-50 text-green-600' :
                      p.approval_status === 'rejected' ? 'bg-red-50 text-red-600' :
                      'bg-yellow-50 text-yellow-600'
                    }`}>
                      {p.approval_status === 'approved' ? '✓ 已审批' : p.approval_status === 'rejected' ? '✗ 已驳回' : '⏳ 待审批'}
                    </span>
                    {p.approval_status === 'approved' && (
                      <>
                        <span className="text-gray-300">→</span>
                        <span className={`px-1.5 py-0.5 rounded ${
                          p.reimbursement_status === 'approved' ? 'bg-green-50 text-green-600' :
                          p.reimbursement_status === 'rejected' ? 'bg-red-50 text-red-600' :
                          p.reimbursement_status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                          'bg-gray-50 text-gray-400'
                        }`}>
                          {p.reimbursement_status === 'approved' ? '✓ 已报销' :
                           p.reimbursement_status === 'rejected' ? '✗ 报销驳回' :
                           p.reimbursement_status === 'pending' ? '⏳ 报销审核中' :
                           '○ 待报销'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  {/* 待审批：可撤回 */}
                  {p.approval_status === 'pending' && (
                    <button
                      onClick={() => handleWithdraw(p.id)}
                      disabled={withdrawingId === p.id}
                      className="px-2.5 py-1 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      撤回
                    </button>
                  )}
                  {/* 已审批未报销：去报销 */}
                  {p.approval_status === 'approved' && !p.reimbursement_status && (
                    <button
                      onClick={() => navigate(`/reimbursements/new?purchase_id=${p.id}`)}
                      className="px-2.5 py-1 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                    >
                      去报销
                    </button>
                  )}
                  {/* 审批驳回 / 报销驳回：可修改重新提交 */}
                  {(p.approval_status === 'rejected' || p.reimbursement_status === 'rejected') && (
                    <button
                      onClick={() => navigate(`/purchase-approvals/edit/${p.id}`)}
                      className="px-2.5 py-1 text-xs text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100"
                    >
                      修改
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `cd /Users/xiaomai/Claude/lab-management && npx vite build 2>&1 | tail -5`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src/pages/purchase-approvals/PurchaseApprovalList.tsx
git commit -m "feat: rewrite purchase list with unified flow status line"
```

---

### Task 2: 改造教师审批页面

**Files:**
- Modify: `src/pages/purchase-approvals/PurchaseApprovalReview.tsx`

改为查询 `purchases` 表，增加已审批记录的报销状态展示，区分学生/老师申请。

- [ ] **Step 1: 重写 PurchaseApprovalReview.tsx**

```tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Purchase } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import SubNav from '../../components/SubNav';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import Card from '../../components/Card';
import Modal from '../../components/Modal';

export default function PurchaseApprovalReview() {
  const { profile, isSuperAdmin } = useAuth();
  const [list, setList] = useState<Purchase[]>([]);
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending');
  const [showModal, setShowModal] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<Purchase | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [editSkipRegistration, setEditSkipRegistration] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchList();
  }, [profile, tab]);

  async function fetchList() {
    if (!profile) return;
    setLoading(true);

    let query = supabase
      .from('purchases')
      .select('*, applicant:profiles!purchases_applicant_id_fkey(name, role)')
      .order('created_at', { ascending: tab === 'pending' });

    // 超管看全部，其他老师只看分配给自己的
    if (!isSuperAdmin) {
      query = query.eq('approver_id', profile.id);
    }

    if (tab === 'pending') {
      query = query.eq('approval_status', 'pending');
    } else {
      query = query.in('approval_status', ['approved', 'rejected']);
    }

    const { data, error: fetchErr } = await query;
    if (fetchErr) {
      setError('加载失败：' + fetchErr.message);
    } else {
      setList((data || []) as Purchase[]);
    }
    setLoading(false);
  }

  function openReview(item: Purchase) {
    setReviewingItem(item);
    setReviewNote('');
    setEditSkipRegistration(item.skip_registration);
    setShowModal(true);
  }

  async function handleReview(action: 'approved' | 'rejected') {
    if (!reviewingItem || !profile) return;
    if (action === 'rejected' && !reviewNote.trim()) {
      alert('驳回时请填写备注说明原因');
      return;
    }

    setSubmitting(true);
    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('purchases')
      .update({
        approval_status: action,
        approval_note: reviewNote || null,
        approved_at: now,
        skip_registration: editSkipRegistration,
      })
      .eq('id', reviewingItem.id);

    if (updateErr) {
      alert('操作失败：' + updateErr.message);
    } else {
      setShowModal(false);
      fetchList();
    }
    setSubmitting(false);
  }

  const tabs = [
    { key: 'pending', label: `待审批 (${tab === 'pending' ? list.length : '...'})`, path: '' },
    { key: 'reviewed', label: '已处理', path: '' },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <PageHeader title="采购审批" subtitle="审批学生的采购申请" />

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'pending' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          待审批
        </button>
        <button
          onClick={() => setTab('reviewed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'reviewed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          已处理
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState message={tab === 'pending' ? '暂无待审批的采购申请' : '暂无已处理的记录'} />
      ) : (
        <div className="space-y-3">
          {list.map(p => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{p.title}</h3>
                    {p.auto_approved && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-600 rounded">教师自购</span>
                    )}
                    {p.purchase_type === 'public' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-600 rounded">公共</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>申请人：{(p.applicant as { name: string })?.name || '未知'} · {p.category}</p>
                    {p.estimated_amount && <p>预估金额：¥{p.estimated_amount}</p>}
                    {p.description && <p className="text-gray-400 truncate">{p.description}</p>}
                    <p>{new Date(p.created_at).toLocaleString()}</p>
                  </div>

                  {/* 已处理的记录显示后续报销状态 */}
                  {tab === 'reviewed' && p.approval_status === 'approved' && (
                    <div className="mt-2 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded ${
                        p.reimbursement_status === 'approved' ? 'bg-green-50 text-green-600' :
                        p.reimbursement_status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                        p.reimbursement_status === 'rejected' ? 'bg-red-50 text-red-600' :
                        'bg-gray-50 text-gray-400'
                      }`}>
                        {p.reimbursement_status === 'approved' ? '已报销' :
                         p.reimbursement_status === 'pending' ? '报销审核中' :
                         p.reimbursement_status === 'rejected' ? '报销被驳回' :
                         '未报销'}
                      </span>
                      {!p.skip_registration && (
                        <>
                          <span className="mx-1 text-gray-300">·</span>
                          <span className={`px-1.5 py-0.5 rounded ${
                            p.registration_status === 'registered' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
                          }`}>
                            {p.registration_status === 'registered' ? '已登记' : '未登记'}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* 待审批：审批按钮 */}
                {tab === 'pending' && (
                  <button
                    onClick={() => openReview(p)}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 shrink-0"
                  >
                    审批
                  </button>
                )}

                {/* 已处理：显示状态 */}
                {tab === 'reviewed' && (
                  <StatusBadge status={p.approval_status === 'approved' ? 'approved' : 'rejected'} />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 审批弹窗 */}
      {showModal && reviewingItem && (
        <Modal onClose={() => setShowModal(false)}>
          <h3 className="text-lg font-bold text-gray-900 mb-4">审批采购申请</h3>
          <div className="space-y-3 mb-4">
            <div className="text-sm">
              <span className="text-gray-500">标题：</span>
              <span className="text-gray-900">{reviewingItem.title}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">类别：</span>
              <span className="text-gray-900">{reviewingItem.category}</span>
            </div>
            {reviewingItem.estimated_amount && (
              <div className="text-sm">
                <span className="text-gray-500">预估金额：</span>
                <span className="text-gray-900">¥{reviewingItem.estimated_amount}</span>
              </div>
            )}
            {reviewingItem.description && (
              <div className="text-sm">
                <span className="text-gray-500">描述：</span>
                <span className="text-gray-900">{reviewingItem.description}</span>
              </div>
            )}

            {/* 无需入库开关 - 审批时可修改 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">无需入库</p>
                <p className="text-xs text-gray-500">可在审批时调整</p>
              </div>
              <button
                type="button"
                onClick={() => setEditSkipRegistration(!editSkipRegistration)}
                className={`relative w-11 h-6 rounded-full transition-colors ${editSkipRegistration ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${editSkipRegistration ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">审批备注</label>
            <textarea
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
              placeholder="选填（驳回时必填）"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleReview('approved')}
              disabled={submitting}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              批准
            </button>
            <button
              onClick={() => handleReview('rejected')}
              disabled={submitting}
              className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              驳回
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `cd /Users/xiaomai/Claude/lab-management && npx vite build 2>&1 | tail -5`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src/pages/purchase-approvals/PurchaseApprovalReview.tsx
git commit -m "feat: rewrite purchase review page with reimbursement status tracking"
```

---

### Task 3: 改造报销信息补充页面

**Files:**
- Modify: `src/pages/reimbursements/ReimbursementForm.tsx`

改为在已批准的 `purchases` 记录上补充报销信息（实际金额、发票附件），而不是创建新的 reimbursements 记录。

- [ ] **Step 1: 重写 ReimbursementForm.tsx**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Upload, X, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Purchase, ReimbursementFile } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ReimbursementForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get('purchase_id');
  const { profile } = useAuth();

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [actualAmount, setActualAmount] = useState('');
  const [files, setFiles] = useState<ReimbursementFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      if (!profile || !purchaseId) {
        setLoading(false);
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', purchaseId)
        .eq('applicant_id', profile.id)
        .eq('approval_status', 'approved')
        .single();

      if (fetchErr || !data) {
        setError('未找到该采购记录，或尚未审批通过');
      } else {
        setPurchase(data as Purchase);
        if (data.actual_amount) setActualAmount(String(data.actual_amount));
        if (data.receipt_attachments && (data.receipt_attachments as ReimbursementFile[]).length > 0) {
          setFiles(data.receipt_attachments as ReimbursementFile[]);
        }
      }
      setLoading(false);
    }
    load();
  }, [profile, purchaseId]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || !profile) return;

    setUploading(true);
    const newFiles: ReimbursementFile[] = [...files];

    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop();
      const path = `reimbursements/${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('attachments')
        .upload(path, file);

      if (uploadErr) {
        setError('文件上传失败：' + uploadErr.message);
        continue;
      }

      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);

      newFiles.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type.includes('pdf') ? 'invoice' : 'screenshot',
        size: file.size,
      });
    }

    setFiles(newFiles);
    setUploading(false);
    e.target.value = '';
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!purchase || !profile) return;

    const amount = parseFloat(actualAmount);
    if (!amount || amount <= 0) {
      setError('请输入有效的实际金额');
      return;
    }

    setSubmitting(true);
    setError('');

    const { error: updateErr } = await supabase
      .from('purchases')
      .update({
        actual_amount: amount,
        receipt_attachments: files,
        reimbursement_status: 'pending',
      })
      .eq('id', purchase.id);

    if (updateErr) {
      setError('提交失败：' + updateErr.message);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  }

  if (loading) return <LoadingSpinner />;

  if (!purchaseId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <PageHeader title="提交报销" subtitle="请从采购记录中点击「去报销」进入" />
        <Card>
          <p className="text-sm text-gray-500 text-center py-8">请先在「我的采购」中找到已审批通过的记录，点击「去报销」按钮。</p>
          <button onClick={() => navigate('/purchase-approvals')} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            前往我的采购
          </button>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">报销已提交</h2>
        <p className="text-gray-500 mb-6 text-center">请等待报销审批人审核。</p>
        <button onClick={() => navigate('/purchase-approvals')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          返回我的采购
        </button>
      </div>
    );
  }

  if (error && !purchase) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <PageHeader title="提交报销" />
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <PageHeader title="提交报销" subtitle={`为「${purchase?.title}」提交报销信息`} />

      <Card>
        {/* 采购信息摘要 */}
        <div className="p-3 bg-gray-50 rounded-lg mb-5">
          <p className="text-xs text-gray-500 mb-1">采购信息</p>
          <p className="text-sm font-medium text-gray-900">{purchase?.title}</p>
          <div className="flex gap-3 text-xs text-gray-500 mt-1">
            <span>{purchase?.category}</span>
            {purchase?.estimated_amount && <span>预估 ¥{purchase.estimated_amount}</span>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 实际金额 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">实际金额 *</label>
            <input
              type="number"
              value={actualAmount}
              onChange={e => setActualAmount(e.target.value)}
              placeholder="实际花费金额"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* 文件上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">发票/收据附件</label>
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="p-1 text-gray-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500">{uploading ? '上传中...' : '点击上传发票/收据'}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || uploading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '提交报销'}
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
git add src/pages/reimbursements/ReimbursementForm.tsx
git commit -m "feat: rewrite reimbursement form to update purchases table"
```

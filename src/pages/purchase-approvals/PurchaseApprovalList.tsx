import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ClipboardList, Filter, ArrowRight, Pencil, ChevronDown, ChevronUp, ExternalLink, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Purchase, ReimbursementFile } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import SubNav from '../../components/SubNav';

const subNavItems = [
  { to: '/purchase-approvals/new', label: '新建采购' },
  { to: '/purchase-approvals', label: '我的采购' },
];

const categoryColors: Record<string, string> = {
  '试剂药品': 'bg-purple-50 text-purple-700',
  '实验耗材': 'bg-cyan-50 text-cyan-700',
  '设备配件': 'bg-orange-50 text-orange-700',
  '服装劳保': 'bg-pink-50 text-pink-700',
  '测试加工': 'bg-teal-50 text-teal-700',
  '会议培训': 'bg-indigo-50 text-indigo-700',
  '出版知产': 'bg-rose-50 text-rose-700',
  '办公用品': 'bg-gray-100 text-gray-700',
  '差旅交通': 'bg-indigo-50 text-indigo-700',
  '邮寄物流': 'bg-teal-50 text-teal-700',
  '其他': 'bg-gray-100 text-gray-600',
};

const REAGENT_FIELD_LABELS: Record<string, string> = {
  item_name: '药品名称',
  cas_number: 'CAS号',
  specification: '规格',
  concentration: '浓度',
  purity: '纯度',
  manufacturer: '期望厂家',
  quantity: '数量',
  unit: '单位',
};

const SUPPLY_FIELD_LABELS: Record<string, string> = {
  item_name: '物品名称',
  specification: '规格型号',
  quantity: '数量',
  unit: '单位',
};

type StatusFilter = 'all' | 'active' | 'completed' | 'rejected';

function getCompositeStatus(item: Purchase): StatusFilter {
  if (item.approval_status === 'pending') return 'pending';
  if (item.approval_status === 'rejected') return 'rejected';
  // approved
  if (!item.reimbursement_status) return 'approved';
  if (item.reimbursement_status === 'pending') return 'reimbursing';
  if (item.reimbursement_status === 'approved') return 'completed';
  // reimbursement rejected => treat as approved (can re-submit)
  return 'approved';
}

function ApprovalStatusLine({ item }: { item: Purchase }) {
  const approvalLabel =
    item.approval_status === 'pending'
      ? '待审批'
      : item.approval_status === 'approved'
        ? '已通过'
        : '已拒绝';
  const approvalColor =
    item.approval_status === 'pending'
      ? 'text-yellow-600'
      : item.approval_status === 'approved'
        ? 'text-green-600'
        : 'text-red-600';

  let reimbLabel = '未报销';
  let reimbColor = 'text-gray-400';
  if (item.reimbursement_status === 'pending') {
    reimbLabel = '报销审核中';
    reimbColor = 'text-yellow-600';
  } else if (item.reimbursement_status === 'approved') {
    reimbLabel = '已报销';
    reimbColor = 'text-green-600';
  } else if (item.reimbursement_status === 'rejected') {
    reimbLabel = '报销被拒';
    reimbColor = 'text-red-600';
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`font-medium ${approvalColor}`}>{approvalLabel}</span>
      <span className="text-gray-300">&rarr;</span>
      <span className={`font-medium ${reimbColor}`}>{reimbLabel}</span>
    </div>
  );
}

function ExtraFieldsDisplay({ extraFields, category }: { extraFields: Record<string, unknown>; category: string }) {
  if (!extraFields || Object.keys(extraFields).length === 0) return null;

  const labels = category === '试剂药品' ? REAGENT_FIELD_LABELS : SUPPLY_FIELD_LABELS;
  const entries = Object.entries(extraFields).filter(
    ([, value]) => value != null && value !== ''
  );

  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500">详细信息</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between text-xs">
            <span className="text-gray-400">{labels[key] || key}</span>
            <span className="text-gray-700 font-medium">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttachmentsDisplay({ attachments }: { attachments: ReimbursementFile[] }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500">附件（{attachments.length}）</p>
      <div className="space-y-1">
        {attachments.map((file, idx) => (
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
        ))}
      </div>
    </div>
  );
}

export default function PurchaseApprovalList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (profile) fetchPurchases();
  }, [profile]);

  async function fetchPurchases() {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchErr } = await supabase
        .from('purchases')
        .select('*, approver:profiles!purchases_approver_id_fkey(name)')
        .eq('applicant_id', profile.id)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setList((data as Purchase[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw(id: string) {
    if (!confirm('确定要撤回该采购申请吗？')) return;
    setWithdrawingId(id);
    try {
      const { error: delError } = await supabase
        .from('purchases')
        .delete()
        .eq('id', id);
      if (delError) throw delError;
      setList((prev) => prev.filter((r) => r.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '撤回失败');
    } finally {
      setWithdrawingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return list;
    return list.filter((item) => {
      switch (statusFilter) {
        case 'active':
          return (
            item.approval_status === 'pending' ||
            (item.approval_status === 'approved' && item.reimbursement_status !== 'approved')
          );
        case 'completed':
          return item.reimbursement_status === 'approved';
        case 'rejected':
          return item.approval_status === 'rejected' || item.reimbursement_status === 'rejected';
        default:
          return true;
      }
    });
  }, [list, statusFilter]);

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'active', label: '进行中' },
    { value: 'completed', label: '已完成' },
    { value: 'rejected', label: '已拒绝' },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="pb-8">
      <div className="px-4 md:px-6 pt-4">
        <SubNav items={subNavItems} />
      </div>
      <PageHeader
        title="我的采购"
        subtitle={`共 ${filtered.length} 条`}
      />

      <div className="px-4 md:px-6 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            加载失败：{error}
          </div>
        )}

        {/* 状态筛选 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 列表 */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="暂无采购记录"
            description="点击顶部导航新建采购审批申请"
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const composite = getCompositeStatus(item);
              const isExpanded = expandedId === item.id;
              const extraFields = (item.extra_fields ?? {}) as Record<string, unknown>;
              const hasExtra = Object.keys(extraFields).length > 0;
              const hasAttachments = item.attachments && item.attachments.length > 0;
              const hasDescription = item.description && item.description.trim();
              const isExpandable = hasExtra || hasAttachments || hasDescription;

              return (
                <Card key={item.id}>
                  <div className="space-y-3">
                    {/* Clickable header */}
                    <div
                      className={isExpandable ? 'cursor-pointer' : ''}
                      onClick={() => {
                        if (isExpandable) {
                          setExpandedId(isExpanded ? null : item.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {item.title}
                            </h3>
                            {item.purchase_type === 'public' && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">
                                公共
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                categoryColors[item.category] ?? 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {item.category}
                            </span>
                            {isExpandable && (
                              isExpanded
                                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                : <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>

                          <ApprovalStatusLine item={item} />

                          <p className="text-xs text-gray-500 mt-1">
                            审批人：{item.approver?.name ?? '未知'}
                          </p>

                          <p className="text-xs text-gray-400">
                            申请时间：{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                          </p>
                        </div>

                        {item.estimated_amount != null && (
                          <div className="shrink-0 ml-3 text-right">
                            <p className="text-lg font-bold text-gray-900">
                              ¥{item.estimated_amount.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-400">金额</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="space-y-3 pt-2 border-t border-gray-100">
                        {hasDescription && (
                          <div>
                            <p className="text-xs font-medium text-gray-500">描述</p>
                            <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{item.description}</p>
                          </div>
                        )}

                        {hasExtra && (
                          <ExtraFieldsDisplay extraFields={extraFields} category={item.category} />
                        )}

                        {hasAttachments && (
                          <AttachmentsDisplay attachments={item.attachments as ReimbursementFile[]} />
                        )}
                      </div>
                    )}

                    {/* 审批备注 - rejection note always visible */}
                    {item.approval_status === 'rejected' && item.approval_note && (
                      <div className="p-3 rounded-lg bg-red-50">
                        <p className="text-xs text-red-600">
                          <span className="font-medium">拒绝原因：</span>
                          {item.approval_note}
                        </p>
                      </div>
                    )}

                    {/* Approved note (non-rejection) */}
                    {item.approval_status === 'approved' && item.approval_note && !item.auto_approved && (
                      <div className="p-3 rounded-lg bg-green-50">
                        <p className="text-xs text-green-600">
                          <span className="font-medium">审批备注：</span>
                          {item.approval_note}
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    {composite === 'pending' && (
                      <button
                        onClick={() => handleWithdraw(item.id)}
                        disabled={withdrawingId === item.id}
                        className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
                      >
                        {withdrawingId === item.id ? '撤回中...' : '撤回申请'}
                      </button>
                    )}

                    {composite === 'approved' && (
                      <button
                        onClick={() =>
                          navigate(`/reimbursements/new?purchase_id=${item.id}`)
                        }
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        去报销
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    {composite === 'rejected' && (
                      <button
                        onClick={() =>
                          navigate(`/purchase-approvals/edit/${item.id}`)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        修改
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

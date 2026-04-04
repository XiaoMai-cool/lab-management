import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ClipboardList, Filter, ArrowRight, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Purchase } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import SubNav from '../../components/SubNav';

const subNavItems = [
  { to: '/reimbursements', label: '报销记录', exact: true },
  { to: '/reimbursements/new', label: '新建报销' },
  { to: '/purchase-approvals/new', label: '采购审批' },
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

type StatusFilter = 'all' | 'pending' | 'approved' | 'reimbursing' | 'completed' | 'rejected';

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

export default function PurchaseApprovalList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

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
    return list.filter((item) => getCompositeStatus(item) === statusFilter);
  }, [list, statusFilter]);

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待审批' },
    { value: 'approved', label: '已批准' },
    { value: 'reimbursing', label: '报销中' },
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
              return (
                <Card key={item.id}>
                  <div className="space-y-3">
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
                          <p className="text-xs text-gray-400">预计金额</p>
                        </div>
                      )}
                    </div>

                    {/* 审批备注 */}
                    {item.approval_status !== 'pending' && item.approval_note && (
                      <div className={`p-3 rounded-lg ${item.approval_status === 'approved' ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className={`text-xs ${item.approval_status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
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

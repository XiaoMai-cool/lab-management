import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ClipboardList, Filter, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { PurchaseApproval, Profile } from '../../lib/types';
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

interface PurchaseApprovalWithApprover extends PurchaseApproval {
  approver?: Profile;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const categoryColors: Record<string, string> = {
  '个人药品': 'bg-purple-50 text-purple-700',
  '外送检测': 'bg-cyan-50 text-cyan-700',
  '设备配件': 'bg-orange-50 text-orange-700',
  '加工定制': 'bg-pink-50 text-pink-700',
  '办公打印': 'bg-gray-100 text-gray-700',
  '差旅费': 'bg-indigo-50 text-indigo-700',
  '邮寄快递': 'bg-teal-50 text-teal-700',
  '其他': 'bg-gray-100 text-gray-600',
};

export default function PurchaseApprovalList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<PurchaseApprovalWithApprover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (profile) fetchApprovals();
  }, [profile]);

  async function fetchApprovals() {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchErr } = await supabase
        .from('purchase_approvals')
        .select('*, approver:profiles!purchase_approvals_approver_id_fkey(*)')
        .eq('requester_id', profile.id)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setList(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return list;
    return list.filter((item) => item.status === statusFilter);
  }, [list, statusFilter]);

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待审批' },
    { value: 'approved', label: '已批准' },
    { value: 'rejected', label: '已拒绝' },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="pb-8">
      <div className="px-4 md:px-6 pt-4">
        <SubNav items={subNavItems} />
      </div>
      <PageHeader
        title="我的采购申请"
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
            title="暂无采购申请"
            description="点击顶部导航新建采购审批申请"
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <Card key={item.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {item.title}
                        </h3>
                        <StatusBadge status={item.status} type="reimbursement" />
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            categoryColors[item.category] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.category}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 mb-1">
                        审批老师：{item.approver?.name ?? '未知'}
                      </p>

                      <p className="text-xs text-gray-400">
                        {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
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

                  {/* 已批准：去报销按钮 */}
                  {item.status === 'approved' && (
                    <button
                      onClick={() =>
                        navigate(
                          `/reimbursements/new?approval_id=${item.id}`
                        )
                      }
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      去报销
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  {/* 已拒绝：显示原因 */}
                  {item.status === 'rejected' && item.review_note && (
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="text-xs text-red-600">
                        <span className="font-medium">拒绝原因：</span>
                        {item.review_note}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { Receipt, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type {
  Reimbursement,
  Profile,
  PurchaseApproval,
  ReimbursementCategory,
} from '../../lib/types';
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
  '个人药品': 'bg-purple-50 text-purple-700',
  '外送检测': 'bg-cyan-50 text-cyan-700',
  '设备配件': 'bg-orange-50 text-orange-700',
  '加工定制': 'bg-pink-50 text-pink-700',
  '办公打印': 'bg-gray-100 text-gray-700',
  '差旅费': 'bg-indigo-50 text-indigo-700',
  '邮寄快递': 'bg-teal-50 text-teal-700',
  '其他': 'bg-gray-100 text-gray-600',
};

const allCategories: ReimbursementCategory[] = [
  '个人药品',
  '外送检测',
  '设备配件',
  '加工定制',
  '办公打印',
  '差旅费',
  '邮寄快递',
  '其他',
];

interface ReimbursementWithRelations extends Reimbursement {
  user?: Profile;
  purchase_approval?: PurchaseApproval;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'completed';

export default function ReimbursementList() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<ReimbursementWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReimbursements();
  }, [profile, isAdmin]);

  async function fetchReimbursements() {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('reimbursements')
        .select(
          '*, user:profiles!reimbursements_user_id_fkey(*), reviewer:profiles!reimbursements_reviewer_id_fkey(name), purchase_approval:purchase_approvals(*)'
        )
        .order('created_at', { ascending: false });

      // 普通用户只看自己的
      if (!isAdmin) {
        query = query.eq('user_id', profile.id);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setList(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw(id: string) {
    if (!confirm('确定要撤回该报销申请吗？')) return;
    setWithdrawingId(id);
    try {
      const { error: delError } = await supabase
        .from('reimbursements')
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
    let result = list;
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (categoryFilter !== 'all') {
      result = result.filter((r) => r.category === categoryFilter);
    }
    return result;
  }, [list, statusFilter, categoryFilter]);

  const totalAmount = useMemo(() => {
    return filtered.reduce((sum, r) => sum + r.amount, 0);
  }, [filtered]);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
          加载失败：{error}
        </div>
      </div>
    );
  }

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待审批' },
    { value: 'approved', label: '已批准' },
    { value: 'rejected', label: '已拒绝' },
    { value: 'completed', label: '已完成' },
  ];

  return (
    <div className="mx-auto max-w-7xl p-4">
      <PageHeader
        title="报销记录"
        subtitle={`共 ${filtered.length} 条，合计 ¥${totalAmount.toFixed(2)}`}
        action={
          <button
            onClick={() => navigate('/reimbursements/new')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            + 新建报销
          </button>
        }
      />

      <SubNav items={subNavItems} />

      {/* 状态筛选 */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              statusFilter === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 类别筛选 */}
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
            categoryFilter === 'all'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          全部类别
        </button>
        {allCategories.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              categoryFilter === c
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">

        {/* 列表 */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="暂无报销记录"
            description="点击上方「新建报销」提交申请"
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {item.title}
                      </h3>
                      <StatusBadge status={item.status} type="reimbursement" />
                      {item.category && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            categoryColors[item.category] ??
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.category}
                        </span>
                      )}
                    </div>

                    {isAdmin && item.user && (
                      <p className="text-xs text-gray-500 mb-1">
                        申请人：{item.user.name}
                      </p>
                    )}

                    {/* 关联采购审批 */}
                    {item.purchase_approval && (
                      <div className="flex items-center gap-1 mb-1">
                        <Link2 className="w-3 h-3 text-blue-400" />
                        <span className="text-xs text-blue-600">
                          采购审批：{item.purchase_approval.title}
                        </span>
                      </div>
                    )}

                    {item.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-1.5">
                      申请时间：{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                    </p>

                    {item.status !== 'pending' && (
                      <div className="mt-1.5 space-y-0.5">
                        {(item as any).reviewer?.name && (
                          <p className="text-xs text-gray-400">
                            审批人：{(item as any).reviewer.name}
                          </p>
                        )}
                        {item.reviewed_at && (
                          <p className="text-xs text-gray-400">
                            审批时间：{dayjs(item.reviewed_at).format('YYYY-MM-DD HH:mm')}
                          </p>
                        )}
                        {item.review_note && (
                          <p className="text-xs text-orange-600">
                            审批备注：{item.review_note}
                          </p>
                        )}
                      </div>
                    )}

                    {item.status === 'pending' && (
                      <div className="mt-2">
                        <button
                          onClick={() => handleWithdraw(item.id)}
                          disabled={withdrawingId === item.id}
                          className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
                        >
                          {withdrawingId === item.id ? '撤回中...' : '撤回申请'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 ml-3 text-right">
                    <p className="text-lg font-bold text-gray-900">
                      ¥{item.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { Receipt, Plus, Filter, Link2 } from 'lucide-react';
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
  { to: '/purchase-approvals/review', label: '审批采购', teacherOnly: true },
  { to: '/reimbursements/review', label: '审批报销', adminOnly: true },
  { to: '/reimbursements/stats', label: '报销统计', managerModule: 'supplies' },
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
          '*, user:profiles!reimbursements_user_id_fkey(*), purchase_approval:purchase_approvals(*)'
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
    <div className="pb-8">
      <div className="px-4 md:px-6 pt-4">
        <SubNav items={subNavItems} />
      </div>
      <PageHeader
        title="报销记录"
        subtitle={`共 ${filtered.length} 条，合计 ¥${totalAmount.toFixed(2)}`}
        action={
          <button
            onClick={() => navigate('/reimbursements/new')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建报销
          </button>
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {/* 状态筛选 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          {statusOptions.map((opt) => (
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

        {/* 类别筛选 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-gray-400 shrink-0">类别:</span>
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              categoryFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {allCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                categoryFilter === c
                  ? 'bg-blue-600 text-white'
                  : `${categoryColors[c] ?? 'bg-gray-100 text-gray-600'} hover:opacity-80`
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 列表 */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="暂无报销记录"
            description="点击右上角新建报销申请"
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
                      {dayjs(item.created_at).format('YYYY-MM-DD')}
                    </p>

                    {item.review_note && (
                      <p className="text-xs text-orange-600 mt-1">
                        审批备注：{item.review_note}
                      </p>
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

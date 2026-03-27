import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { Receipt, Plus, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Reimbursement, Profile } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';

interface ReimbursementWithUser extends Reimbursement {
  user?: Profile;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'completed';

export default function ReimbursementList() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<ReimbursementWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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
        .select('*, user:profiles(*)')
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
    if (statusFilter === 'all') return list;
    return list.filter((r) => r.status === statusFilter);
  }, [list, statusFilter]);

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

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待审批' },
    { value: 'approved', label: '已批准' },
    { value: 'rejected', label: '已拒绝' },
    { value: 'completed', label: '已完成' },
  ];

  return (
    <div className="pb-8">
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
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {item.title}
                      </h3>
                      <StatusBadge status={item.status} type="reimbursement" />
                    </div>

                    {isAdmin && item.user && (
                      <p className="text-xs text-gray-500 mb-1">
                        申请人：{item.user.name}
                      </p>
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

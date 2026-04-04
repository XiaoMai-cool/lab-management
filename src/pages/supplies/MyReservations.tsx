import { useEffect, useState } from 'react';
import { RefreshCw, Package, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { SupplyReservation } from '../../lib/types';
import PageHeader from '../../components/PageHeader';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'completed';

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审批' },
  { key: 'approved', label: '已批准' },
  { key: 'rejected', label: '已拒绝' },
  { key: 'completed', label: '已完成' },
];

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '待审批' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', label: '已批准' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: '已拒绝' },
  completed: { bg: 'bg-gray-100', text: 'text-gray-800', label: '已完成' },
};

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function MyReservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<SupplyReservation[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  async function fetchReservations() {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('supply_reservations')
        .select('*, supply:supplies(name, specification, unit), reviewer:profiles!supply_reservations_reviewer_id_fkey(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setReservations(data || []);
    } catch (err: any) {
      setError(err.message || '加载失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw(id: string) {
    if (!confirm('确定要撤回该预约申请吗？')) return;
    setWithdrawingId(id);
    try {
      const { error: delError } = await supabase
        .from('supply_reservations')
        .delete()
        .eq('id', id);
      if (delError) throw delError;
      setReservations((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err.message || '撤回失败');
    } finally {
      setWithdrawingId(null);
    }
  }

  useEffect(() => {
    fetchReservations();
  }, [user, statusFilter]);

  return (
    <div>
      <PageHeader
        title="我的预约"
        subtitle="查看耗材预约记录和审批状态"
        action={
          <button
            onClick={fetchReservations}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {/* Status Filter */}
        <div className="flex overflow-x-auto gap-1 bg-gray-100 rounded-xl p-1 no-scrollbar">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                statusFilter === opt.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="text-sm text-gray-500">加载中...</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 mb-3">{error}</p>
            <button
              onClick={fetchReservations}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              重试
            </button>
          </div>
        ) : reservations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {statusFilter === 'all' ? '暂无预约记录' : '没有该状态的预约'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((reservation) => {
              const supply = reservation.supply as any;
              const statusCfg = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending;

              return (
                <div
                  key={reservation.id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {supply?.name || '未知耗材'}
                        </h3>
                        <span
                          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}
                        >
                          {statusCfg.label}
                        </span>
                      </div>
                      {supply?.specification && (
                        <p className="text-xs text-gray-500">{supply.specification}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-semibold text-gray-900">
                        {reservation.quantity}
                      </span>
                      <span className="text-xs text-gray-400 ml-0.5">
                        {supply?.unit || ''}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400">用途:</span>
                      <span className="text-gray-600">{reservation.purpose}</span>
                    </div>
                    {reservation.is_returnable && (
                      <div className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                        使用后归还
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>申请时间: {formatDateTime(reservation.created_at)}</span>
                    </div>
                    {reservation.status !== 'pending' && (
                      <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
                        {(reservation as any).reviewer?.name && (
                          <div>
                            <span className="font-medium text-gray-500">审批人: </span>
                            {(reservation as any).reviewer.name}
                          </div>
                        )}
                        {reservation.reviewed_at && (
                          <div>
                            <span className="font-medium text-gray-500">审批时间: </span>
                            {formatDateTime(reservation.reviewed_at)}
                          </div>
                        )}
                        {reservation.review_note && (
                          <div>
                            <span className="font-medium text-gray-500">审批备注: </span>
                            {reservation.review_note}
                          </div>
                        )}
                      </div>
                    )}
                    {reservation.status === 'pending' && (
                      <div className="mt-2">
                        <button
                          onClick={() => handleWithdraw(reservation.id)}
                          disabled={withdrawingId === reservation.id}
                          className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
                        >
                          {withdrawingId === reservation.id ? '撤回中...' : '撤回申请'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

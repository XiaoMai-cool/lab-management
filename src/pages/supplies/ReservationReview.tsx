import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, CheckCircle, XCircle, ClipboardList, ShieldAlert, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { auditLog } from '../../lib/auditLog';
import { useAuth } from '../../contexts/AuthContext';
import type { SupplyReservation } from '../../lib/types';
import PageHeader from '../../components/PageHeader';

interface ReservationItem {
  id: string;
  supply_id: string;
  quantity: number;
  supply: { name: string; specification: string; unit: string; stock: number; is_returnable?: boolean } | null;
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ReservationReview() {
  const navigate = useNavigate();
  const { user, isAdmin, canManageModule } = useAuth();
  const [reservations, setReservations] = useState<SupplyReservation[]>([]);
  const [reviewedList, setReviewedList] = useState<SupplyReservation[]>([]);
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<SupplyReservation | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [reservationItems, setReservationItems] = useState<Record<string, ReservationItem[]>>({});

  const canReview = isAdmin || canManageModule('supplies');

  async function fetchReservations() {
    setLoading(true);
    setError(null);

    try {
      if (tab === 'pending') {
        const { data, error: fetchError } = await supabase
          .from('supply_reservations')
          .select(
            '*, supply:supplies(id, name, specification, stock, unit, min_stock), user:profiles!user_id(name, email)'
          )
          .eq('status', 'pending')
          .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;
        setReservations(data || []);

        // Fetch reservation items
        if (data && data.length > 0) {
          const ids = data.map((r: any) => r.id);
          const { data: items } = await supabase
            .from('supply_reservation_items')
            .select('id, reservation_id, supply_id, quantity, supply:supplies(name, specification, unit, stock, is_returnable)')
            .in('reservation_id', ids);
          if (items) {
            const grouped: Record<string, ReservationItem[]> = {};
            for (const item of items as any[]) {
              if (!grouped[item.reservation_id]) grouped[item.reservation_id] = [];
              grouped[item.reservation_id].push(item);
            }
            setReservationItems(prev => ({ ...prev, ...grouped }));
          }
        }
      } else {
        const { data, error: fetchError } = await supabase
          .from('supply_reservations')
          .select(
            '*, supply:supplies(id, name, specification, stock, unit, min_stock), user:profiles!user_id(name, email), reviewer:profiles!supply_reservations_reviewer_id_fkey(name)'
          )
          .in('status', ['approved', 'rejected', 'completed'])
          .order('reviewed_at', { ascending: false });

        if (fetchError) throw fetchError;
        setReviewedList(data || []);

        // Fetch reservation items for reviewed list
        if (data && data.length > 0) {
          const ids = data.map((r: any) => r.id);
          const { data: items } = await supabase
            .from('supply_reservation_items')
            .select('id, reservation_id, supply_id, quantity, supply:supplies(name, specification, unit, stock, is_returnable)')
            .in('reservation_id', ids);
          if (items) {
            const grouped: Record<string, ReservationItem[]> = {};
            for (const item of items as any[]) {
              if (!grouped[item.reservation_id]) grouped[item.reservation_id] = [];
              grouped[item.reservation_id].push(item);
            }
            setReservationItems(prev => ({ ...prev, ...grouped }));
          }
        }
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canReview) return;
    fetchReservations();
  }, [canReview, tab]);

  async function handleRecallApproval(reservation: SupplyReservation) {
    if (!confirm('确定要撤回该预约审批吗？审批状态将恢复为待审批，已扣减的库存将被恢复。')) return;
    setProcessingId(reservation.id);
    setActionError(null);
    try {
      const supply = reservation.supply as any;

      // Block recall if any linked borrowing has been processed (returned/damaged)
      const { data: borrowings } = await supabase
        .from('supply_borrowings')
        .select('id, status')
        .eq('reservation_id', reservation.id);
      if (borrowings?.some((b) => b.status !== 'borrowed')) {
        setActionError('撤回失败：该申领已有物品归还或报损，请先在"借用管理"中处理。');
        setProcessingId(null);
        return;
      }

      // Restore stock for all items first
      const { data: items } = await supabase
        .from('supply_reservation_items')
        .select('supply_id, quantity')
        .eq('reservation_id', reservation.id);

      if (items && items.length > 0) {
        for (const item of items) {
          const { error: stockError } = await supabase.rpc('adjust_stock', {
            p_table: 'supplies',
            p_id: item.supply_id,
            p_delta: item.quantity,
          });
          if (stockError) throw stockError;
        }
      } else if (supply) {
        const { error: stockError } = await supabase.rpc('adjust_stock', {
          p_table: 'supplies',
          p_id: supply.id,
          p_delta: reservation.quantity,
        });
        if (stockError) throw stockError;
      }

      // Clear linked borrowings (they'll be re-created if re-approved)
      if (borrowings && borrowings.length > 0) {
        const { error: delError } = await supabase
          .from('supply_borrowings')
          .delete()
          .eq('reservation_id', reservation.id);
        if (delError) throw delError;
      }

      // Reset reservation status after stock is restored
      const { error: updateError } = await supabase
        .from('supply_reservations')
        .update({
          status: 'pending',
          reviewed_at: null,
          review_note: null,
        })
        .eq('id', reservation.id);
      if (updateError) throw updateError;
      await auditLog({
        action: 'recall',
        targetTable: 'supply_reservations',
        targetId: reservation.id,
        details: { supplyName: (reservation.supply as any)?.name, quantity: reservation.quantity },
      });

      fetchReservations();
    } catch (err: any) {
      setActionError(err.message || '撤回失败');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleEditStatus(reservation: SupplyReservation, newStatus: string) {
    if (!user) return;
    setProcessingId(reservation.id);
    setActionError(null);
    try {
      const oldStatus = reservation.status;
      const supply = reservation.supply as any;

      // Adjust stock + borrowings when changing to/from 'approved'
      if (oldStatus !== newStatus) {
        const { data: items } = await supabase
          .from('supply_reservation_items')
          .select('supply_id, quantity, supply:supplies(is_returnable)')
          .eq('reservation_id', reservation.id);

        if (oldStatus === 'approved' && newStatus !== 'approved') {
          // Leaving approved: block if any borrowings processed
          const { data: borrowings } = await supabase
            .from('supply_borrowings')
            .select('id, status')
            .eq('reservation_id', reservation.id);
          if (borrowings?.some((b) => b.status !== 'borrowed')) {
            throw new Error('该申领已有物品归还或报损，无法修改状态');
          }

          // Restore stock
          if (items && items.length > 0) {
            for (const item of items) {
              const { error: stockError } = await supabase.rpc('adjust_stock', {
                p_table: 'supplies',
                p_id: item.supply_id,
                p_delta: item.quantity,
              });
              if (stockError) throw stockError;
            }
          } else if (supply) {
            const { error: stockError } = await supabase.rpc('adjust_stock', {
              p_table: 'supplies',
              p_id: supply.id,
              p_delta: reservation.quantity,
            });
            if (stockError) throw stockError;
          }

          // Delete borrowings
          if (borrowings && borrowings.length > 0) {
            const { error: delError } = await supabase
              .from('supply_borrowings')
              .delete()
              .eq('reservation_id', reservation.id);
            if (delError) throw delError;
          }
        } else if (oldStatus !== 'approved' && newStatus === 'approved') {
          // Entering approved: deduct stock + create borrowings for returnables
          if (items && items.length > 0) {
            for (const item of items) {
              const { error: stockError } = await supabase.rpc('adjust_stock', {
                p_table: 'supplies',
                p_id: item.supply_id,
                p_delta: -item.quantity,
              });
              if (stockError) throw stockError;
            }

            const borrowingRows = (items as any[])
              .filter((it) => it.supply?.is_returnable)
              .map((it) => ({
                supply_id: it.supply_id,
                user_id: reservation.user_id,
                quantity: it.quantity,
                purpose: reservation.purpose || '',
                status: 'borrowed',
                borrowed_at: new Date().toISOString(),
                reservation_id: reservation.id,
              }));
            if (borrowingRows.length > 0) {
              const { error: borrowError } = await supabase
                .from('supply_borrowings')
                .insert(borrowingRows);
              if (borrowError) throw borrowError;
            }
          } else if (supply) {
            const { error: stockError } = await supabase.rpc('adjust_stock', {
              p_table: 'supplies',
              p_id: supply.id,
              p_delta: -reservation.quantity,
            });
            if (stockError) throw stockError;
            if (supply.is_returnable) {
              const { error: borrowError } = await supabase
                .from('supply_borrowings')
                .insert({
                  supply_id: supply.id,
                  user_id: reservation.user_id,
                  quantity: reservation.quantity,
                  purpose: reservation.purpose || '',
                  status: 'borrowed',
                  borrowed_at: new Date().toISOString(),
                  reservation_id: reservation.id,
                });
              if (borrowError) throw borrowError;
            }
          }
        }
      }

      // Update status after stock adjustment succeeds
      const { error: updateError } = await supabase
        .from('supply_reservations')
        .update({
          status: newStatus,
          reviewer_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reservation.id);
      if (updateError) throw updateError;
      await auditLog({
        action: 'update_status',
        targetTable: 'supply_reservations',
        targetId: reservation.id,
        details: { oldStatus, newStatus, supplyName: (reservation.supply as any)?.name },
      });
      setEditingItem(null);
      fetchReservations();
    } catch (err: any) {
      setActionError(err.message || '修改失败');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDelete(id: string, status: string) {
    if (status === 'approved') {
      alert('已通过的申领不能删除，请使用撤回功能');
      return;
    }
    if (!confirm('确定要删除该预约记录吗？此操作不可恢复。')) return;
    setProcessingId(id);
    setActionError(null);
    try {
      const { error: delError } = await supabase
        .from('supply_reservations')
        .delete()
        .eq('id', id);
      if (delError) throw delError;
      await auditLog({
        action: 'delete',
        targetTable: 'supply_reservations',
        targetId: id,
        details: { status },
      });
      setReviewedList((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      setActionError(err.message || '删除失败');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleApprove(reservation: SupplyReservation) {
    if (!user) return;
    const supply = reservation.supply as any;

    setProcessingId(reservation.id);
    setActionError(null);

    try {
      // Load items with returnable flag so we can create borrowings for返还类
      const { data: items } = await supabase
        .from('supply_reservation_items')
        .select('supply_id, quantity, supply:supplies(is_returnable)')
        .eq('reservation_id', reservation.id);

      // Deduct stock
      if (items && items.length > 0) {
        for (const item of items) {
          const { error: stockError } = await supabase.rpc('adjust_stock', {
            p_table: 'supplies',
            p_id: item.supply_id,
            p_delta: -item.quantity,
          });
          if (stockError) throw stockError;
        }
      } else if (supply) {
        const { error: stockError } = await supabase.rpc('adjust_stock', {
          p_table: 'supplies',
          p_id: supply.id,
          p_delta: -reservation.quantity,
        });
        if (stockError) throw stockError;
      }

      // Create borrowing records for returnable items so they show up in "我的归还"
      const borrowings: Array<{
        supply_id: string;
        user_id: string;
        quantity: number;
        purpose: string;
        status: string;
        borrowed_at: string;
        reservation_id: string;
      }> = [];
      if (items && items.length > 0) {
        for (const item of items as any[]) {
          if (item.supply?.is_returnable) {
            borrowings.push({
              supply_id: item.supply_id,
              user_id: reservation.user_id,
              quantity: item.quantity,
              purpose: reservation.purpose || '',
              status: 'borrowed',
              borrowed_at: new Date().toISOString(),
              reservation_id: reservation.id,
            });
          }
        }
      } else if (supply?.is_returnable) {
        borrowings.push({
          supply_id: supply.id,
          user_id: reservation.user_id,
          quantity: reservation.quantity,
          purpose: reservation.purpose || '',
          status: 'borrowed',
          borrowed_at: new Date().toISOString(),
          reservation_id: reservation.id,
        });
      }
      if (borrowings.length > 0) {
        const { error: borrowError } = await supabase
          .from('supply_borrowings')
          .insert(borrowings);
        if (borrowError) throw borrowError;
      }

      // Update reservation status after stock + borrowings succeed
      const { error: updateError } = await supabase
        .from('supply_reservations')
        .update({
          status: 'approved',
          reviewer_id: user.id,
          review_note: reviewNotes[reservation.id]?.trim() || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reservation.id);

      if (updateError) throw updateError;
      await auditLog({
        action: 'approve',
        targetTable: 'supply_reservations',
        targetId: reservation.id,
        details: {
          supplyName: supply?.name,
          quantity: reservation.quantity,
          note: reviewNotes[reservation.id]?.trim() || null,
          borrowingsCreated: borrowings.length,
        },
      });

      // Remove from local list
      setReservations((prev) => prev.filter((r) => r.id !== reservation.id));
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[reservation.id];
        return next;
      });
    } catch (err: any) {
      setActionError(err.message || '操作失败');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(reservation: SupplyReservation) {
    if (!user) return;

    const note = reviewNotes[reservation.id]?.trim();
    if (!note) {
      setActionError('拒绝时请填写原因');
      return;
    }

    setProcessingId(reservation.id);
    setActionError(null);

    try {
      const { error: updateError } = await supabase
        .from('supply_reservations')
        .update({
          status: 'rejected',
          reviewer_id: user.id,
          review_note: note,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reservation.id);

      if (updateError) throw updateError;
      await auditLog({
        action: 'reject',
        targetTable: 'supply_reservations',
        targetId: reservation.id,
        details: { supplyName: (reservation.supply as any)?.name, quantity: reservation.quantity, note },
      });

      setReservations((prev) => prev.filter((r) => r.id !== reservation.id));
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[reservation.id];
        return next;
      });
    } catch (err: any) {
      setActionError(err.message || '操作失败');
    } finally {
      setProcessingId(null);
    }
  }

  // Access guard
  if (!canReview) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">无权限访问</h2>
          <p className="text-sm text-gray-500 mb-4">
            该页面仅限耗材管理员或系统管理员访问。
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="预约审批"
        subtitle="审批待处理的耗材预约申请"
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
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {actionError}
            <button
              onClick={() => setActionError(null)}
              className="ml-2 text-red-500 hover:text-red-700 font-medium"
            >
              关闭
            </button>
          </div>
        )}

        {/* Tab 切换 */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            待审批
          </button>
          <button
            onClick={() => setTab('reviewed')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'reviewed'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            已处理
          </button>
        </div>

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
        ) : tab === 'pending' && reservations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">暂无待审批的预约</p>
          </div>
        ) : tab === 'reviewed' && reviewedList.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">暂无已处理的预约</p>
          </div>
        ) : tab === 'reviewed' ? (
          <div className="space-y-4">
            {reviewedList.map((reservation) => {
              const supply = reservation.supply as any;
              const requester = reservation.user as any;
              const reviewer = (reservation as any).reviewer;
              const statusCfg: Record<string, { bg: string; text: string; label: string }> = {
                approved: { bg: 'bg-green-100', text: 'text-green-800', label: '已批准' },
                rejected: { bg: 'bg-red-100', text: 'text-red-800', label: '已拒绝' },
                completed: { bg: 'bg-gray-100', text: 'text-gray-800', label: '已完成' },
              };
              const cfg = statusCfg[reservation.status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: reservation.status };

              return (
                <div key={reservation.id} className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {reservationItems[reservation.id] && reservationItems[reservation.id].length > 1
                          ? `物资申领 (${reservationItems[reservation.id].length}种)`
                          : (
                            <>
                              {supply?.name || '未知耗材'}
                              {supply?.specification && (
                                <span className="text-gray-400 font-normal ml-1.5">({supply.specification})</span>
                              )}
                            </>
                          )
                        }
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        申请人: {requester?.name || '未知'}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Item details for reviewed */}
                  {reservationItems[reservation.id] && reservationItems[reservation.id].length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1.5">申领明细</p>
                      <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
                        {reservationItems[reservation.id].map((item) => (
                          <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="text-gray-900">
                              {item.supply?.name || '未知'}
                              {item.supply?.specification && (
                                <span className="text-gray-400 ml-1">({item.supply.specification})</span>
                              )}
                            </span>
                            <span className="text-gray-900 text-xs font-medium">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                    <div>
                      <p className="text-gray-400">总数量</p>
                      <p className="text-sm font-semibold text-gray-900">{reservation.quantity} 件</p>
                    </div>
                    <div>
                      <p className="text-gray-400">申请时间</p>
                      <p className="text-sm text-gray-900">{formatDateTime(reservation.created_at)}</p>
                    </div>
                    {reviewer?.name && (
                      <div>
                        <p className="text-gray-400">审批人</p>
                        <p className="text-sm text-gray-900">{reviewer.name}</p>
                      </div>
                    )}
                    {reservation.reviewed_at && (
                      <div>
                        <p className="text-gray-400">审批时间</p>
                        <p className="text-sm text-gray-900">{formatDateTime(reservation.reviewed_at)}</p>
                      </div>
                    )}
                  </div>

                  {reservation.purpose && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-0.5">用途</p>
                      <p className="text-sm text-gray-700">{reservation.purpose}</p>
                    </div>
                  )}

                  {reservation.review_note && (
                    <div className={`mb-3 px-3 py-2 rounded-lg text-xs ${reservation.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      <span className="font-medium">审批备注：</span>{reservation.review_note}
                    </div>
                  )}

                  {/* 编辑/删除操作 */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    {editingItem?.id === reservation.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                        >
                          <option value="approved">已批准</option>
                          <option value="rejected">已拒绝</option>
                          <option value="completed">已完成</option>
                          <option value="pending">待审批</option>
                        </select>
                        <button
                          onClick={() => handleEditStatus(reservation, editStatus)}
                          disabled={processingId === reservation.id}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => setEditingItem(null)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        {reservation.status === 'approved' && (
                          <button
                            onClick={() => handleRecallApproval(reservation)}
                            disabled={processingId === reservation.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
                          >
                            撤回审批
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingItem(reservation); setEditStatus(reservation.status); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          修改状态
                        </button>
                        {reservation.status !== 'approved' && (
                          <button
                            onClick={() => handleDelete(reservation.id, reservation.status)}
                            disabled={processingId === reservation.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map((reservation) => {
              const supply = reservation.supply as any;
              const requester = reservation.user as any;
              const isProcessing = processingId === reservation.id;

              return (
                <div
                  key={reservation.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 md:p-5"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {reservationItems[reservation.id] && reservationItems[reservation.id].length > 1
                          ? `物资申领 (${reservationItems[reservation.id].length}种)`
                          : (
                            <>
                              {supply?.name || '未知耗材'}
                              {supply?.specification && (
                                <span className="text-gray-400 font-normal ml-1.5">
                                  ({supply.specification})
                                </span>
                              )}
                            </>
                          )
                        }
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        申请人: {requester?.name || '未知'}
                        {requester?.email && (
                          <span className="text-gray-400 ml-1">
                            ({requester.email})
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      待审批
                    </span>
                  </div>

                  {/* Item details */}
                  {reservationItems[reservation.id] && reservationItems[reservation.id].length > 0 ? (
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1.5">申领明细</p>
                      <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
                        {reservationItems[reservation.id].map((item) => (
                          <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="text-gray-900">
                              {item.supply?.name || '未知'}
                              {item.supply?.specification && (
                                <span className="text-gray-400 ml-1">({item.supply.specification})</span>
                              )}
                            </span>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-gray-900 font-medium">x{item.quantity}</span>
                              <span className={`${item.supply && item.supply.stock < item.quantity ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                库存 {item.supply?.stock ?? '-'}{item.supply?.unit ? ` ${item.supply.unit}` : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Fallback: single-item display */
                    <div className="mb-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <p className="text-xs text-gray-400">预约数量</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {reservation.quantity} {supply?.unit || ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">当前库存</p>
                          <p className={`text-sm font-semibold ${supply && supply.stock < reservation.quantity ? 'text-red-600' : 'text-gray-900'}`}>
                            {supply?.stock ?? '-'} {supply?.unit || ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Details */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-400">总数量</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {reservation.quantity} 件
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">是否归还</p>
                      <p className="text-sm text-gray-900">
                        {reservation.is_returnable ? '是' : '否'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">申请时间</p>
                      <p className="text-sm text-gray-900">
                        {formatDateTime(reservation.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-0.5">用途</p>
                    <p className="text-sm text-gray-700">{reservation.purpose}</p>
                  </div>

                  {/* Review note input */}
                  <div className="mb-3">
                    <textarea
                      value={reviewNotes[reservation.id] || ''}
                      onChange={(e) =>
                        setReviewNotes((prev) => ({
                          ...prev,
                          [reservation.id]: e.target.value,
                        }))
                      }
                      placeholder="审批备注 (拒绝时必填)..."
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-colors"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleApprove(reservation)}
                      disabled={isProcessing}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isProcessing ? '处理中...' : '批准'}
                    </button>
                    <button
                      onClick={() => handleReject(reservation)}
                      disabled={isProcessing}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      {isProcessing ? '处理中...' : '拒绝'}
                    </button>
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

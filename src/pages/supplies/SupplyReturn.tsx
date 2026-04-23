import { useEffect, useState, useMemo } from 'react';
import { RotateCcw, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import dayjs from 'dayjs';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../../components/PageHeader';
import SubNav from '../../components/SubNav';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';

interface BorrowingRecord {
  id: string;
  supply_id: string;
  quantity: number;
  purpose: string;
  status: string;
  borrowed_at: string;
  notes: string | null;
  reservation_id: string | null;
  supply: {
    id: string;
    name: string;
    specification: string;
    stock: number;
    unit: string;
  };
}

interface GroupedBorrowings {
  reservationId: string | null; // null = legacy borrowings without reservation link
  borrowedAt: string;
  purpose: string;
  records: BorrowingRecord[];
}

export default function SupplyReturn() {
  const { user } = useAuth();
  const [borrowings, setBorrowings] = useState<BorrowingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Damaged modal state
  const [damagedModalOpen, setDamagedModalOpen] = useState(false);
  const [damagedTarget, setDamagedTarget] = useState<BorrowingRecord | null>(null);
  const [damagedNote, setDamagedNote] = useState('');

  async function fetchBorrowings() {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('supply_borrowings')
        .select(
          'id, supply_id, quantity, purpose, status, borrowed_at, notes, reservation_id, supply:supplies(id, name, specification, stock, unit)'
        )
        .eq('user_id', user.id)
        .eq('status', 'borrowed')
        .order('borrowed_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBorrowings((data as any) || []);
      setSelectedIds(new Set());
    } catch (err: any) {
      const message = err.message || '加载失败';
      if (message.includes('relation') && message.includes('does not exist')) {
        setError('借用功能尚未启用，请联系管理员创建相关数据表');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBorrowings();
  }, [user]);

  // Group by reservation (null reservation → individual groups by borrowing id)
  const groups = useMemo<GroupedBorrowings[]>(() => {
    const byReservation = new Map<string, GroupedBorrowings>();
    const orphans: GroupedBorrowings[] = [];

    for (const b of borrowings) {
      if (b.reservation_id) {
        const existing = byReservation.get(b.reservation_id);
        if (existing) {
          existing.records.push(b);
          // Keep earliest borrowed_at for group
          if (b.borrowed_at < existing.borrowedAt) existing.borrowedAt = b.borrowed_at;
        } else {
          byReservation.set(b.reservation_id, {
            reservationId: b.reservation_id,
            borrowedAt: b.borrowed_at,
            purpose: b.purpose,
            records: [b],
          });
        }
      } else {
        orphans.push({
          reservationId: null,
          borrowedAt: b.borrowed_at,
          purpose: b.purpose,
          records: [b],
        });
      }
    }

    return [...byReservation.values(), ...orphans].sort(
      (a, b) => (a.borrowedAt < b.borrowedAt ? 1 : -1)
    );
  }, [borrowings]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(group: GroupedBorrowings) {
    const groupIds = group.records.map((r) => r.id);
    const allSelected = groupIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(borrowings.map((b) => b.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function returnOne(record: BorrowingRecord) {
    // Check status
    const { data: current } = await supabase
      .from('supply_borrowings')
      .select('status')
      .eq('id', record.id)
      .single();
    if (current?.status !== 'borrowed') return { skipped: true };

    const { error: stockError } = await supabase.rpc('adjust_stock', {
      p_table: 'supplies',
      p_id: record.supply_id,
      p_delta: record.quantity,
    });
    if (stockError) throw stockError;

    const { error: updateError } = await supabase
      .from('supply_borrowings')
      .update({
        status: 'returned',
        returned_at: new Date().toISOString(),
      })
      .eq('id', record.id)
      .eq('status', 'borrowed');
    if (updateError) throw updateError;
    return { skipped: false };
  }

  async function handleReturnSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`确认归还选中的 ${selectedIds.size} 项物品？`)) return;
    setActionLoading(true);
    setError(null);
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) {
        const record = borrowings.find((b) => b.id === id);
        if (!record) continue;
        await returnOne(record);
      }
      setBorrowings((prev) => prev.filter((b) => !selectedIds.has(b.id)));
      setSelectedIds(new Set());
    } catch (err: any) {
      setError(err.message || '批量归还失败');
      // Refresh to reflect partial state
      fetchBorrowings();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReturnGroup(group: GroupedBorrowings) {
    if (!confirm(`确认归还该申领下全部 ${group.records.length} 项物品？`)) return;
    setActionLoading(true);
    setError(null);
    try {
      for (const record of group.records) {
        await returnOne(record);
      }
      const removed = new Set(group.records.map((r) => r.id));
      setBorrowings((prev) => prev.filter((b) => !removed.has(b.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        removed.forEach((id) => next.delete(id));
        return next;
      });
    } catch (err: any) {
      setError(err.message || '归还失败');
      fetchBorrowings();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReturnOne(record: BorrowingRecord) {
    setActionLoading(true);
    setError(null);
    try {
      await returnOne(record);
      setBorrowings((prev) => prev.filter((b) => b.id !== record.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    } catch (err: any) {
      setError(err.message || '归还失败');
    } finally {
      setActionLoading(false);
    }
  }

  function openDamagedModal(record: BorrowingRecord) {
    setDamagedTarget(record);
    setDamagedNote('');
    setDamagedModalOpen(true);
  }

  async function handleMarkDamaged() {
    if (!damagedTarget) return;
    setActionLoading(true);
    setDamagedModalOpen(false);

    try {
      const { data: current } = await supabase
        .from('supply_borrowings')
        .select('status')
        .eq('id', damagedTarget.id)
        .single();
      if (current?.status !== 'borrowed') return;

      const { error: updateError } = await supabase
        .from('supply_borrowings')
        .update({
          status: 'damaged',
          returned_at: new Date().toISOString(),
          notes: damagedNote.trim() || damagedTarget.notes,
        })
        .eq('id', damagedTarget.id)
        .eq('status', 'borrowed');

      if (updateError) throw updateError;

      // No stock restore for damaged items
      setBorrowings((prev) => prev.filter((b) => b.id !== damagedTarget.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(damagedTarget.id);
        return next;
      });
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setActionLoading(false);
      setDamagedTarget(null);
    }
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  const allSelected = borrowings.length > 0 && borrowings.every((b) => selectedIds.has(b.id));

  return (
    <div className={selectedIds.size > 0 ? 'pb-28' : ''}>
      <PageHeader title="物资归还" subtitle="归还借用的非一次性耗材与玻璃器皿" />

      <div className="px-4 md:px-6 mt-2">
        <SubNav items={[
          { to: '/supplies', label: '物资总览', exact: true },
          { to: '/supplies/reserve', label: '申领物资' },
          { to: '/supplies/my-reservations', label: '我的申领' },
          { to: '/supplies/my-returns', label: '归还' },
        ]} />
      </div>

      <div className="px-4 md:px-6">
        {error && (
          <div className="max-w-2xl mx-auto mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
            <button
              onClick={() => { setError(null); fetchBorrowings(); }}
              className="ml-3 underline hover:no-underline cursor-pointer"
            >
              重试
            </button>
          </div>
        )}

        {borrowings.length === 0 && !error ? (
          <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200">
            <EmptyState
              icon={RotateCcw}
              title="暂无待归还物品"
              description="您当前没有需要归还的借用物品"
            />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-2.5">
              <button
                onClick={allSelected ? clearSelection : selectAll}
                className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-blue-600 cursor-pointer"
              >
                {allSelected ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {allSelected ? '取消全选' : '全选'}
              </button>
              <span className="text-xs text-gray-400">
                共 {borrowings.length} 项待归还
              </span>
            </div>

            {groups.map((group) => {
              const groupIds = group.records.map((r) => r.id);
              const groupAllSelected = groupIds.every((id) => selectedIds.has(id));
              const isMulti = group.records.length > 1;

              return (
                <div
                  key={group.reservationId || group.records[0].id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  {/* Group header */}
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <button
                      onClick={() => toggleGroup(group)}
                      className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 cursor-pointer min-w-0"
                    >
                      {groupAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 shrink-0" />
                      )}
                      <span className="font-medium text-gray-700">
                        {isMulti ? `申领 ${group.records.length} 项` : group.records[0].supply.name}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {dayjs(group.borrowedAt).format('YYYY-MM-DD')}
                      </span>
                    </button>
                    {isMulti && (
                      <button
                        onClick={() => handleReturnGroup(group)}
                        disabled={actionLoading}
                        className="shrink-0 px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        全部归还
                      </button>
                    )}
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-gray-50">
                    {group.records.map((record) => {
                      const checked = selectedIds.has(record.id);
                      return (
                        <div
                          key={record.id}
                          className={`px-4 py-3 ${checked ? 'bg-blue-50/50' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleOne(record.id)}
                              className="shrink-0 mt-0.5 cursor-pointer"
                            >
                              {checked ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {record.supply.name}
                                {record.supply.specification && (
                                  <span className="text-xs text-gray-400 font-normal ml-1.5">
                                    ({record.supply.specification})
                                  </span>
                                )}
                              </p>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                                <span>
                                  数量:
                                  <span className="font-medium text-gray-700 ml-0.5">
                                    {record.quantity} {record.supply.unit}
                                  </span>
                                </span>
                                <span>
                                  借用: {dayjs(record.borrowed_at).format('MM-DD HH:mm')}
                                </span>
                              </div>
                              {record.purpose && !isMulti && (
                                <p className="mt-1 text-xs text-gray-500">
                                  用途: <span className="text-gray-700">{record.purpose}</span>
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 flex flex-col gap-1.5">
                              <button
                                onClick={() => handleReturnOne(record)}
                                disabled={actionLoading}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              >
                                归还
                              </button>
                              <button
                                onClick={() => openDamagedModal(record)}
                                disabled={actionLoading}
                                className="px-3 py-1 text-red-600 bg-red-50 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              >
                                报损
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Group-level purpose for multi */}
                  {isMulti && group.purpose && (
                    <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-50 bg-gray-50">
                      用途: <span className="text-gray-700">{group.purpose}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky bottom bar for batch return */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <span className="text-sm text-gray-600">
              已选 <span className="font-semibold text-blue-600">{selectedIds.size}</span> 项
            </span>
            <div className="flex-1" />
            <button
              onClick={clearSelection}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleReturnSelected}
              disabled={actionLoading}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {actionLoading ? '处理中...' : '批量归还'}
            </button>
          </div>
        </div>
      )}

      {/* Damaged Confirmation Modal */}
      <Modal
        open={damagedModalOpen}
        onClose={() => setDamagedModalOpen(false)}
        title="报损登记"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setDamagedModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleMarkDamaged}
              className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
            >
              确认报损
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">确定要将此物品登记为报损吗？</p>
              <p className="mt-1 text-amber-700">
                登记报损后，该物品库存将不会恢复。属于正常损耗范围。
              </p>
            </div>
          </div>

          {damagedTarget && (
            <div className="text-sm text-gray-600">
              <p>物品: <span className="font-medium text-gray-900">{damagedTarget.supply.name}</span></p>
              <p>数量: {damagedTarget.quantity} {damagedTarget.supply.unit}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              报损说明 <span className="text-gray-400 font-normal">(选填)</span>
            </label>
            <textarea
              value={damagedNote}
              onChange={(e) => setDamagedNote(e.target.value)}
              placeholder="请说明损坏情况..."
              rows={3}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
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
  supply: {
    id: string;
    name: string;
    specification: string;
    stock: number;
    unit: string;
  };
}

export default function SupplyReturn() {
  const { user } = useAuth();
  const [borrowings, setBorrowings] = useState<BorrowingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
        .select('id, supply_id, quantity, purpose, status, borrowed_at, notes, supply:supplies(id, name, specification, stock, unit)')
        .eq('user_id', user.id)
        .eq('status', 'borrowed')
        .order('borrowed_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBorrowings((data as any) || []);
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

  async function handleReturn(record: BorrowingRecord) {
    setActionLoading(record.id);
    try {
      // Increase supply stock FIRST
      const { error: stockError } = await supabase.rpc('adjust_stock', {
        p_table: 'supplies',
        p_id: record.supply_id,
        p_delta: record.quantity,
      });
      if (stockError) throw stockError;

      // Update borrowing status after stock succeeds
      const { error: updateError } = await supabase
        .from('supply_borrowings')
        .update({
          status: 'returned',
          returned_at: new Date().toISOString(),
        })
        .eq('id', record.id);

      if (updateError) throw updateError;

      // Remove from list
      setBorrowings((prev) => prev.filter((b) => b.id !== record.id));
    } catch (err: any) {
      setError(err.message || '归还操作失败');
    } finally {
      setActionLoading(null);
    }
  }

  function openDamagedModal(record: BorrowingRecord) {
    setDamagedTarget(record);
    setDamagedNote('');
    setDamagedModalOpen(true);
  }

  async function handleMarkDamaged() {
    if (!damagedTarget) return;
    setActionLoading(damagedTarget.id);
    setDamagedModalOpen(false);

    try {
      const { error: updateError } = await supabase
        .from('supply_borrowings')
        .update({
          status: 'damaged',
          returned_at: new Date().toISOString(),
          notes: damagedNote.trim() || damagedTarget.notes,
        })
        .eq('id', damagedTarget.id);

      if (updateError) throw updateError;

      // Do NOT increase stock for damaged items
      setBorrowings((prev) => prev.filter((b) => b.id !== damagedTarget.id));
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setActionLoading(null);
      setDamagedTarget(null);
    }
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <PageHeader title="耗材归还" subtitle="归还已借用的耗材" />

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
            {borrowings.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-xl border border-gray-200 p-4 md:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {record.supply.name}
                    </h3>
                    {record.supply.specification && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {record.supply.specification}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      <span>
                        数量: <span className="font-medium text-gray-700">{record.quantity} {record.supply.unit}</span>
                      </span>
                      <span>
                        借用时间: {dayjs(record.borrowed_at).format('YYYY-MM-DD HH:mm')}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      用途: <span className="text-gray-700">{record.purpose}</span>
                    </p>
                    {record.notes && (
                      <p className="mt-1 text-xs text-gray-400">
                        备注: {record.notes}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col gap-2">
                    <button
                      onClick={() => handleReturn(record)}
                      disabled={actionLoading === record.id}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {actionLoading === record.id ? '处理中...' : '归还'}
                    </button>
                    <button
                      onClick={() => openDamagedModal(record)}
                      disabled={actionLoading === record.id}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      报损
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

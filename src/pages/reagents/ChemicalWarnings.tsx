import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import SubNav from '../../components/SubNav';
import type { SubNavItem } from '../../components/SubNav';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import dayjs from 'dayjs';

const SUB_NAV_ITEMS: SubNavItem[] = [
  { to: '/reagents', label: '药品总览', exact: true },
  { to: '/reagents/purchase', label: '申购药品' },
  { to: '/reagents/warnings', label: '药品补货', managerModule: 'chemicals' },
];

interface Warning {
  id: string;
  chemical_id: string;
  reported_by: string;
  status: 'pending' | 'ordered' | 'arrived';
  reported_at: string;
  estimated_delivery_date: string | null;
  arrived_at: string | null;
  chemical: { id: string; name: string; batch_number: string | null; stock: number; unit: string | null };
  reporter: { name: string } | null;
}

export default function ChemicalWarnings() {
  const { } = useAuth();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline order form state: which warning is being ordered
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [estimatedDate, setEstimatedDate] = useState('');

  // Stock update state
  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null);
  const [stockValue, setStockValue] = useState('');

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchWarnings();
  }, []);

  async function fetchWarnings() {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('chemical_warnings')
        .select('*, chemical:chemicals(id, name, batch_number, stock, unit), reporter:profiles!chemical_warnings_reported_by_fkey(name)')
        .order('reported_at', { ascending: false });

      if (fetchError) throw fetchError;

      const items = (data || []) as Warning[];

      // Auto-arrival: update 'ordered' items where estimated_delivery_date <= today
      const today = dayjs().format('YYYY-MM-DD');
      const autoArriveItems = items.filter(
        (w) => w.status === 'ordered' && w.estimated_delivery_date && w.estimated_delivery_date <= today
      );

      if (autoArriveItems.length > 0) {
        const ids = autoArriveItems.map((w) => w.id);
        await supabase
          .from('chemical_warnings')
          .update({ status: 'arrived', arrived_at: new Date().toISOString() })
          .in('id', ids);

        // Update local state
        for (const item of items) {
          if (ids.includes(item.id)) {
            item.status = 'arrived';
            item.arrived_at = new Date().toISOString();
          }
        }
      }

      setWarnings(items);
    } catch (err: any) {
      setError(err.message || '加载上报列表失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkOrdered(warningId: string) {
    if (!estimatedDate) return;
    try {
      setActionLoading(true);
      const { error: updateError } = await supabase
        .from('chemical_warnings')
        .update({ status: 'ordered', estimated_delivery_date: estimatedDate })
        .eq('id', warningId);
      if (updateError) throw updateError;
      setOrderingId(null);
      setEstimatedDate('');
      await fetchWarnings();
    } catch (err: any) {
      alert('操作失败: ' + (err.message || '未知错误'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkArrived(warningId: string, chemicalId: string) {
    try {
      setActionLoading(true);
      const { error: updateError } = await supabase
        .from('chemical_warnings')
        .update({ status: 'arrived', arrived_at: new Date().toISOString() })
        .eq('id', warningId);
      if (updateError) throw updateError;

      // If user entered a stock value, update the chemical stock
      if (updatingStockId === warningId && stockValue) {
        const newStock = parseInt(stockValue, 10);
        if (!isNaN(newStock) && newStock >= 0) {
          await supabase.from('chemicals').update({ stock: newStock }).eq('id', chemicalId);
        }
      }

      setUpdatingStockId(null);
      setStockValue('');
      await fetchWarnings();
    } catch (err: any) {
      alert('操作失败: ' + (err.message || '未知错误'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRecallArrived(warningId: string) {
    if (!confirm('确定要撤回送达状态吗？该记录将恢复为已下单状态。')) return;
    try {
      setActionLoading(true);
      const { error: updateError } = await supabase
        .from('chemical_warnings')
        .update({ status: 'ordered', arrived_at: null })
        .eq('id', warningId);
      if (updateError) throw updateError;
      await fetchWarnings();
    } catch (err: any) {
      alert('撤回失败: ' + (err.message || '未知错误'));
    } finally {
      setActionLoading(false);
    }
  }

  const pending = warnings.filter((w) => w.status === 'pending');
  const ordered = warnings.filter((w) => w.status === 'ordered');
  const arrived = warnings.filter(
    (w) => w.status === 'arrived' && w.arrived_at && dayjs(w.arrived_at).isAfter(dayjs().subtract(30, 'day'))
  );

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-medium">加载失败</p>
          <p className="mt-1 text-sm">{error}</p>
          <button onClick={fetchWarnings} className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">
            重试
          </button>
        </div>
      </div>
    );
  }

  const hasAny = pending.length > 0 || ordered.length > 0 || arrived.length > 0;

  return (
    <div className="mx-auto max-w-7xl p-4">
      <PageHeader title="药品补货管理" subtitle="处理药品「即将用完」上报" />
      <SubNav items={SUB_NAV_ITEMS} />

      {!hasAny && (
        <div className="mt-8">
          <EmptyState title="暂无上报记录" />
        </div>
      )}

      {/* 即将用完 */}
      {pending.length > 0 && (
        <section className="mt-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
            即将用完
            <span className="text-sm font-normal text-gray-500">({pending.length})</span>
          </h2>
          <div className="mt-3 space-y-3">
            {pending.map((w) => (
              <Card key={w.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{w.chemical?.name || '未知药品'}</span>
                      {w.chemical?.batch_number && (
                        <span className="inline-flex items-center rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
                          {w.chemical.batch_number}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                      {w.reporter?.name && <span>上报人: {w.reporter.name}</span>}
                      <span>上报时间: {dayjs(w.reported_at).format('YYYY-MM-DD HH:mm')}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {orderingId === w.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={estimatedDate}
                          onChange={(e) => setEstimatedDate(e.target.value)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => handleMarkOrdered(w.id)}
                          disabled={actionLoading || !estimatedDate}
                          className="rounded-md bg-yellow-500 px-3 py-1 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => { setOrderingId(null); setEstimatedDate(''); }}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          取消
                        </button>
                      </div>
                    ) : updatingStockId === w.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="新库存（可选）"
                          value={stockValue}
                          onChange={(e) => setStockValue(e.target.value)}
                          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => handleMarkArrived(w.id, w.chemical_id)}
                          disabled={actionLoading}
                          className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          确认送达
                        </button>
                        <button
                          onClick={() => { setUpdatingStockId(null); setStockValue(''); }}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setOrderingId(w.id);
                            setEstimatedDate(dayjs().add(2, 'day').format('YYYY-MM-DD'));
                          }}
                          className="rounded-md bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-600"
                        >
                          已下单
                        </button>
                        <button
                          onClick={() => { setUpdatingStockId(w.id); setStockValue(''); }}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                        >
                          已送达
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* 已下单 */}
      {ordered.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
            已下单
            <span className="text-sm font-normal text-gray-500">({ordered.length})</span>
          </h2>
          <div className="mt-3 space-y-3">
            {ordered.map((w) => (
              <Card key={w.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{w.chemical?.name || '未知药品'}</span>
                      {w.chemical?.batch_number && (
                        <span className="inline-flex items-center rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
                          {w.chemical.batch_number}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                      <span>下单时间: {dayjs(w.reported_at).format('MM-DD')}</span>
                      {w.estimated_delivery_date && (
                        <span>预计送达: {dayjs(w.estimated_delivery_date).format('MM-DD')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {updatingStockId === w.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="新库存"
                          value={stockValue}
                          onChange={(e) => setStockValue(e.target.value)}
                          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => handleMarkArrived(w.id, w.chemical_id)}
                          disabled={actionLoading}
                          className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          确认送达
                        </button>
                        <button
                          onClick={() => { setUpdatingStockId(null); setStockValue(''); }}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setUpdatingStockId(w.id)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          更新库存
                        </button>
                        <button
                          onClick={() => handleMarkArrived(w.id, w.chemical_id)}
                          disabled={actionLoading}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          已送达
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* 最近送达 */}
      {arrived.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
            最近送达
            <span className="text-sm font-normal text-gray-500">({arrived.length})</span>
          </h2>
          <div className="mt-3 space-y-3">
            {arrived.map((w) => (
              <Card key={w.id} className="opacity-75">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-700">{w.chemical?.name || '未知药品'}</span>
                      {w.chemical?.batch_number && (
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 border border-gray-200">
                          {w.chemical.batch_number}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-400">
                      {w.reporter?.name && <span>上报人: {w.reporter.name}</span>}
                      <span>上报: {dayjs(w.reported_at).format('YYYY-MM-DD')}</span>
                      {w.arrived_at && <span>送达: {dayjs(w.arrived_at).format('YYYY-MM-DD HH:mm')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      已完成
                    </span>
                    <button
                      onClick={() => handleRecallArrived(w.id)}
                      disabled={actionLoading}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 transition-colors"
                    >
                      撤回送达
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

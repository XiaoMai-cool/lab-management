import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import dayjs from 'dayjs';

const MOVEMENT_TYPE_LABELS: Record<string, { text: string; color: string }> = {
  purchase_in: { text: '采购入库', color: 'text-green-700 bg-green-50' },
  return_in: { text: '退还入库', color: 'text-blue-700 bg-blue-50' },
  use_out: { text: '领用出库', color: 'text-orange-700 bg-orange-50' },
  dispose_out: { text: '废弃出库', color: 'text-red-700 bg-red-50' },
  adjust: { text: '库存调整', color: 'text-gray-700 bg-gray-100' },
};

interface Chemical {
  id: string;
  name: string;
  cas_number: string | null;
  stock: number;
  unit: string | null;
}

interface Movement {
  id: string;
  chemical_id: string;
  movement_type: string;
  quantity: number;
  purpose: string | null;
  notes: string | null;
  created_at: string;
  chemical: { name: string; unit: string | null } | null;
  user: { name: string } | null;
}

type ActiveSection = 'in' | 'out' | 'adjust' | 'history';

export default function ReagentStockMovement() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<ActiveSection>('in');
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // 搜索
  const [chemSearch, setChemSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // 入库表单
  const [inForm, setInForm] = useState({
    chemical_id: '',
    chemical_name: '',
    quantity: 1,
    batch_number: '',
    type: 'purchase_in',
    notes: '',
  });

  // 出库表单
  const [outForm, setOutForm] = useState({
    chemical_id: '',
    chemical_name: '',
    quantity: 1,
    type: 'use_out',
    purpose: '',
    maxStock: 0,
  });

  // 调整表单
  const [adjustForm, setAdjustForm] = useState({
    chemical_id: '',
    chemical_name: '',
    new_stock: 0,
    stock: 0,
    reason: '',
  });

  // 历史过滤
  const [filterType, setFilterType] = useState('');
  const [filterChemical, setFilterChemical] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    fetchChemicals();
  }, []);

  useEffect(() => {
    if (activeSection === 'history') fetchMovements();
  }, [activeSection, filterType, filterChemical, filterDateFrom, filterDateTo]);

  async function fetchChemicals() {
    const { data } = await supabase
      .from('chemicals')
      .select('id, name, cas_number, stock, unit')
      .order('name');
    setChemicals(data || []);
  }

  async function fetchMovements() {
    try {
      setLoading(true);
      let query = supabase
        .from('reagent_stock_movements')
        .select('*, chemical:chemicals(name, unit), user:profiles(name)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filterType) query = query.eq('movement_type', filterType);
      if (filterChemical) query = query.eq('chemical_id', filterChemical);
      if (filterDateFrom) query = query.gte('created_at', filterDateFrom);
      if (filterDateTo) query = query.lte('created_at', filterDateTo + 'T23:59:59');

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setMovements(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredChemicals = chemSearch.trim()
    ? chemicals.filter(
        (c) =>
          c.name.toLowerCase().includes(chemSearch.toLowerCase()) ||
          c.cas_number?.includes(chemSearch)
      ).slice(0, 10)
    : [];

  function selectChemicalFor(section: 'in' | 'out' | 'adjust', chem: Chemical) {
    if (section === 'in') {
      setInForm((p) => ({ ...p, chemical_id: chem.id, chemical_name: chem.name }));
    } else if (section === 'out') {
      setOutForm((p) => ({
        ...p,
        chemical_id: chem.id,
        chemical_name: chem.name,
        maxStock: chem.stock,
      }));
    } else {
      setAdjustForm((p) => ({
        ...p,
        chemical_id: chem.id,
        chemical_name: chem.name,
        stock: chem.stock,
        new_stock: chem.stock,
      }));
    }
    setChemSearch('');
    setShowDropdown(false);
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function handleStockIn(e: React.FormEvent) {
    e.preventDefault();
    if (!inForm.chemical_id) { setError('请选择药品'); return; }
    try {
      setSubmitting(true);
      setError(null);

      const { error: mvErr } = await supabase.from('reagent_stock_movements').insert({
        chemical_id: inForm.chemical_id,
        movement_type: inForm.type,
        quantity: inForm.quantity,
        notes: [inForm.batch_number && `批次: ${inForm.batch_number}`, inForm.notes].filter(Boolean).join(' | ') || null,
        user_id: user?.id,
      });
      if (mvErr) throw mvErr;

      const chem = chemicals.find((c) => c.id === inForm.chemical_id);
      if (chem) {
        await supabase
          .from('chemicals')
          .update({ stock: chem.stock + inForm.quantity })
          .eq('id', inForm.chemical_id);
      }

      setInForm({ chemical_id: '', chemical_name: '', quantity: 1, batch_number: '', type: 'purchase_in', notes: '' });
      fetchChemicals();
      showSuccess('入库成功！');
    } catch (err: any) {
      setError(err.message || '入库失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStockOut(e: React.FormEvent) {
    e.preventDefault();
    if (!outForm.chemical_id) { setError('请选择药品'); return; }
    if (outForm.quantity > outForm.maxStock) { setError('出库数量不能超过当前库存'); return; }
    try {
      setSubmitting(true);
      setError(null);

      const { error: mvErr } = await supabase.from('reagent_stock_movements').insert({
        chemical_id: outForm.chemical_id,
        movement_type: outForm.type,
        quantity: -outForm.quantity,
        purpose: outForm.purpose || null,
        user_id: user?.id,
      });
      if (mvErr) throw mvErr;

      const chem = chemicals.find((c) => c.id === outForm.chemical_id);
      if (chem) {
        await supabase
          .from('chemicals')
          .update({ stock: chem.stock - outForm.quantity })
          .eq('id', outForm.chemical_id);
      }

      setOutForm({ chemical_id: '', chemical_name: '', quantity: 1, type: 'use_out', purpose: '', maxStock: 0 });
      fetchChemicals();
      showSuccess('出库成功！');
    } catch (err: any) {
      setError(err.message || '出库失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustForm.chemical_id) { setError('请选择药品'); return; }
    if (!adjustForm.reason.trim()) { setError('请填写调整原因'); return; }
    try {
      setSubmitting(true);
      setError(null);

      const diff = adjustForm.new_stock - adjustForm.stock;

      const { error: mvErr } = await supabase.from('reagent_stock_movements').insert({
        chemical_id: adjustForm.chemical_id,
        movement_type: 'adjust',
        quantity: diff,
        notes: adjustForm.reason,
        user_id: user?.id,
      });
      if (mvErr) throw mvErr;

      await supabase
        .from('chemicals')
        .update({ stock: adjustForm.new_stock })
        .eq('id', adjustForm.chemical_id);

      setAdjustForm({ chemical_id: '', chemical_name: '', new_stock: 0, stock: 0, reason: '' });
      fetchChemicals();
      showSuccess('库存调整成功！');
    } catch (err: any) {
      setError(err.message || '调整失败');
    } finally {
      setSubmitting(false);
    }
  }

  function ChemicalSearchInput({ onSelect }: { onSelect: (c: Chemical) => void }) {
    return (
      <div className="relative">
        <label className="mb-1 block text-sm font-medium text-gray-700">选择药品</label>
        <input
          type="text"
          value={chemSearch}
          onChange={(e) => {
            setChemSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="input"
          placeholder="搜索药品名称或 CAS 号..."
        />
        {showDropdown && filteredChemicals.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {filteredChemicals.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => onSelect(c)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-gray-400">库存: {c.stock} {c.unit || ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      <PageHeader title="出入库管理" />

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {successMsg && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{successMsg}</div>
      )}

      {/* Section 切换 */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'in' as const, label: '入库' },
          { key: 'out' as const, label: '出库' },
          { key: 'adjust' as const, label: '库存调整' },
          { key: 'history' as const, label: '出入库历史' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setActiveSection(item.key);
              setError(null);
            }}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeSection === item.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 入库 */}
      {activeSection === 'in' && (
        <form onSubmit={handleStockIn} className="mt-6">
          <Card>
            <h3 className="mb-4 font-medium text-gray-900">入库登记</h3>
            <div className="space-y-4">
              <ChemicalSearchInput onSelect={(c) => selectChemicalFor('in', c)} />
              {inForm.chemical_name && (
                <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  已选择: <strong>{inForm.chemical_name}</strong>
                </p>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">入库类型</label>
                <select
                  value={inForm.type}
                  onChange={(e) => setInForm((p) => ({ ...p, type: e.target.value }))}
                  className="input"
                >
                  <option value="purchase_in">采购入库</option>
                  <option value="return_in">退还入库</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">数量</label>
                <input
                  type="number"
                  min={1}
                  value={inForm.quantity}
                  onChange={(e) => setInForm((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                  className="input"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">批次号</label>
                <input
                  type="text"
                  value={inForm.batch_number}
                  onChange={(e) => setInForm((p) => ({ ...p, batch_number: e.target.value }))}
                  className="input"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">备注</label>
                <textarea
                  value={inForm.notes}
                  onChange={(e) => setInForm((p) => ({ ...p, notes: e.target.value }))}
                  className="input min-h-[60px]"
                />
              </div>
            </div>

            <div className="mt-4">
              <button
                type="submit"
                disabled={submitting || !inForm.chemical_id}
                className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认入库'}
              </button>
            </div>
          </Card>
        </form>
      )}

      {/* 出库 */}
      {activeSection === 'out' && (
        <form onSubmit={handleStockOut} className="mt-6">
          <Card>
            <h3 className="mb-4 font-medium text-gray-900">出库登记</h3>
            <div className="space-y-4">
              <ChemicalSearchInput onSelect={(c) => selectChemicalFor('out', c)} />
              {outForm.chemical_name && (
                <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  已选择: <strong>{outForm.chemical_name}</strong>
                  <span className="ml-2 text-blue-500">（当前库存: {outForm.maxStock}）</span>
                </p>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">出库类型</label>
                <select
                  value={outForm.type}
                  onChange={(e) => setOutForm((p) => ({ ...p, type: e.target.value }))}
                  className="input"
                >
                  <option value="use_out">领用出库</option>
                  <option value="dispose_out">废弃出库</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  数量
                  {outForm.maxStock > 0 && (
                    <span className="ml-1 text-xs font-normal text-gray-400">
                      （最多 {outForm.maxStock}）
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min={1}
                  max={outForm.maxStock || undefined}
                  value={outForm.quantity}
                  onChange={(e) => setOutForm((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                  className="input"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">用途</label>
                <textarea
                  value={outForm.purpose}
                  onChange={(e) => setOutForm((p) => ({ ...p, purpose: e.target.value }))}
                  className="input min-h-[60px]"
                  placeholder="请描述出库用途"
                />
              </div>
            </div>

            <div className="mt-4">
              <button
                type="submit"
                disabled={submitting || !outForm.chemical_id}
                className="rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认出库'}
              </button>
            </div>
          </Card>
        </form>
      )}

      {/* 库存调整 */}
      {activeSection === 'adjust' && (
        <form onSubmit={handleAdjust} className="mt-6">
          <Card>
            <h3 className="mb-4 font-medium text-gray-900">库存调整</h3>
            <div className="space-y-4">
              <ChemicalSearchInput onSelect={(c) => selectChemicalFor('adjust', c)} />
              {adjustForm.chemical_name && (
                <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  已选择: <strong>{adjustForm.chemical_name}</strong>
                  <span className="ml-2 text-blue-500">（当前库存: {adjustForm.stock}）</span>
                </p>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">新库存数量</label>
                <input
                  type="number"
                  min={0}
                  value={adjustForm.new_stock}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, new_stock: parseInt(e.target.value) || 0 }))}
                  className="input"
                />
                {adjustForm.chemical_id && (
                  <p className="mt-1 text-xs text-gray-400">
                    调整幅度: {adjustForm.new_stock - adjustForm.stock > 0 ? '+' : ''}
                    {adjustForm.new_stock - adjustForm.stock}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  调整原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))}
                  className="input min-h-[60px]"
                  placeholder="请填写调整原因，如盘点差异等"
                  required
                />
              </div>
            </div>

            <div className="mt-4">
              <button
                type="submit"
                disabled={submitting || !adjustForm.chemical_id}
                className="rounded-lg bg-gray-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认调整'}
              </button>
            </div>
          </Card>
        </form>
      )}

      {/* 出入库历史 */}
      {activeSection === 'history' && (
        <div className="mt-6">
          {/* 过滤器 */}
          <Card className="mb-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">类型</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="input text-sm"
                >
                  <option value="">全部类型</option>
                  {Object.entries(MOVEMENT_TYPE_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>{val.text}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">药品</label>
                <select
                  value={filterChemical}
                  onChange={(e) => setFilterChemical(e.target.value)}
                  className="input text-sm"
                >
                  <option value="">全部药品</option>
                  {chemicals.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">开始日期</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">结束日期</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="input text-sm"
                />
              </div>
            </div>
          </Card>

          {loading ? (
            <LoadingSpinner />
          ) : movements.length === 0 ? (
            <EmptyState title="暂无出入库记录" />
          ) : (
            <div className="space-y-2">
              {movements.map((m) => {
                const typeInfo = MOVEMENT_TYPE_LABELS[m.movement_type] || {
                  text: m.movement_type,
                  color: 'text-gray-700 bg-gray-50',
                };
                return (
                  <div key={m.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {m.chemical?.name || '未知药品'}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeInfo.color}`}>
                          {typeInfo.text}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {m.quantity > 0 ? '+' : ''}{m.quantity} {m.chemical?.unit || ''}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-400">
                        <span>{dayjs(m.created_at).format('YYYY-MM-DD HH:mm')}</span>
                        {m.user?.name && <span>操作人: {m.user.name}</span>}
                      </div>
                      {m.purpose && <p className="mt-0.5 text-xs text-gray-500">{m.purpose}</p>}
                      {m.notes && <p className="mt-0.5 text-xs text-gray-400">{m.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

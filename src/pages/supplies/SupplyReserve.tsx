import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, CheckCircle, RefreshCw, ChevronDown, ChevronRight, Minus, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Supply } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import SubNav from '../../components/SubNav';

interface SelectedItem {
  supply: Supply;
  quantity: number;
}

const PURPOSE_TAGS = ['课题实验', '教学用', '仪器维护', '样品处理', '安全防护', '其他'];

export default function SupplyReserve() {
  const { user } = useAuth();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
  const [purpose, setPurpose] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const purposeInputRef = useRef<HTMLInputElement>(null);

  async function fetchSupplies() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplies')
        .select('*, category:supply_categories(id, name, sort_order)')
        .order('name');

      if (error) throw error;
      setSupplies(data || []);

      // Expand all groups by default
      const groups = new Set<string>();
      (data || []).forEach((s: any) => {
        groups.add((s.category as any)?.name || '其他');
      });
      setExpandedGroups(groups);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSupplies();
  }, []);

  // Warn before leaving with unsaved data
  useEffect(() => {
    const hasData = selectedItems.size > 0;
    if (!hasData || success) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [selectedItems, success]);

  const groupedSupplies = useMemo(() => {
    const filtered = supplies.filter(
      (s) =>
        !searchTerm ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.specification.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups: Record<string, Supply[]> = {};
    for (const s of filtered) {
      const catName = (s.category as any)?.name || '其他';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(s);
    }

    return Object.entries(groups)
      .map(([category, items]) => ({ category, items }))
      .sort((a, b) => {
        const aOrder = (a.items[0]?.category as any)?.sort_order ?? 999;
        const bOrder = (b.items[0]?.category as any)?.sort_order ?? 999;
        return aOrder - bOrder;
      });
  }, [supplies, searchTerm]);

  function toggleGroup(category: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function toggleItem(supply: Supply) {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(supply.id)) {
        next.delete(supply.id);
      } else {
        next.set(supply.id, { supply, quantity: 1 });
      }
      return next;
    });
  }

  function updateQuantity(supplyId: string, quantity: number) {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      const item = next.get(supplyId);
      if (item) {
        const maxQty = item.supply.stock;
        const clampedQty = Math.max(1, Math.min(quantity, maxQty));
        next.set(supplyId, { ...item, quantity: clampedQty });
      }
      return next;
    });
  }

  function handlePurposeTag(tag: string) {
    if (tag === '其他') {
      setPurpose('');
      purposeInputRef.current?.focus();
    } else {
      setPurpose(tag);
    }
  }

  function resetForm() {
    setSelectedItems(new Map());
    setPurpose('');
    setSearchTerm('');
    setSuccess(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!user || selectedItems.size === 0) {
      setError('请至少选择一项物资');
      return;
    }

    // Validate quantities
    for (const [, item] of selectedItems) {
      if (item.quantity > item.supply.stock) {
        setError(`"${item.supply.name}" 申领数量超过库存`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const itemsArray = Array.from(selectedItems.values());
      const firstItem = itemsArray[0];
      const totalQuantity = itemsArray.reduce((sum, item) => sum + item.quantity, 0);

      // Create reservation header (supply_id is NOT NULL, use first item for backward compat)
      const { data: reservation, error: insertError } = await supabase
        .from('supply_reservations')
        .insert({
          supply_id: firstItem.supply.id,
          user_id: user.id,
          quantity: totalQuantity,
          purpose: purpose.trim() || '',
          is_returnable: false,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Create reservation items
      const itemRecords = itemsArray.map((item) => ({
        reservation_id: reservation.id,
        supply_id: item.supply.id,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('supply_reservation_items')
        .insert(itemRecords);

      if (itemsError) throw itemsError;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || '提交失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-sm text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <PageHeader title="申领物资" />
        <div className="px-4 md:px-6 mt-2">
          <SubNav items={[
            { to: '/supplies', label: '物资总览', exact: true },
            { to: '/supplies/reserve', label: '申领物资' },
            { to: '/supplies/my-reservations', label: '我的申领' },
            { to: '/supplies/my-returns', label: '归还' },
          ]} />
        </div>
        <div className="px-4 md:px-6">
          <div className="max-w-lg mx-auto bg-white rounded-xl border border-gray-200 p-8 text-center">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              申领提交成功
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              您的物资申领已提交，请等待管理员审批。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={resetForm}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                继续申领
              </button>
              <Link
                to="/supplies/my-reservations"
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                查看我的申领
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedCount = selectedItems.size;

  return (
    <div className="pb-32">
      <PageHeader title="申领物资" subtitle="选择需要的物资，提交后等待审批" />

      <div className="px-4 md:px-6 mt-2">
        <SubNav items={[
          { to: '/supplies', label: '物资总览', exact: true },
          { to: '/supplies/reserve', label: '申领物资' },
          { to: '/supplies/my-reservations', label: '我的申领' },
          { to: '/supplies/my-returns', label: '归还' },
        ]} />
      </div>

      <div className="px-4 md:px-6">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto space-y-5"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索物资名称..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Categorized supply list */}
          <div className="space-y-2">
            {groupedSupplies.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
                没有找到匹配的物资
              </div>
            ) : (
              groupedSupplies.map((group) => (
                <div key={group.category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Category header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.category)}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {expandedGroups.has(group.category) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-gray-700">
                      {group.category}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({group.items.length})
                    </span>
                  </button>

                  {/* Items */}
                  {expandedGroups.has(group.category) && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {group.items.map((supply) => {
                        const isSelected = selectedItems.has(supply.id);
                        const isOutOfStock = supply.stock <= 0;
                        const item = selectedItems.get(supply.id);
                        const isReturnable = supply.is_returnable;

                        return (
                          <div
                            key={supply.id}
                            className={`px-4 py-3 ${isOutOfStock ? 'opacity-50' : ''} ${isSelected ? 'bg-blue-50/50' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Checkbox */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isOutOfStock}
                                onChange={() => toggleItem(supply)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                              />

                              {/* Supply info */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-medium text-gray-900">
                                    {supply.name}
                                  </span>
                                  {supply.specification && (
                                    <span className="text-xs text-gray-400">
                                      ({supply.specification})
                                    </span>
                                  )}
                                  {isReturnable && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded font-medium">
                                      可归还
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Stock */}
                              <span
                                className={`text-xs shrink-0 ${
                                  isOutOfStock
                                    ? 'text-red-500'
                                    : supply.stock <= supply.min_stock
                                      ? 'text-amber-500'
                                      : 'text-gray-400'
                                }`}
                              >
                                {isOutOfStock ? '无库存' : `库存 ${supply.stock}${supply.unit}`}
                              </span>
                            </div>

                            {/* Quantity input (shown when selected) */}
                            {isSelected && item && (
                              <div className="mt-2 ml-7 flex items-center gap-2">
                                <span className="text-xs text-gray-500">数量:</span>
                                <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(supply.id, item.quantity - 1)}
                                    disabled={item.quantity <= 1}
                                    className="px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    max={supply.stock}
                                    value={item.quantity}
                                    onChange={(e) =>
                                      updateQuantity(supply.id, parseInt(e.target.value) || 1)
                                    }
                                    className="w-12 text-center text-sm py-1 border-x border-gray-200 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(supply.id, item.quantity + 1)}
                                    disabled={item.quantity >= supply.stock}
                                    className="px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <span className="text-xs text-gray-400">{supply.unit}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Purpose with quick tags */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              用途 <span className="text-gray-400 font-normal">(选填)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PURPOSE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handlePurposeTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    purpose === tag
                      ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <input
              ref={purposeInputRef}
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="请简要说明用途"
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>
        </form>
      </div>

      {/* Sticky bottom summary */}
      {selectedCount > 0 && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30">
          <div className="max-w-2xl mx-auto px-4 py-3">
            {/* Selected items list */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Array.from(selectedItems.values()).map(({ supply, quantity }) => (
                <span
                  key={supply.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg"
                >
                  {supply.name} x{quantity}
                  <button
                    type="button"
                    onClick={() => toggleItem(supply)}
                    className="hover:text-blue-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedCount === 0}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {submitting
                ? '提交中...'
                : `提交申领 (${selectedCount}项)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

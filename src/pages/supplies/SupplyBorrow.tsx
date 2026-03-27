import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, CheckCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Supply } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';

interface GroupedSupply {
  category: string;
  items: Supply[];
}

export default function SupplyBorrow() {
  const { user } = useAuth();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedSupplyId, setSelectedSupplyId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  async function fetchSupplies() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('supplies')
        .select('*, category:supply_categories(id, name, sort_order)')
        .order('name');

      if (fetchError) throw fetchError;
      setSupplies(data || []);
    } catch (err: any) {
      setError(err.message || '加载耗材列表失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSupplies();
  }, []);

  const selectedSupply = useMemo(
    () => supplies.find((s) => s.id === selectedSupplyId) || null,
    [supplies, selectedSupplyId]
  );

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
      .map(([category, items]) => ({ category, items }) as GroupedSupply)
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [supplies, searchTerm]);

  function resetForm() {
    setSelectedSupplyId('');
    setQuantity(1);
    setPurpose('');
    setNotes('');
    setSearchTerm('');
    setSuccess(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user || !selectedSupplyId || !purpose.trim()) {
      setError('请填写所有必填项');
      return;
    }

    if (selectedSupply && quantity > selectedSupply.stock) {
      setError('借用数量不能超过当前库存');
      return;
    }

    if (quantity <= 0) {
      setError('借用数量必须大于 0');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Insert borrowing record
      const { error: insertError } = await supabase
        .from('supply_borrowings')
        .insert({
          supply_id: selectedSupplyId,
          user_id: user.id,
          quantity,
          purpose: purpose.trim(),
          notes: notes.trim() || null,
          status: 'borrowed',
          borrowed_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      // Decrease supply stock
      const { error: updateError } = await supabase
        .from('supplies')
        .update({ stock: (selectedSupply?.stock ?? 0) - quantity })
        .eq('id', selectedSupplyId);

      if (updateError) throw updateError;

      setSuccess(true);
    } catch (err: any) {
      const message = err.message || '提交失败，请稍后再试';
      if (message.includes('relation') && message.includes('does not exist')) {
        setError('借用功能尚未启用，请联系管理员创建相关数据表');
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (success) {
    return (
      <div>
        <PageHeader title="耗材借用" />
        <div className="px-4 md:px-6">
          <div className="max-w-lg mx-auto bg-white rounded-xl border border-gray-200 p-8 text-center">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              借用登记成功
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              您已成功借用耗材，请妥善使用并按时归还。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={resetForm}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
              >
                继续借用
              </button>
              <Link
                to="/supplies/return"
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                查看我的借用
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="耗材借用" subtitle="借用非一次性耗材，使用后请及时归还" />

      <div className="px-4 md:px-6">
        <form
          onSubmit={handleSubmit}
          className="max-w-lg mx-auto bg-white rounded-xl border border-gray-200 p-5 md:p-6 space-y-5"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Supply Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              选择耗材 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors cursor-pointer"
              >
                <span className={selectedSupply ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedSupply
                    ? `${selectedSupply.name}${selectedSupply.specification ? ` (${selectedSupply.specification})` : ''}`
                    : '请选择耗材'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="搜索耗材..."
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto">
                    {groupedSupplies.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        没有找到匹配的耗材
                      </div>
                    ) : (
                      groupedSupplies.map((group) => (
                        <div key={group.category}>
                          <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 bg-gray-50 sticky top-0">
                            {group.category}
                          </div>
                          {group.items.map((supply) => (
                            <button
                              key={supply.id}
                              type="button"
                              disabled={supply.stock <= 0}
                              onClick={() => {
                                setSelectedSupplyId(supply.id);
                                setDropdownOpen(false);
                                setSearchTerm('');
                                setQuantity(1);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                supply.stock <= 0
                                  ? 'opacity-50 cursor-not-allowed bg-gray-50'
                                  : supply.id === selectedSupplyId
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-700 hover:bg-blue-50'
                              }`}
                            >
                              <span className="font-medium">{supply.name}</span>
                              {supply.specification && (
                                <span className="text-gray-400 ml-1.5">
                                  ({supply.specification})
                                </span>
                              )}
                              <span
                                className={`float-right text-xs mt-0.5 ${
                                  supply.stock <= 0
                                    ? 'text-red-500'
                                    : supply.stock <= supply.min_stock
                                      ? 'text-amber-500'
                                      : 'text-gray-400'
                                }`}
                              >
                                {supply.stock <= 0 ? '无库存' : `库存: ${supply.stock}${supply.unit}`}
                              </span>
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedSupply && (
              <div className="mt-2 flex items-center gap-4 text-xs">
                <span className="text-gray-500">
                  当前库存:{' '}
                  <span
                    className={`font-semibold ${
                      selectedSupply.stock <= selectedSupply.min_stock
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {selectedSupply.stock} {selectedSupply.unit}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              借用数量 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={selectedSupply?.stock || 9999}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
            {selectedSupply && (
              <p className="mt-1 text-xs text-gray-400">
                单位: {selectedSupply.unit}，最多可借 {selectedSupply.stock} {selectedSupply.unit}
              </p>
            )}
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              借用用途 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="请简要说明借用用途"
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              备注 <span className="text-gray-400 font-normal">(选填)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="其他需要说明的信息..."
              rows={3}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !selectedSupplyId || !purpose.trim()}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {submitting ? '提交中...' : '确认借用'}
          </button>
        </form>
      </div>

      {/* Close dropdown on outside click */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setDropdownOpen(false)}
        />
      )}
    </div>
  );
}

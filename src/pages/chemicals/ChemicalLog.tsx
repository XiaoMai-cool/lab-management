import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, AlertCircle, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Chemical } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ChemicalLog() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [chemicalId, setChemicalId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [unit, setUnit] = useState('');
  const [purpose, setPurpose] = useState('');
  const [usedAt, setUsedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // Search for dropdown
  const [chemicalSearch, setChemicalSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    fetchChemicals();
  }, []);

  async function fetchChemicals() {
    const { data } = await supabase
      .from('chemicals')
      .select('*')
      .order('name');

    if (data) setChemicals(data as Chemical[]);
    setLoading(false);
  }

  const selectedChemical = chemicals.find((c) => c.id === chemicalId);

  const filteredChemicals = chemicals.filter((c) => {
    const q = chemicalSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.cas_number.toLowerCase().includes(q);
  });

  function selectChemical(chemical: Chemical) {
    setChemicalId(chemical.id);
    setUnit(chemical.unit);
    setChemicalSearch(chemical.name);
    setDropdownOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!chemicalId) {
      setError('请选择危化品');
      return;
    }
    if (!amount || amount <= 0) {
      setError('请输入有效的使用量');
      return;
    }
    if (!purpose.trim()) {
      setError('请填写使用目的');
      return;
    }
    if (!selectedChemical) return;

    if (amount > selectedChemical.stock) {
      setError(`使用量不能超过当前库存 (${selectedChemical.stock} ${selectedChemical.unit})`);
      return;
    }

    setSubmitting(true);

    // Insert usage log
    const { error: insertError } = await supabase.from('chemical_usage_logs').insert({
      chemical_id: chemicalId,
      user_id: user!.id,
      amount,
      unit,
      purpose: purpose.trim(),
      used_at: usedAt,
    });

    if (insertError) {
      setError('提交失败：' + insertError.message);
      setSubmitting(false);
      return;
    }

    // Update stock
    const { error: updateError } = await supabase
      .from('chemicals')
      .update({ stock: selectedChemical.stock - amount })
      .eq('id', chemicalId);

    if (updateError) {
      setError('库存更新失败：' + updateError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSuccess(true);

    // Reset form after short delay
    setTimeout(() => {
      setSuccess(false);
      setChemicalId('');
      setAmount('');
      setUnit('');
      setPurpose('');
      setChemicalSearch('');
      fetchChemicals();
    }, 2000);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="危化品使用登记" subtitle="记录危化品使用情况" />

      <div className="px-4 md:px-6 max-w-lg">
        {success && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
            <Check className="w-4 h-4 shrink-0" />
            登记成功！库存已更新。
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Chemical selector with search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              选择危化品 *
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={chemicalSearch}
                onChange={(e) => {
                  setChemicalSearch(e.target.value);
                  setDropdownOpen(true);
                  if (!e.target.value) setChemicalId('');
                }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="搜索危化品名称或CAS号..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {dropdownOpen && filteredChemicals.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredChemicals.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectChemical(c)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                        c.id === chemicalId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-gray-400 ml-2 text-xs">
                        库存: {c.stock} {c.unit}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedChemical && (
              <p className="mt-1 text-xs text-gray-500">
                当前库存: {selectedChemical.stock} {selectedChemical.unit} | 位置: {selectedChemical.location}
              </p>
            )}
          </div>

          {/* Amount & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                使用量 *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入数量"
                min={0}
                step="any"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">单位</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder="自动填充"
                readOnly={!!selectedChemical}
              />
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              使用目的 *
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：用于消解污泥"
            />
          </div>

          {/* Date/time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              使用时间
            </label>
            <input
              type="datetime-local"
              value={usedAt}
              onChange={(e) => setUsedAt(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              返回
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? '提交中...' : '提交登记'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, AlertCircle, ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Chemical, ChemicalPurchase } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ChemicalPurchaseRequest() {
  const navigate = useNavigate();
  const { user, isAdmin, isManager } = useAuth();
  const canReview = isAdmin || isManager;

  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [purchases, setPurchases] = useState<ChemicalPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form
  const [name, setName] = useState('');
  const [specification, setSpecification] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('');
  const [reason, setReason] = useState('');
  const [linkedChemicalId, setLinkedChemicalId] = useState('');

  // Tab
  const [tab, setTab] = useState<'form' | 'list'>('form');

  useEffect(() => {
    Promise.all([fetchChemicals(), fetchPurchases()]).then(() =>
      setLoading(false),
    );
  }, []);

  async function fetchChemicals() {
    const { data } = await supabase.from('chemicals').select('*').order('name');
    if (data) setChemicals(data as Chemical[]);
  }

  async function fetchPurchases() {
    const { data } = await supabase
      .from('chemical_purchases')
      .select('*, requester:profiles(*)')
      .order('created_at', { ascending: false });

    if (data) setPurchases(data as ChemicalPurchase[]);
  }

  function handleLinkChemical(chemicalId: string) {
    setLinkedChemicalId(chemicalId);
    const chemical = chemicals.find((c) => c.id === chemicalId);
    if (chemical) {
      setName(chemical.name);
      setSpecification(chemical.specification);
      setUnit(chemical.unit);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('请填写名称');
      return;
    }
    if (!quantity || quantity <= 0) {
      setError('请填写有效数量');
      return;
    }

    setSubmitting(true);

    const { error: insertError } = await supabase.from('chemical_purchases').insert({
      chemical_id: linkedChemicalId || null,
      name: name.trim(),
      specification: specification.trim(),
      quantity,
      unit: unit.trim(),
      requester_id: user!.id,
      status: 'pending',
    });

    if (insertError) {
      setError('提交失败：' + insertError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSuccess(true);
    setName('');
    setSpecification('');
    setQuantity('');
    setUnit('');
    setReason('');
    setLinkedChemicalId('');
    fetchPurchases();

    setTimeout(() => setSuccess(false), 2000);
  }

  async function handleReview(purchaseId: string, status: 'approved' | 'rejected') {
    await supabase
      .from('chemical_purchases')
      .update({ status, approved_by: user!.id })
      .eq('id', purchaseId);

    fetchPurchases();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="危化品采购申请" subtitle="提交或查看采购申请" />

      <div className="px-4 md:px-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
          <button
            onClick={() => setTab('form')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'form'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            提交申请
          </button>
          <button
            onClick={() => setTab('list')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'list'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            申请记录
          </button>
        </div>

        {tab === 'form' ? (
          <div className="max-w-lg">
            {success && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                <Check className="w-4 h-4 shrink-0" />
                采购申请已提交，等待审批。
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Link to existing chemical */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  关联已有危化品（可选）
                </label>
                <select
                  value={linkedChemicalId}
                  onChange={(e) => handleLinkChemical(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">不关联 / 新品</option>
                  {chemicals.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.specification})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名称 *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="危化品名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  规格
                </label>
                <input
                  type="text"
                  value={specification}
                  onChange={(e) => setSpecification(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：AR 500mL"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    数量 *
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={1}
                    placeholder="数量"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    单位
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="瓶、盒、g"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  采购原因
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="简要说明采购原因"
                />
              </div>

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
                  {submitting ? '提交中...' : '提交申请'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            {purchases.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="暂无采购申请"
                description="还没有提交过危化品采购申请"
              />
            ) : (
              <div className="space-y-3 pb-6">
                {purchases.map((p) => (
                  <Card key={p.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {p.name}
                          </h3>
                          <StatusBadge status={p.status} type="chemical_purchase" />
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {p.specification && `规格: ${p.specification} | `}
                          数量: {p.quantity} {p.unit}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.requester?.name || '—'} | {formatDate(p.created_at)}
                        </p>
                      </div>

                      {canReview && p.status === 'pending' && (
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleReview(p.id, 'approved')}
                            className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
                          >
                            批准
                          </button>
                          <button
                            onClick={() => handleReview(p.id, 'rejected')}
                            className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                          >
                            拒绝
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

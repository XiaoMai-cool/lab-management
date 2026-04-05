import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import dayjs from 'dayjs';

const STATUS_MAP: Record<string, { text: string; variant: string }> = {
  pending: { text: '待审批', variant: 'warning' },
  approved: { text: '已批准', variant: 'success' },
  rejected: { text: '已拒绝', variant: 'error' },
  ordered: { text: '已下单', variant: 'info' },
  received: { text: '已到货', variant: 'success' },
};

interface PurchaseRequest {
  id: string;
  chemical_name: string;
  cas_number: string | null;
  specification: string | null;
  quantity: number;
  unit: string | null;
  concentration: string | null;
  purity: string | null;
  preferred_manufacturer: string | null;
  purpose: string;
  status: string;
  reviewer_note: string | null;
  supplier_name: string | null;
  order_number: string | null;
  created_at: string;
  user: { name: string } | null;
}

interface Chemical {
  id: string;
  name: string;
  cas_number: string | null;
  specification: string | null;
  concentration: string | null;
  purity: string | null;
  manufacturer: string | null;
  unit: string | null;
}

interface RequestFormData {
  chemical_name: string;
  cas_number: string;
  specification: string;
  quantity: number;
  unit: string;
  concentration: string;
  purity: string;
  preferred_manufacturer: string;
  purpose: string;
}

const defaultForm: RequestFormData = {
  chemical_name: '',
  cas_number: '',
  specification: '',
  quantity: 1,
  unit: '瓶',
  concentration: '',
  purity: '',
  preferred_manufacturer: '',
  purpose: '',
};

export default function ReagentPurchaseRequest() {
  const { user, isAdmin: isAdminRole, isChemicalsManager } = useAuth();
  const [activeTab, setActiveTab] = useState<'submit' | 'records'>('submit');
  const [form, setForm] = useState<RequestFormData>(defaultForm);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Admin 操作弹窗
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject' | 'order' | 'receive';
    request: PurchaseRequest;
  } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionSupplier, setActionSupplier] = useState('');
  const [actionOrderNumber, setActionOrderNumber] = useState('');
  const [actionProcessing, setActionProcessing] = useState(false);

  // 药品搜索
  const [chemicalSearch, setChemicalSearch] = useState('');
  const [showChemicalDropdown, setShowChemicalDropdown] = useState(false);

  const isAdmin = isAdminRole || isChemicalsManager;

  useEffect(() => {
    if (activeTab === 'records') fetchRequests();
  }, [activeTab]);

  useEffect(() => {
    fetchChemicals();
  }, []);

  async function fetchChemicals() {
    const { data } = await supabase
      .from('chemicals')
      .select('id, name, cas_number, specification, concentration, purity, manufacturer, unit')
      .order('name')
      .limit(500);
    setChemicals(data || []);
  }

  async function fetchRequests() {
    try {
      setLoading(true);
      let query = supabase
        .from('reagent_purchase_requests')
        .select('*, user:profiles(name)')
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', user?.id);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setRequests(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof RequestFormData>(key: K, value: RequestFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectChemical(chem: Chemical) {
    setForm((prev) => ({
      ...prev,
      chemical_name: chem.name,
      cas_number: chem.cas_number || '',
      specification: chem.specification || '',
      concentration: chem.concentration || '',
      purity: chem.purity || '',
      preferred_manufacturer: chem.manufacturer || '',
      unit: chem.unit || '瓶',
    }));
    setChemicalSearch('');
    setShowChemicalDropdown(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.chemical_name.trim()) {
      setError('请填写药品名称');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);

      const { error: insertErr } = await supabase.from('reagent_purchase_requests').insert({
        user_id: user?.id,
        chemical_name: form.chemical_name.trim(),
        cas_number: form.cas_number.trim() || null,
        specification: form.specification.trim() || null,
        quantity: form.quantity,
        unit: form.unit.trim() || null,
        concentration: form.concentration.trim() || null,
        purity: form.purity.trim() || null,
        preferred_manufacturer: form.preferred_manufacturer.trim() || null,
        purpose: form.purpose.trim() || null,
        status: 'pending',
      });

      if (insertErr) throw insertErr;
      setForm(defaultForm);
      setSuccessMsg('申购申请已提交！');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction() {
    if (!actionModal) return;
    const { type, request } = actionModal;

    try {
      setActionProcessing(true);
      const updates: Record<string, any> = {};

      switch (type) {
        case 'approve':
          updates.status = 'approved';
          updates.reviewer_note = actionNote || null;
          break;
        case 'reject':
          updates.status = 'rejected';
          updates.reviewer_note = actionNote || null;
          break;
        case 'order':
          updates.status = 'ordered';
          updates.supplier_name = actionSupplier || null;
          updates.order_number = actionOrderNumber || null;
          updates.reviewer_note = actionNote || null;
          break;
        case 'receive': {
          updates.status = 'received';
          updates.reviewer_note = actionNote || null;

          // 自动创建入库记录并更新库存
          // 先查找对应药品
          const { data: chem } = await supabase
            .from('chemicals')
            .select('id, stock')
            .eq('name', request.chemical_name)
            .limit(1)
            .single();

          if (chem) {
            await supabase.from('reagent_stock_movements').insert({
              chemical_id: chem.id,
              movement_type: 'purchase_in',
              quantity: request.quantity,
              purpose: `申购到货 - ${request.purpose}`,
              user_id: user?.id,
            });

            const { error: stockError } = await supabase.rpc('adjust_stock', {
              p_table: 'chemicals',
              p_id: chem.id,
              p_delta: request.quantity,
            });
            if (stockError) throw stockError;
          }
          break;
        }
      }

      const { error: updateErr } = await supabase
        .from('reagent_purchase_requests')
        .update(updates)
        .eq('id', request.id);

      if (updateErr) throw updateErr;

      setActionModal(null);
      setActionNote('');
      setActionSupplier('');
      setActionOrderNumber('');
      fetchRequests();
    } catch (err: any) {
      alert('操作失败: ' + (err.message || ''));
    } finally {
      setActionProcessing(false);
    }
  }

  const filteredChemicals = chemicalSearch.trim()
    ? chemicals.filter(
        (c) =>
          c.name.toLowerCase().includes(chemicalSearch.toLowerCase()) ||
          c.cas_number?.includes(chemicalSearch)
      ).slice(0, 10)
    : [];

  return (
    <div className="mx-auto max-w-4xl p-4">
      <PageHeader title="药品申购" />

      {/* Tab 切换 */}
      <div className="mt-4 flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('submit')}
          className={`px-4 py-2.5 text-sm font-medium ${
            activeTab === 'submit'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          提交申购
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2.5 text-sm font-medium ${
            activeTab === 'records'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          申购记录
        </button>
      </div>

      {/* 提交申购 */}
      {activeTab === 'submit' && (
        <div className="mt-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {successMsg && (
            <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{successMsg}</div>
          )}

          {/* 从已有药品选择 */}
          <div className="relative mb-6">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              从已有药品快速选择（可选）
            </label>
            <input
              type="text"
              value={chemicalSearch}
              onChange={(e) => {
                setChemicalSearch(e.target.value);
                setShowChemicalDropdown(true);
              }}
              onFocus={() => setShowChemicalDropdown(true)}
              onBlur={() => setTimeout(() => setShowChemicalDropdown(false), 200)}
              className="input"
              placeholder="搜索药品名称或 CAS 号..."
            />
            {showChemicalDropdown && filteredChemicals.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {filteredChemicals.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => selectChemical(c)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.cas_number && (
                      <span className="ml-2 text-gray-400">CAS: {c.cas_number}</span>
                    )}
                    {c.specification && (
                      <span className="ml-2 text-gray-400">{c.specification}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <Card>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    药品名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.chemical_name}
                    onChange={(e) => updateField('chemical_name', e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">CAS号</label>
                  <input
                    type="text"
                    value={form.cas_number}
                    onChange={(e) => updateField('cas_number', e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">规格</label>
                  <input
                    type="text"
                    value={form.specification}
                    onChange={(e) => updateField('specification', e.target.value)}
                    className="input"
                    placeholder="如 500mL"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-gray-700">数量</label>
                    <input
                      type="number"
                      min={1}
                      value={form.quantity}
                      onChange={(e) => updateField('quantity', parseInt(e.target.value) || 1)}
                      className="input"
                    />
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-sm font-medium text-gray-700">单位</label>
                    <input
                      type="text"
                      value={form.unit}
                      onChange={(e) => updateField('unit', e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">浓度</label>
                  <input
                    type="text"
                    value={form.concentration}
                    onChange={(e) => updateField('concentration', e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">纯度</label>
                  <input
                    type="text"
                    value={form.purity}
                    onChange={(e) => updateField('purity', e.target.value)}
                    className="input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    厂家偏好
                  </label>
                  <input
                    type="text"
                    value={form.preferred_manufacturer}
                    onChange={(e) => updateField('preferred_manufacturer', e.target.value)}
                    className="input"
                    placeholder="如无偏好请留空"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    用途
                  </label>
                  <textarea
                    value={form.purpose}
                    onChange={(e) => updateField('purpose', e.target.value)}
                    className="input min-h-[80px]"
                    placeholder="请描述用途和实验需求"
                  />
                </div>

              </div>
            </Card>

            <div className="mt-4">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '提交申购'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 申购记录 */}
      {activeTab === 'records' && (
        <div className="mt-6">
          {loading ? (
            <LoadingSpinner />
          ) : requests.length === 0 ? (
            <EmptyState title="暂无申购记录" />
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const statusInfo = STATUS_MAP[req.status] || { text: req.status, variant: 'default' };
                return (
                  <Card key={req.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium text-gray-900">{req.chemical_name}</h4>
                          <StatusBadge variant={statusInfo.variant}>{statusInfo.text}</StatusBadge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-gray-500">
                          <span>数量: {req.quantity} {req.unit || ''}</span>
                          {req.specification && <span>规格: {req.specification}</span>}
                          {req.cas_number && <span>CAS: {req.cas_number}</span>}
                        </div>
                        <p className="mt-1 text-sm text-gray-500">用途: {req.purpose}</p>
                        <div className="mt-1 text-xs text-gray-400">
                          {isAdmin && req.user?.name && <span>{req.user.name} - </span>}
                          {dayjs(req.created_at).format('YYYY-MM-DD HH:mm')}
                        </div>
                        {req.reviewer_note && (
                          <p className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                            审批备注: {req.reviewer_note}
                          </p>
                        )}
                        {req.order_number && (
                          <p className="mt-1 text-xs text-gray-500">
                            订单号: {req.order_number}
                            {req.supplier_name && ` | 供应商: ${req.supplier_name}`}
                          </p>
                        )}
                      </div>

                      {/* Admin 操作按钮 */}
                      {isAdmin && (
                        <div className="flex flex-wrap gap-1.5">
                          {req.status === 'pending' && (
                            <>
                              <button
                                onClick={() => setActionModal({ type: 'approve', request: req })}
                                className="rounded-md bg-green-600 px-2.5 py-1 text-xs text-white hover:bg-green-700"
                              >
                                批准
                              </button>
                              <button
                                onClick={() => setActionModal({ type: 'reject', request: req })}
                                className="rounded-md bg-red-600 px-2.5 py-1 text-xs text-white hover:bg-red-700"
                              >
                                拒绝
                              </button>
                            </>
                          )}
                          {req.status === 'approved' && (
                            <button
                              onClick={() => setActionModal({ type: 'order', request: req })}
                              className="rounded-md bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700"
                            >
                              标记下单
                            </button>
                          )}
                          {req.status === 'ordered' && (
                            <button
                              onClick={() => setActionModal({ type: 'receive', request: req })}
                              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs text-white hover:bg-emerald-700"
                            >
                              确认到货
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 审批操作弹窗 */}
      {actionModal && (
        <Modal
          open
          onClose={() => {
            setActionModal(null);
            setActionNote('');
            setActionSupplier('');
            setActionOrderNumber('');
          }}
          title={
            actionModal.type === 'approve'
              ? '批准申购'
              : actionModal.type === 'reject'
                ? '拒绝申购'
                : actionModal.type === 'order'
                  ? '标记已下单'
                  : '确认到货'
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              药品: <strong>{actionModal.request.chemical_name}</strong>
              {' '}x{actionModal.request.quantity} {actionModal.request.unit || ''}
            </p>

            {actionModal.type === 'order' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">供应商</label>
                  <input
                    type="text"
                    value={actionSupplier}
                    onChange={(e) => setActionSupplier(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">订单号</label>
                  <input
                    type="text"
                    value={actionOrderNumber}
                    onChange={(e) => setActionOrderNumber(e.target.value)}
                    className="input"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">备注</label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="input min-h-[60px]"
                placeholder="可选备注"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setActionModal(null);
                  setActionNote('');
                  setActionSupplier('');
                  setActionOrderNumber('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAction}
                disabled={actionProcessing}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {actionProcessing ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

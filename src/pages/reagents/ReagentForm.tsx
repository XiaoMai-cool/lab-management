import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';

const GHS_OPTIONS = [
  { value: 'GHS01', label: 'GHS01 爆炸性', color: 'bg-orange-100 border-orange-300 text-orange-800', icon: '💥' },
  { value: 'GHS02', label: 'GHS02 易燃', color: 'bg-red-100 border-red-300 text-red-800', icon: '🔥' },
  { value: 'GHS03', label: 'GHS03 氧化性', color: 'bg-yellow-100 border-yellow-300 text-yellow-800', icon: '⭕' },
  { value: 'GHS04', label: 'GHS04 压缩气体', color: 'bg-blue-100 border-blue-300 text-blue-800', icon: '🫧' },
  { value: 'GHS05', label: 'GHS05 腐蚀性', color: 'bg-purple-100 border-purple-300 text-purple-800', icon: '⚗️' },
  { value: 'GHS06', label: 'GHS06 急性毒性', color: 'bg-red-200 border-red-400 text-red-950', icon: '☠️' },
  { value: 'GHS07', label: 'GHS07 刺激性/有害', color: 'bg-orange-50 border-orange-200 text-orange-800', icon: '⚠️' },
  { value: 'GHS08', label: 'GHS08 健康危害', color: 'bg-red-50 border-red-200 text-red-800', icon: '🫁' },
  { value: 'GHS09', label: 'GHS09 环境危害', color: 'bg-green-100 border-green-300 text-green-800', icon: '🌿' },
];

const CATEGORIES = ['普通试剂', '危险化学品', '生物试剂', '标准品', '溶剂', '其他'];

interface Supplier {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  cas_number: string;
  molecular_formula: string;
  specification: string;
  concentration: string;
  purity: string;
  category: string;
  manufacturer: string;
  supplier_id: string;
  unit: string;
  stock: number;
  min_stock: number;
  storage_location: string;
  batch_number: string;
  expiry_date: string;
  price: string;
  msds_url: string;
  ghs_labels: string[];
}

const defaultFormData: FormData = {
  name: '',
  cas_number: '',
  molecular_formula: '',
  specification: '',
  concentration: '',
  purity: '',
  category: '普通试剂',
  manufacturer: '',
  supplier_id: '',
  unit: '瓶',
  stock: 0,
  min_stock: 0,
  storage_location: '',
  batch_number: '',
  expiry_date: '',
  price: '',
  msds_url: '',
  ghs_labels: [],
};

export default function ReagentForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { } = useAuth();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormData>(defaultFormData);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [_loading, _setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [casSuggestion, setCasSuggestion] = useState<any | null>(null);

  // 编号自动生成
  const [batchPrefix, setBatchPrefix] = useState('');
  const [generatingBatch, setGeneratingBatch] = useState(false);

  // 药品名称搜索（重复检查）
  const [nameSuggestions, setNameSuggestions] = useState<{ name: string; specification: string; batch_number: string | null }[]>([]);
  const [nameSearchTimer, setNameSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // 新供应商内联表单
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [addingSupplier, setAddingSupplier] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [id]);

  async function loadInitialData() {
    try {
      setInitialLoading(true);

      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      setSuppliers(supplierData || []);

      if (isEdit && id) {
        const { data, error: fetchError } = await supabase
          .from('chemicals')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        if (data) {
          setForm({
            name: data.name || '',
            cas_number: data.cas_number || '',
            molecular_formula: data.molecular_formula || '',
            specification: data.specification || '',
            concentration: data.concentration || '',
            purity: data.purity || '',
            category: data.category || '普通试剂',
            manufacturer: data.manufacturer || '',
            supplier_id: data.supplier_id || '',
            unit: data.unit || '瓶',
            stock: data.stock ?? 0,
            min_stock: data.min_stock ?? 0,
            storage_location: data.storage_location || '',
            batch_number: data.batch_number || '',
            expiry_date: data.expiry_date || '',
            price: data.price != null ? String(data.price) : '',
            msds_url: data.msds_url || '',
            ghs_labels: data.ghs_labels || [],
          });
        }
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setInitialLoading(false);
    }
  }

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // 名称输入时搜索已有药品
    if (key === 'name' && typeof value === 'string') {
      if (nameSearchTimer) clearTimeout(nameSearchTimer);
      const keyword = (value as string).trim();
      if (keyword.length < 1) {
        setNameSuggestions([]);
        return;
      }
      const timer = setTimeout(async () => {
        const { data } = await supabase
          .from('chemicals')
          .select('name, specification, batch_number')
          .ilike('name', `%${keyword}%`)
          .limit(5);
        if (data) setNameSuggestions(data);
      }, 300);
      setNameSearchTimer(timer);
    }
  }

  async function generateBatchNumber(prefix: string) {
    if (!prefix.trim()) return;
    setGeneratingBatch(true);
    const p = prefix.trim().toUpperCase();
    setBatchPrefix(p);

    // 查询该前缀下已有编号，找最大数字
    const { data } = await supabase
      .from('chemicals')
      .select('batch_number')
      .ilike('batch_number', `${p}%`);

    let maxNum = 0;
    if (data) {
      data.forEach(row => {
        const match = row.batch_number?.match(new RegExp(`^${p}(\\d+)$`, 'i'));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
    }

    updateField('batch_number', `${p}${maxNum + 1}`);
    setGeneratingBatch(false);
  }

  function toggleGhs(value: string) {
    setForm((prev) => ({
      ...prev,
      ghs_labels: prev.ghs_labels.includes(value)
        ? prev.ghs_labels.filter((v) => v !== value)
        : [...prev.ghs_labels, value],
    }));
  }

  async function handleCasBlur() {
    const cas = form.cas_number.trim();
    if (!cas || isEdit) return;

    const { data } = await supabase
      .from('chemicals')
      .select('name, molecular_formula, manufacturer, purity, concentration, ghs_labels')
      .eq('cas_number', cas)
      .limit(1)
      .single();

    if (data) {
      setCasSuggestion(data);
    }
  }

  function applyCasSuggestion() {
    if (!casSuggestion) return;
    setForm((prev) => ({
      ...prev,
      name: casSuggestion.name || prev.name,
      molecular_formula: casSuggestion.molecular_formula || prev.molecular_formula,
      manufacturer: casSuggestion.manufacturer || prev.manufacturer,
      purity: casSuggestion.purity || prev.purity,
      concentration: casSuggestion.concentration || prev.concentration,
      ghs_labels: casSuggestion.ghs_labels || prev.ghs_labels,
    }));
    setCasSuggestion(null);
  }

  async function handleAddSupplier() {
    if (!newSupplierName.trim()) return;
    try {
      setAddingSupplier(true);
      const { data, error: insertErr } = await supabase
        .from('suppliers')
        .insert({
          name: newSupplierName.trim(),
          contact_person: newSupplierContact.trim() || null,
          phone: newSupplierPhone.trim() || null,
        })
        .select('id, name')
        .single();

      if (insertErr) throw insertErr;
      if (data) {
        setSuppliers((prev) => [...prev, data]);
        updateField('supplier_id', data.id);
        setShowNewSupplier(false);
        setNewSupplierName('');
        setNewSupplierContact('');
        setNewSupplierPhone('');
      }
    } catch (err: any) {
      alert('添加供应商失败: ' + (err.message || ''));
    } finally {
      setAddingSupplier(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      setError('请填写药品名称');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: form.name.trim(),
        cas_number: form.cas_number.trim() || null,
        molecular_formula: form.molecular_formula.trim() || null,
        specification: form.specification.trim() || null,
        concentration: form.concentration.trim() || null,
        purity: form.purity.trim() || null,
        category: form.category || null,
        manufacturer: form.manufacturer.trim() || null,
        supplier_id: form.supplier_id || null,
        unit: form.unit.trim() || null,
        stock: form.stock,
        min_stock: form.min_stock,
        storage_location: form.storage_location.trim() || null,
        batch_number: form.batch_number.trim() || null,
        expiry_date: form.expiry_date || null,
        price: form.price ? parseFloat(form.price) : null,
        msds_url: form.msds_url.trim() || null,
        ghs_labels: form.ghs_labels.length > 0 ? form.ghs_labels : null,
      };

      let result;
      if (isEdit && id) {
        result = await supabase.from('chemicals').update(payload).eq('id', id).select('id').single();
      } else {
        result = await supabase.from('chemicals').insert(payload).select('id').single();
      }

      if (result.error) throw result.error;
      navigate(`/reagents/${result.data.id}`);
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (initialLoading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <span>&larr;</span> 返回
      </button>

      <PageHeader title={isEdit ? '编辑药品' : '添加药品'} />

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* CAS 智能填充提示 */}
      {casSuggestion && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-800">
            检测到数据库中已有 CAS 号为 <strong>{form.cas_number}</strong> 的药品记录
            （{casSuggestion.name}），是否自动填充？
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={applyCasSuggestion}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
            >
              自动填充
            </button>
            <button
              type="button"
              onClick={() => setCasSuggestion(null)}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              忽略
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <Card>
          <h3 className="mb-4 font-medium text-gray-900">基本信息</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="药品名称" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="input"
                placeholder="如: 硝酸"
                required
              />
              {nameSuggestions.length > 0 && (
                <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm">
                  <p className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-100">已有相似药品</p>
                  {nameSuggestions.map((s, i) => (
                    <div key={i} className="px-3 py-1.5 text-xs text-gray-600 flex items-center gap-2 border-b border-gray-50 last:border-0">
                      <span className="font-medium text-gray-900">{s.name}</span>
                      {s.batch_number && <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold">{s.batch_number}</span>}
                      {s.specification && <span className="text-gray-400">{s.specification}</span>}
                    </div>
                  ))}
                </div>
              )}
            </FormField>

            <FormField label="CAS号" hint="如 7697-37-2">
              <input
                type="text"
                value={form.cas_number}
                onChange={(e) => updateField('cas_number', e.target.value)}
                onBlur={handleCasBlur}
                className="input"
                placeholder="如 7697-37-2"
              />
            </FormField>

            <FormField label="分子式">
              <input
                type="text"
                value={form.molecular_formula}
                onChange={(e) => updateField('molecular_formula', e.target.value)}
                className="input"
                placeholder="如 HNO3"
              />
            </FormField>

            <FormField label="分类">
              <select
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                className="input"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>

            <FormField label="规格">
              <input
                type="text"
                value={form.specification}
                onChange={(e) => updateField('specification', e.target.value)}
                className="input"
                placeholder="如 500mL, 25g"
              />
            </FormField>

            <FormField label="浓度">
              <input
                type="text"
                value={form.concentration}
                onChange={(e) => updateField('concentration', e.target.value)}
                className="input"
                placeholder="如 65-68%"
              />
            </FormField>

            <FormField label="纯度">
              <input
                type="text"
                value={form.purity}
                onChange={(e) => updateField('purity', e.target.value)}
                className="input"
                placeholder="如 AR, GR, CP"
              />
            </FormField>

            <FormField label="厂家">
              <input
                type="text"
                value={form.manufacturer}
                onChange={(e) => updateField('manufacturer', e.target.value)}
                className="input"
                placeholder="如 国药集团"
              />
            </FormField>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-medium text-gray-900">供应与库存</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="供应商" className="sm:col-span-2">
              <div className="flex gap-2">
                <select
                  value={form.supplier_id}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setShowNewSupplier(true);
                      return;
                    }
                    updateField('supplier_id', e.target.value);
                  }}
                  className="input flex-1"
                >
                  <option value="">请选择供应商</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  <option value="__new__">+ 添加新供应商</option>
                </select>
              </div>

              {/* 新供应商内联表单 */}
              {showNewSupplier && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <p className="text-sm font-medium text-gray-700">添加新供应商</p>
                  <input
                    type="text"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="input"
                    placeholder="供应商名称 *"
                  />
                  <input
                    type="text"
                    value={newSupplierContact}
                    onChange={(e) => setNewSupplierContact(e.target.value)}
                    className="input"
                    placeholder="联系人"
                  />
                  <input
                    type="text"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="input"
                    placeholder="电话"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddSupplier}
                      disabled={addingSupplier || !newSupplierName.trim()}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addingSupplier ? '添加中...' : '确认添加'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewSupplier(false)}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </FormField>

            <FormField label="单位">
              <input
                type="text"
                value={form.unit}
                onChange={(e) => updateField('unit', e.target.value)}
                className="input"
                placeholder="如 瓶, 盒, g, mL"
              />
            </FormField>

            <FormField label="当前库存">
              <input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => updateField('stock', parseInt(e.target.value) || 0)}
                className="input"
              />
            </FormField>

            <FormField label="最低库存预警">
              <input
                type="number"
                min={0}
                value={form.min_stock}
                onChange={(e) => updateField('min_stock', parseInt(e.target.value) || 0)}
                className="input"
              />
            </FormField>

            <FormField label="存放位置">
              <input
                type="text"
                value={form.storage_location}
                onChange={(e) => updateField('storage_location', e.target.value)}
                className="input"
                placeholder="如 A栋-201-柜3"
              />
            </FormField>

            <FormField label="编号">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['A', 'B', 'C', 'D'].map(p => (
                  <button
                    key={p}
                    type="button"
                    disabled={generatingBatch}
                    onClick={() => generateBatchNumber(p)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                      batchPrefix === p
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <input
                  type="text"
                  placeholder="自定义前缀"
                  className="w-20 px-2 py-1 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); generateBatchNumber((e.target as HTMLInputElement).value); } }}
                  onBlur={e => { if (e.target.value.trim()) generateBatchNumber(e.target.value); }}
                />
              </div>
              <input
                type="text"
                value={form.batch_number}
                onChange={(e) => updateField('batch_number', e.target.value)}
                className="input"
                placeholder="选择前缀自动生成，或手动输入"
              />
            </FormField>

            <FormField label="有效期">
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) => updateField('expiry_date', e.target.value)}
                className="input"
              />
            </FormField>

            <FormField label="价格 (¥)">
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) => updateField('price', e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </FormField>

            <FormField label="MSDS链接" className="sm:col-span-2">
              <input
                type="url"
                value={form.msds_url}
                onChange={(e) => updateField('msds_url', e.target.value)}
                className="input"
                placeholder="https://..."
              />
            </FormField>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-medium text-gray-900">GHS安全标签</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {GHS_OPTIONS.map((opt) => {
              const checked = form.ghs_labels.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                    checked ? opt.color : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleGhs(opt.value)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-base">{opt.icon}</span>
                  <span className="text-sm font-medium">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </Card>

        {/* 提交按钮 */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : isEdit ? '更新药品' : '添加药品'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  required,
  hint,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {hint && <p className="mb-1 text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

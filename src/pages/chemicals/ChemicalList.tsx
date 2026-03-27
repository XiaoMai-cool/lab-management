import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FlaskConical, MapPin, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Chemical } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import Modal from '../../components/Modal';

export default function ChemicalList() {
  const navigate = useNavigate();
  const { isAdmin, canManageModule } = useAuth();
  const canManage = isAdmin || canManageModule('chemicals');

  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChemical, setEditingChemical] = useState<Chemical | null>(null);
  const [form, setForm] = useState({
    name: '',
    cas_number: '',
    specification: '',
    stock: 0,
    unit: '',
    location: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchChemicals();
  }, []);

  async function fetchChemicals() {
    setLoading(true);
    const { data, error } = await supabase
      .from('chemicals')
      .select('*')
      .order('name');

    if (!error && data) {
      setChemicals(data as Chemical[]);
    }
    setLoading(false);
  }

  const filtered = chemicals.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.cas_number.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q)
    );
  });

  function getStockColor(chemical: Chemical) {
    if (chemical.stock <= 0) return 'text-red-600 bg-red-50';
    if (chemical.stock <= 5) return 'text-orange-600 bg-orange-50';
    return 'text-green-700 bg-green-50';
  }

  function openAdd() {
    setEditingChemical(null);
    setForm({ name: '', cas_number: '', specification: '', stock: 0, unit: '', location: '' });
    setModalOpen(true);
  }

  function openEdit(chemical: Chemical) {
    setEditingChemical(chemical);
    setForm({
      name: chemical.name,
      cas_number: chemical.cas_number,
      specification: chemical.specification,
      stock: chemical.stock,
      unit: chemical.unit,
      location: chemical.location,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    if (editingChemical) {
      await supabase
        .from('chemicals')
        .update({
          name: form.name,
          cas_number: form.cas_number,
          specification: form.specification,
          stock: form.stock,
          unit: form.unit,
          location: form.location,
        })
        .eq('id', editingChemical.id);
    } else {
      await supabase.from('chemicals').insert({
        name: form.name,
        cas_number: form.cas_number,
        specification: form.specification,
        stock: form.stock,
        unit: form.unit,
        location: form.location,
      });
    }

    setSaving(false);
    setModalOpen(false);
    fetchChemicals();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="危化品管理"
        subtitle="查看与管理实验室危化品"
        action={
          canManage ? (
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加
            </button>
          ) : undefined
        }
      />

      <div className="px-4 md:px-6">
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索名称、CAS号或存放位置..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="暂无危化品"
            description={search ? '未找到匹配的危化品' : '还没有录入任何危化品信息'}
          />
        ) : (
          <div className="space-y-3 pb-6">
            {filtered.map((chemical) => (
              <Card
                key={chemical.id}
                onClick={() => navigate(`/chemicals/history?chemical_id=${chemical.id}`)}
                className="relative"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {chemical.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      CAS: {chemical.cas_number || '—'}
                    </p>
                    {chemical.specification && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        规格: {chemical.specification}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      {chemical.location || '未设置'}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStockColor(chemical)}`}
                    >
                      {chemical.stock} {chemical.unit}
                    </span>
                    {canManage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(chemical);
                        }}
                        className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingChemical ? '编辑危化品' : '添加危化品'}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：盐酸"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CAS号</label>
            <input
              type="text"
              value={form.cas_number}
              onChange={(e) => setForm({ ...form, cas_number: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：7647-01-0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">规格</label>
            <input
              type="text"
              value={form.specification}
              onChange={(e) => setForm({ ...form, specification: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：AR 500mL"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">库存</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">单位</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="如：mL、g"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">存放位置</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：危化品柜A-3"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

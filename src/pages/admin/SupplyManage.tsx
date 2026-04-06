import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { auditLog } from '../../lib/auditLog';
import type { Supply, SupplyCategory } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

interface SupplyForm {
  name: string;
  specification: string;
  category_id: string;
  stock: number;
  unit: string;
  min_stock: number;
  is_returnable: boolean;
}

const defaultForm: SupplyForm = {
  name: '',
  specification: '',
  category_id: '',
  stock: 0,
  unit: '个',
  min_stock: 0,
  is_returnable: false,
};

export default function SupplyManage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [categories, setCategories] = useState<SupplyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplyForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const [suppliesRes, categoriesRes] = await Promise.all([
        supabase
          .from('supplies')
          .select('*, category:supply_categories(id, name, sort_order)')
          .order('name', { ascending: true }),
        supabase
          .from('supply_categories')
          .select('*')
          .order('sort_order', { ascending: true }),
      ]);

      if (suppliesRes.error) throw suppliesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setSupplies(suppliesRes.data ?? []);
      setCategories(categoriesRes.data ?? []);

      // Expand all categories by default
      setExpandedCategories(
        new Set((categoriesRes.data ?? []).map((c: SupplyCategory) => c.id))
      );
    } catch (err) {
      setError('加载数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function toggleCategory(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function openCreate() {
    setForm({
      ...defaultForm,
      category_id: categories[0]?.id ?? '',
    });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(supply: Supply) {
    setForm({
      name: supply.name,
      specification: supply.specification,
      category_id: supply.category_id,
      stock: supply.stock,
      unit: supply.unit,
      min_stock: supply.min_stock,
      is_returnable: supply.is_returnable || false,
    });
    setEditingId(supply.id);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(defaultForm);
  }

  async function handleSave() {
    if (saving) return;
    if (!form.name.trim() || !form.category_id) return;
    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        specification: form.specification.trim(),
        category_id: form.category_id,
        stock: form.stock,
        unit: form.unit.trim(),
        min_stock: form.min_stock,
        is_returnable: form.is_returnable,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from('supplies')
          .update(payload)
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('supplies')
          .insert(payload);
        if (insertError) throw insertError;
      }

      closeModal();
      fetchData();
    } catch (err) {
      console.error('Save failed:', err);
      setError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);

    try {
      const { error: deleteError } = await supabase
        .from('supplies')
        .delete()
        .eq('id', id);
      if (deleteError) throw deleteError;

      const deletedSupply = supplies.find((s) => s.id === id);
      await auditLog({
        action: 'delete',
        targetTable: 'supplies',
        targetId: id,
        details: { name: deletedSupply?.name, specification: deletedSupply?.specification },
      });

      setDeleteConfirmId(null);
      fetchData();
    } catch (err) {
      console.error('Delete failed:', err);
      setError('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  }

  // Group supplies by category
  const grouped = categories.map((cat) => ({
    category: cat,
    items: supplies.filter((s) => s.category_id === cat.id),
  }));

  // Supplies without a category
  const uncategorized = supplies.filter(
    (s) => !categories.some((c) => c.id === s.category_id)
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="耗材管理"
        subtitle="管理实验室耗材库存"
        action={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加耗材
          </button>
        }
      />

      <div className="px-4 md:px-6 pb-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Batch import hint */}
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700">
          如需批量导入库存数据，请联系管理员
        </div>

        {supplies.length === 0 ? (
          <EmptyState
            icon={Package}
            title="暂无耗材"
            description="点击右上角按钮添加耗材"
          />
        ) : (
          <div className="space-y-4">
            {grouped.map(
              ({ category, items }) =>
                items.length > 0 && (
                  <div key={category.id}>
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="flex items-center gap-2 w-full text-left mb-2"
                    >
                      {expandedCategories.has(category.id) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-sm font-semibold text-gray-700">
                        {category.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({items.length})
                      </span>
                    </button>

                    {expandedCategories.has(category.id) && (
                      <div className="space-y-2 ml-6">
                        {items.map((supply) => (
                          <div
                            key={supply.id}
                            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900">
                                    {supply.name}
                                  </span>
                                  {supply.is_returnable && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                                      可归还
                                    </span>
                                  )}
                                  {supply.stock <= supply.min_stock && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                      库存不足
                                    </span>
                                  )}
                                </div>
                                {supply.specification && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    规格: {supply.specification}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-0.5">
                                  库存: {supply.stock} {supply.unit} | 最低:{' '}
                                  {supply.min_stock} {supply.unit}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => openEdit(supply)}
                                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  title="编辑"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    setDeleteConfirmId(supply.id)
                                  }
                                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="删除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
            )}

            {uncategorized.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  未分类 ({uncategorized.length})
                </p>
                <div className="space-y-2">
                  {uncategorized.map((supply) => (
                    <div
                      key={supply.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {supply.name}
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            库存: {supply.stock} {supply.unit}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(supply)}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(supply.id)}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? '编辑耗材' : '添加耗材'}
        footer={
          <div className="flex gap-3">
            <button
              onClick={closeModal}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.category_id}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              名称
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="请输入耗材名称"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              规格
            </label>
            <input
              type="text"
              value={form.specification}
              onChange={(e) =>
                setForm({ ...form, specification: e.target.value })
              }
              placeholder="如: 500ml, 100支/盒"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              分类
            </label>
            <select
              value={form.category_id}
              onChange={(e) =>
                setForm({ ...form, category_id: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">请选择分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                当前库存
              </label>
              <input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                单位
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['个', '盒', '瓶', '包', '支', '套', '台', '片', '双', '卷', '袋', '桶'].map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setForm({ ...form, unit: u })}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      form.unit === u
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="或自行输入单位"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              最低库存预警
            </label>
            <input
              type="number"
              min={0}
              value={form.min_stock}
              onChange={(e) =>
                setForm({ ...form, min_stock: Number(e.target.value) })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_returnable"
              checked={form.is_returnable}
              onChange={(e) => setForm({ ...form, is_returnable: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="is_returnable"
              className="text-sm text-gray-700 cursor-pointer select-none"
            >
              可归还物资（借用后需归还）
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="确认删除"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? '删除中...' : '确认删除'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          确定要删除这个耗材吗？删除后相关预约记录将不受影响，但该耗材将无法再被预约。
        </p>
      </Modal>
    </div>
  );
}

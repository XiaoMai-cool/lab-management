import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  region: string | null;
}

interface SupplierFormData {
  name: string;
  contact_person: string;
  phone: string;
  region: string;
}

const defaultForm: SupplierFormData = {
  name: '',
  contact_person: '',
  phone: '',
  region: '',
};

export default function SupplierManage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal 状态
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierFormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (fetchErr) throw fetchErr;
      setSuppliers(data || []);
    } catch (err: any) {
      setError(err.message || '加载供应商列表失败');
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditId(null);
    setForm(defaultForm);
    setShowModal(true);
  }

  function openEdit(supplier: Supplier) {
    setEditId(supplier.id);
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      region: supplier.region || '',
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('请填写供应商名称');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: form.name.trim(),
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        region: form.region.trim() || null,
      };

      if (editId) {
        const { error: upErr } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', editId);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase.from('suppliers').insert(payload);
        if (insErr) throw insErr;
      }

      setShowModal(false);
      fetchSuppliers();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const { error: delErr } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', deleteTarget.id);
      if (delErr) throw delErr;
      setDeleteTarget(null);
      fetchSuppliers();
    } catch (err: any) {
      alert('删除失败: ' + (err.message || ''));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <PageHeader title="供应商管理">
        <button
          onClick={openAdd}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          + 添加供应商
        </button>
      </PageHeader>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {suppliers.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="暂无供应商信息" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {suppliers.map((supplier) => (
            <Card key={supplier.id}>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-gray-900">{supplier.name}</h4>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                    {supplier.contact_person && (
                      <span>联系人: {supplier.contact_person}</span>
                    )}
                    {supplier.phone && <span>电话: {supplier.phone}</span>}
                    {supplier.region && <span>地区: {supplier.region}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openEdit(supplier)}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setDeleteTarget(supplier)}
                    className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    删除
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-sm text-gray-400">
        共 {suppliers.length} 家供应商
      </p>

      {/* 添加/编辑弹窗 */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? '编辑供应商' : '添加供应商'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              供应商名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="input"
              placeholder="供应商名称"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">联系人</label>
            <input
              type="text"
              value={form.contact_person}
              onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))}
              className="input"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">电话</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className="input"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">地区</label>
            <input
              type="text"
              value={form.region}
              onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
              className="input"
              placeholder="如: 上海"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : editId ? '更新' : '添加'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
      >
        <p className="text-sm text-gray-600">
          确定要删除供应商 <strong>{deleteTarget?.name}</strong> 吗？
          已关联此供应商的药品信息不会被删除，但供应商关联将被清除。
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setDeleteTarget(null)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? '删除中...' : '确认删除'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';

interface DailyNotice {
  id: string;
  category: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ['实验室', '办公室'] as const;

export default function DailyNoticesManage() {
  const [notices, setNotices] = useState<DailyNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState<string>('实验室');
  const [formContent, setFormContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchNotices() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('daily_notices')
      .select('*')
      .order('sort_order', { ascending: true });

    if (fetchError) {
      setError('加载失败');
      console.error(fetchError);
    } else {
      setNotices(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchNotices();
  }, []);

  function openCreateModal(category: string) {
    setFormCategory(category);
    setFormContent('');
    setEditingId(null);
    setModalOpen(true);
  }

  function openEditModal(notice: DailyNotice) {
    setFormCategory(notice.category);
    setFormContent(notice.content);
    setEditingId(notice.id);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setFormContent('');
  }

  async function handleSave() {
    if (!formContent.trim()) return;
    setSaving(true);

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('daily_notices')
          .update({
            content: formContent.trim(),
            category: formCategory,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        // Get max sort_order for this category
        const categoryNotices = notices.filter(n => n.category === formCategory);
        const maxOrder = categoryNotices.length > 0
          ? Math.max(...categoryNotices.map(n => n.sort_order))
          : 0;

        const { error: insertError } = await supabase
          .from('daily_notices')
          .insert({
            content: formContent.trim(),
            category: formCategory,
            sort_order: maxOrder + 1,
          });
        if (insertError) throw insertError;
      }

      closeModal();
      fetchNotices();
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
        .from('daily_notices')
        .delete()
        .eq('id', id);
      if (deleteError) throw deleteError;
      setDeleteConfirmId(null);
      fetchNotices();
    } catch (err) {
      console.error('Delete failed:', err);
      setError('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  }

  async function handleMove(notice: DailyNotice, direction: 'up' | 'down') {
    const categoryNotices = notices
      .filter(n => n.category === notice.category)
      .sort((a, b) => a.sort_order - b.sort_order);

    const currentIndex = categoryNotices.findIndex(n => n.id === notice.id);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= categoryNotices.length) return;

    const current = categoryNotices[currentIndex];
    const swap = categoryNotices[swapIndex];

    try {
      await Promise.all([
        supabase
          .from('daily_notices')
          .update({ sort_order: swap.sort_order })
          .eq('id', current.id),
        supabase
          .from('daily_notices')
          .update({ sort_order: current.sort_order })
          .eq('id', swap.id),
      ]);
      fetchNotices();
    } catch (err) {
      console.error('Move failed:', err);
      setError('排序失败');
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="日常须知管理"
        subtitle="管理实验室和办公室的日常须知信息"
      />

      <div className="px-4 md:px-6 pb-6 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {CATEGORIES.map(category => {
          const categoryNotices = notices
            .filter(n => n.category === category)
            .sort((a, b) => a.sort_order - b.sort_order);

          const colorScheme = category === '实验室'
            ? { label: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' }
            : { label: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };

          return (
            <section key={category}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bell className={`w-5 h-5 ${colorScheme.label}`} />
                  <h2 className="text-base font-semibold text-gray-900">{category}</h2>
                  <span className="text-xs text-gray-400">{categoryNotices.length} 条</span>
                </div>
                <button
                  onClick={() => openCreateModal(category)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${colorScheme.bg} ${colorScheme.label} hover:opacity-80 transition-colors`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加
                </button>
              </div>

              {categoryNotices.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
                  暂无须知
                </div>
              ) : (
                <div className="space-y-2">
                  {categoryNotices.map((notice, index) => (
                    <div
                      key={notice.id}
                      className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-700">{notice.content}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMove(notice, 'up')}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                          title="上移"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMove(notice, 'down')}
                          disabled={index === categoryNotices.length - 1}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                          title="下移"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(notice)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="编辑"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(notice.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? '编辑须知' : '添加须知'}
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
              disabled={saving || !formContent.trim()}
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
              分类
            </label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              内容
            </label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="请输入须知内容"
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
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
          确定要删除这条须知吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
}

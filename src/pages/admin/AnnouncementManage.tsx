import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Megaphone, Upload, X, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Announcement, AnnouncementAttachment } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

type Priority = 'normal' | 'important' | 'urgent';

interface AnnouncementForm {
  title: string;
  content: string;
  priority: Priority;
  published: boolean;
  show_on_login: boolean;
  attachments: AnnouncementAttachment[];
}

const defaultForm: AnnouncementForm = {
  title: '',
  content: '',
  priority: 'normal',
  published: false,
  show_on_login: false,
  attachments: [],
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const priorityLabels: Record<Priority, string> = {
  normal: '普通',
  important: '重要',
  urgent: '紧急',
};

const priorityColors: Record<Priority, string> = {
  normal: 'bg-gray-100 text-gray-700',
  important: 'bg-yellow-100 text-yellow-700',
  urgent: 'bg-red-100 text-red-700',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AnnouncementManage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);

  async function fetchAnnouncements() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('加载公告失败');
      console.error(fetchError);
    } else {
      setAnnouncements(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  function openCreateModal() {
    setForm(defaultForm);
    setUploadingFiles([]);
    setEditingId(null);
    setModalOpen(true);
  }

  function openEditModal(announcement: Announcement) {
    setForm({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      published: announcement.published,
      show_on_login: announcement.show_on_login ?? false,
      attachments: (announcement.attachments as AnnouncementAttachment[]) ?? [],
    });
    setUploadingFiles([]);
    setEditingId(announcement.id);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(defaultForm);
    setUploadingFiles([]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    setUploadingFiles(prev => [...prev, ...Array.from(selectedFiles)]);
    e.target.value = '';
  }

  function removeNewFile(index: number) {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  }

  function removeExistingAttachment(index: number) {
    setForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  }

  async function uploadAllFiles(): Promise<AnnouncementAttachment[]> {
    const uploaded: AnnouncementAttachment[] = [];
    for (const file of uploadingFiles) {
      const ext = file.name.split('.').pop() ?? 'bin';
      const timestamp = Date.now();
      const path = `announcements/${timestamp}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('attachments')
        .upload(path, file);

      if (uploadErr) throw new Error(`上传文件 ${file.name} 失败: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(path);

      uploaded.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
      });
    }
    return uploaded;
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);

    try {
      // Upload new files
      const newAttachments = await uploadAllFiles();
      const allAttachments = [...form.attachments, ...newAttachments];

      if (editingId) {
        const { error: updateError } = await supabase
          .from('announcements')
          .update({
            title: form.title.trim(),
            content: form.content.trim(),
            priority: form.priority,
            published: form.published,
            show_on_login: form.show_on_login,
            attachments: allAttachments,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('announcements')
          .insert({
            title: form.title.trim(),
            content: form.content.trim(),
            priority: form.priority,
            published: form.published,
            show_on_login: form.show_on_login,
            attachments: allAttachments,
            author_id: user?.id,
          });

        if (insertError) throw insertError;
      }

      closeModal();
      fetchAnnouncements();
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
        .from('announcements')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setDeleteConfirmId(null);
      fetchAnnouncements();
    } catch (err) {
      console.error('Delete failed:', err);
      setError('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="公告管理"
        subtitle="管理课题组公告信息"
        action={
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建公告
          </button>
        }
      />

      <div className="px-4 md:px-6 pb-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {announcements.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="暂无公告"
            description="点击右上角按钮创建第一条公告"
          />
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {a.title}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[a.priority]}`}
                      >
                        {priorityLabels[a.priority]}
                      </span>
                      {a.published ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          已发布
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          未发布
                        </span>
                      )}
                      {a.show_on_login && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          登录页
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2 whitespace-pre-line">
                      {a.content}
                    </p>
                    {/* Inline attachments */}
                    {a.attachments && (a.attachments as AnnouncementAttachment[]).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(a.attachments as AnnouncementAttachment[]).map((att, idx) =>
                          att.type?.startsWith('image/') ? (
                            <img key={idx} src={att.url} alt={att.name} className="max-h-24 rounded border border-gray-200" />
                          ) : (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md"
                            >
                              <Download className="w-3 h-3" />
                              {att.name}
                            </a>
                          )
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDate(a.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(a)}
                      className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="编辑"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(a.id)}
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

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? '编辑公告' : '新建公告'}
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
              disabled={saving || !form.title.trim() || !form.content.trim()}
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
              标题
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="请输入公告标题"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              内容
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="请输入公告内容（支持换行）"
              rows={8}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            />
          </div>

          {/* Preview */}
          {form.content.trim() && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                预览
              </label>
              <div className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 whitespace-pre-line min-h-[60px]">
                {form.content}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              优先级
            </label>
            <select
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value as Priority })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="normal">普通</option>
              <option value="important">重要</option>
              <option value="urgent">紧急</option>
            </select>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) =>
                    setForm({ ...form, published: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
              </label>
              <span className="text-sm text-gray-700">发布</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.show_on_login}
                  onChange={(e) =>
                    setForm({ ...form, show_on_login: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
              </label>
              <span className="text-sm text-gray-700">在登录页展示</span>
            </div>
          </div>

          {/* 附件上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              附件
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">支持图片、PDF、Word、Excel</p>
                </div>
                <label className="shrink-0 cursor-pointer">
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    选择文件
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Existing attachments */}
              {form.attachments.length > 0 && (
                <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                  {form.attachments.map((att, index) => (
                    <div
                      key={`existing-${index}`}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700 truncate">{att.name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(att.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExistingAttachment(index)}
                        className="shrink-0 ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New files to upload */}
              {uploadingFiles.length > 0 && (
                <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                  {uploadingFiles.map((file, index) => (
                    <div
                      key={`new-${index}`}
                      className="flex items-center justify-between p-2 bg-blue-50 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(file.size)} (待上传)</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewFile(index)}
                        className="shrink-0 ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
          确定要删除这条公告吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
}

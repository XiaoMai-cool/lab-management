import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Megaphone, Upload, X, Download, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Announcement, AnnouncementAttachment, Document as DocType } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

type Priority = 'normal' | 'important' | 'urgent';
type TabKey = 'announcements' | 'documents';

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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('announcements');

  // Announcement state
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

  // Document state
  const [documents, setDocuments] = useState<DocType[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [deleteDocConfirmId, setDeleteDocConfirmId] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

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

  async function fetchDocuments() {
    setLoadingDocs(true);
    const { data, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .order('sort_order')
      .order('updated_at', { ascending: false });

    if (fetchError) {
      console.error(fetchError);
    } else {
      setDocuments((data as DocType[]) ?? []);
    }
    setLoadingDocs(false);
  }

  useEffect(() => {
    fetchAnnouncements();
    fetchDocuments();
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

  async function handleDeleteDocument(id: string) {
    setDeletingDoc(true);

    try {
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setDeleteDocConfirmId(null);
      fetchDocuments();
    } catch (err) {
      console.error('Delete doc failed:', err);
      setError('删除文档失败，请重试');
    } finally {
      setDeletingDoc(false);
    }
  }

  // Get login-page announcements sorted by login_sort_order for sort controls
  const loginAnnouncements = announcements
    .filter((a) => a.show_on_login)
    .sort((a, b) => (a.login_sort_order ?? 0) - (b.login_sort_order ?? 0));

  // 确保 login_sort_order 都有唯一值（首次加载时修复全为0的问题）
  useEffect(() => {
    const loginItems = announcements.filter(a => a.show_on_login);
    const allZero = loginItems.length > 1 && loginItems.every(a => (a.login_sort_order ?? 0) === 0);
    if (allZero) {
      const sorted = [...loginItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const updates = sorted.map((a, i) => ({ id: a.id, order: i + 1 }));
      setAnnouncements(prev => prev.map(a => {
        const u = updates.find(u => u.id === a.id);
        return u ? { ...a, login_sort_order: u.order } : a;
      }));
      // 静默同步到数据库
      updates.forEach(u => {
        supabase.from('announcements').update({ login_sort_order: u.order }).eq('id', u.id);
      });
    }
  }, [announcements.length]);

  return (
    <div>
      <PageHeader
        title="公告与文档管理"
        subtitle="管理课题组公告和文档资料"
        action={
          activeTab === 'announcements' ? (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建公告
            </button>
          ) : (
            <button
              onClick={() => navigate('/documents/new')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加文档
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="px-4 md:px-6 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'announcements'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            公告管理
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'documents'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            文档管理
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Announcements Tab */}
        {activeTab === 'announcements' && (
          <>
            {/* 登录页展示排序区域 */}
            {loginAnnouncements.length > 0 && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-3">
                <h3 className="text-xs font-semibold text-blue-800 mb-2">登录页展示顺序</h3>
                <div className="space-y-1">
                  {loginAnnouncements.map((a, idx) => (
                    <div
                      key={a.id}
                      id={`login-sort-${a.id}`}
                      className="flex items-center gap-2 bg-white rounded-lg border border-blue-100 px-2.5 py-1.5 select-none transition-all duration-300"
                    >
                      <span className="text-xs font-bold text-blue-500 w-4 text-center shrink-0">{idx + 1}</span>
                      <span className="text-xs text-gray-900 flex-1 truncate">{a.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${priorityColors[a.priority]}`}>
                        {priorityLabels[a.priority]}
                      </span>
                      <div className="flex items-center shrink-0">
                        <button
                          onClick={() => {
                            if (idx === 0) return;
                            const target = loginAnnouncements[idx - 1];
                            const myOrder = a.login_sort_order ?? 0;
                            const targetOrder = target.login_sort_order ?? 0;
                            setAnnouncements(prev => prev.map(ann => {
                              if (ann.id === a.id) return { ...ann, login_sort_order: targetOrder };
                              if (ann.id === target.id) return { ...ann, login_sort_order: myOrder };
                              return ann;
                            }));
                            supabase.from('announcements').update({ login_sort_order: targetOrder }).eq('id', a.id);
                            supabase.from('announcements').update({ login_sort_order: myOrder }).eq('id', target.id);
                            // 闪烁高亮
                            setTimeout(() => {
                              const el = document.getElementById(`login-sort-${a.id}`);
                              if (el) { el.style.backgroundColor = '#dbeafe'; setTimeout(() => { el.style.backgroundColor = ''; }, 400); }
                            }, 50);
                          }}
                          disabled={idx === 0}
                          className="p-1 rounded text-blue-400 hover:text-blue-600 hover:bg-blue-100 disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => {
                            if (idx === loginAnnouncements.length - 1) return;
                            const target = loginAnnouncements[idx + 1];
                            const myOrder = a.login_sort_order ?? 0;
                            const targetOrder = target.login_sort_order ?? 0;
                            setAnnouncements(prev => prev.map(ann => {
                              if (ann.id === a.id) return { ...ann, login_sort_order: targetOrder };
                              if (ann.id === target.id) return { ...ann, login_sort_order: myOrder };
                              return ann;
                            }));
                            supabase.from('announcements').update({ login_sort_order: targetOrder }).eq('id', a.id);
                            supabase.from('announcements').update({ login_sort_order: myOrder }).eq('id', target.id);
                            setTimeout(() => {
                              const el = document.getElementById(`login-sort-${a.id}`);
                              if (el) { el.style.backgroundColor = '#dbeafe'; setTimeout(() => { el.style.backgroundColor = ''; }, 400); }
                            }, 50);
                          }}
                          disabled={idx === loginAnnouncements.length - 1}
                          className="p-1 rounded text-blue-400 hover:text-blue-600 hover:bg-blue-100 disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          ↓
                        </button>
                        <button
                          onClick={async () => {
                            setAnnouncements(prev => prev.map(ann => ann.id === a.id ? { ...ann, show_on_login: false } : ann));
                            await supabase.from('announcements').update({ show_on_login: false }).eq('id', a.id);
                          }}
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 ml-0.5"
                          title="从登录页移除"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <LoadingSpinner />
            ) : announcements.length === 0 ? (
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
          </>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <>
            {loadingDocs ? (
              <LoadingSpinner />
            ) : documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="暂无文档"
                description="点击右上角按钮添加第一篇文档"
              />
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {doc.title}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {doc.category || '未分类'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          更新于 {formatDate(doc.updated_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => navigate(`/documents/${doc.id}/edit`)}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="编辑"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteDocConfirmId(doc.id)}
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
          </>
        )}
      </div>

      {/* Create/Edit Announcement Modal */}
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

      {/* Delete Announcement Confirmation Modal */}
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

      {/* Delete Document Confirmation Modal */}
      <Modal
        open={!!deleteDocConfirmId}
        onClose={() => setDeleteDocConfirmId(null)}
        title="确认删除文档"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteDocConfirmId(null)}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => deleteDocConfirmId && handleDeleteDocument(deleteDocConfirmId)}
              disabled={deletingDoc}
              className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deletingDoc ? '删除中...' : '确认删除'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          确定要删除这篇文档吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
}

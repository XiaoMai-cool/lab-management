import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Document as DocType, FileAttachment } from '../../lib/types';
import LoadingSpinner from '../../components/LoadingSpinner';
import FileUploader, { type FileUploaderHandle } from '../../components/FileUploader';

const RichTextEditor = lazy(() => import('../../components/RichTextEditor'));

const CATEGORIES = ['管理制度', '操作规范', '安全制度', '其他'];

export default function DocumentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const fileUploaderRef = useRef<FileUploaderHandle>(null);

  useEffect(() => {
    if (id) fetchDocument(id);
  }, [id]);

  async function fetchDocument(docId: string) {
    const { data, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (fetchError || !data) {
      setError('无法加载文档');
      setLoading(false);
      return;
    }

    const doc = data as DocType;
    setTitle(doc.title);
    setCategory(doc.category || CATEGORIES[0]);
    setContent(doc.content);
    setAttachments((doc.attachments as FileAttachment[]) ?? []);
    setLoading(false);
  }

  async function handleSave() {
    setError('');

    if (!title.trim()) {
      setError('请填写标题');
      return;
    }
    const contentEmpty = !content.trim() || content.trim() === '<p></p>';
    if (contentEmpty) {
      setError('请填写内容');
      return;
    }

    setSaving(true);

    try {
      const uploaded = fileUploaderRef.current
        ? await fileUploaderRef.current.uploadAll()
        : [];
      const allAttachments = [...attachments, ...uploaded];

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            title: title.trim(),
            category,
            content: content.trim(),
            updated_at: new Date().toISOString(),
            attachments: allAttachments,
          })
          .eq('id', id);

        if (updateError) {
          setError('保存失败：' + updateError.message);
          return;
        }

        navigate(`/documents/${id}`);
      } else {
        const { data, error: insertError } = await supabase
          .from('documents')
          .insert({
            title: title.trim(),
            category,
            content: content.trim(),
            author_id: user!.id,
            sort_order: 0,
            attachments: allAttachments,
          })
          .select('id')
          .single();

        if (insertError || !data) {
          setError('保存失败：' + (insertError?.message || '未知错误'));
          return;
        }

        navigate(`/documents/${data.id}`);
      }
    } catch (err) {
      setError('操作失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* Header bar */}
      <div className="sticky top-14 md:top-16 z-10 bg-gray-50 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          取消
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      <div className="px-4 md:px-6 pb-8 max-w-3xl">
        <h1 className="text-lg font-bold text-gray-900 mb-5">
          {isEditing ? '编辑文档' : '新建文档'}
        </h1>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              标题 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="文档标题"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              分类
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              内容 *
            </label>
            <Suspense fallback={<div className="h-[300px] bg-gray-50 rounded-lg animate-pulse" />}>
              <RichTextEditor
                content={content}
                onChange={setContent}
              />
            </Suspense>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">附件</label>
            <FileUploader
              ref={fileUploaderRef}
              existingFiles={attachments}
              onExistingRemove={(index) => setAttachments((prev) => prev.filter((_, i) => i !== index))}
              storagePath="documents"
            />
          </div>

          {/* Bottom actions (mobile friendly) */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '保存文档'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

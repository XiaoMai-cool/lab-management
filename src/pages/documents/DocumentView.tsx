import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Calendar, User, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Document as DocType, Profile } from '../../lib/types';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

export default function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [document, setDocument] = useState<DocType | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchDocument(id);
  }, [id]);

  async function fetchDocument(docId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (!error && data) {
      const doc = data as DocType;
      setDocument(doc);

      // Fetch author
      if (doc.author_id) {
        const { data: authorData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', doc.author_id)
          .single();

        if (authorData) setAuthor(authorData as Profile);
      }
    }

    setLoading(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  if (loading) return <LoadingSpinner />;

  if (!document) {
    return (
      <div className="px-4 md:px-6 py-8">
        <EmptyState title="文档不存在" description="未找到该文档，可能已被删除" />
        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/documents')}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            返回文档列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header bar */}
      <div className="sticky top-14 md:top-16 z-10 bg-gray-50 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/documents')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>

        {isAdmin && (
          <button
            onClick={() => navigate(`/documents/edit/${document.id}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            编辑
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-8 max-w-3xl">
        {/* Title */}
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">
          {document.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 mb-6">
          <span className="inline-flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {document.category || '未分类'}
          </span>
          {author && (
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" />
              {author.name}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            更新于 {formatDate(document.updated_at)}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mb-6" />

        {/* Document content - preserve line breaks */}
        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
          {document.content}
        </div>
      </div>
    </div>
  );
}

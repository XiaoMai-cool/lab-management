import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, FolderOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Document as DocType } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';

const CATEGORY_ORDER = ['管理制度', '操作规范', '安全制度', '其他'];

function getCategoryIcon(category: string) {
  switch (category) {
    case '管理制度':
      return 'text-blue-600 bg-blue-50';
    case '操作规范':
      return 'text-green-600 bg-green-50';
    case '安全制度':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

export default function DocumentList() {
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;

  const [documents, setDocuments] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('sort_order')
      .order('updated_at', { ascending: false });

    if (data) setDocuments(data as DocType[]);
    setLoading(false);
  }

  // Group by category
  const grouped = documents.reduce<Record<string, DocType[]>>((acc, doc) => {
    const cat = doc.category || '其他';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  // Sort categories
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="文档资料"
        subtitle="实验室管理制度与规范"
        action={
          canManage ? (
            <button
              onClick={() => navigate('/documents/new')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建
            </button>
          ) : undefined
        }
      />

      <div className="px-4 md:px-6">
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="暂无文档"
            description="还没有添加任何文档资料"
            action={
              canManage ? (
                <button
                  onClick={() => navigate('/documents/new')}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  添加文档
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-6 pb-6">
            {sortedCategories.map((category) => (
              <div key={category}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${getCategoryIcon(category)}`}
                  >
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {category}
                  </h2>
                  <span className="text-xs text-gray-400">
                    {grouped[category].length} 篇
                  </span>
                </div>

                {/* Document items */}
                <div className="space-y-2">
                  {grouped[category].map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="w-full text-left bg-white border border-gray-100 rounded-lg p-3 md:p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {doc.title}
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            更新于 {formatDate(doc.updated_at)}
                          </p>
                        </div>
                        <FileText className="w-4 h-4 text-gray-300 shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

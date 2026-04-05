import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, FolderOpen, Megaphone, ChevronRight, ArrowLeft, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { stripHtml } from '../../lib/sanitize';
import type { Document as DocType, Announcement } from '../../lib/types';
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

const priorityLabels: Record<string, string> = {
  urgent: '紧急',
  important: '重要',
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  important: 'bg-yellow-100 text-yellow-700',
};

type TabKey = 'announcements' | 'docs' | 'notices';

interface DailyNotice {
  id: string;
  category: string;
  content: string;
  sort_order: number;
}

export default function DocumentList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as TabKey) || 'announcements';

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<DocType[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Daily notices state
  const [notices, setNotices] = useState<DailyNotice[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(false);

  function switchTab(tab: TabKey) {
    setSearchParams({ tab });
  }

  useEffect(() => {
    if (currentTab === 'announcements') {
      fetchAnnouncements();
    } else if (currentTab === 'docs') {
      fetchDocuments();
    } else if (currentTab === 'notices') {
      fetchNotices();
    }
  }, [currentTab]);

  async function fetchAnnouncements() {
    setLoadingAnnouncements(true);
    const { data } = await supabase
      .from('announcements')
      .select('*, author:profiles!author_id(name)')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (data) setAnnouncements(data as Announcement[]);
    setLoadingAnnouncements(false);
  }

  async function fetchDocuments() {
    setLoadingDocs(true);
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('sort_order')
      .order('updated_at', { ascending: false });

    if (data) setDocuments(data as DocType[]);
    setLoadingDocs(false);
  }

  async function fetchNotices() {
    setLoadingNotices(true);
    const { data } = await supabase
      .from('daily_notices')
      .select('id, category, content, sort_order')
      .order('sort_order', { ascending: true });
    if (data) setNotices(data);
    setLoadingNotices(false);
  }

  // Group documents by category
  const grouped = documents.reduce<Record<string, DocType[]>>((acc, doc) => {
    const cat = doc.category || '其他';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

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

  return (
    <div>
      <PageHeader
        title="公告与文档"
        subtitle="课题组公告信息与管理制度"
        action={
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
        }
      />

      {/* Tabs */}
      <div className="px-4 md:px-6 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => switchTab('announcements')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              currentTab === 'announcements'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            公告
          </button>
          <button
            onClick={() => switchTab('notices')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              currentTab === 'notices'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bell className="w-4 h-4" />
            日常须知
          </button>
          <button
            onClick={() => switchTab('docs')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              currentTab === 'docs'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            文档资料
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6">
        {/* Announcements tab */}
        {currentTab === 'announcements' && (
          <>
            {loadingAnnouncements ? (
              <LoadingSpinner />
            ) : announcements.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title="暂无公告"
                description="还没有发布任何公告"
              />
            ) : (
              <div className="space-y-3 pb-6">
                {announcements.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/announcements/${a.id}`)}
                    className={`w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:scale-[0.99] transition-all ${
                      a.priority === 'urgent'
                        ? 'border-l-4 border-l-red-500'
                        : a.priority === 'important'
                          ? 'border-l-4 border-l-yellow-500'
                          : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
                            {a.title}
                          </h3>
                          {a.priority !== 'normal' && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${priorityColors[a.priority]}`}
                            >
                              {priorityLabels[a.priority]}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {stripHtml(a.content)}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>{(a.author as any)?.name || '未知'}</span>
                          <span>{formatDate(a.created_at)}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Notices tab */}
        {currentTab === 'notices' && (
          <>
            {loadingNotices ? (
              <LoadingSpinner />
            ) : notices.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="暂无日常须知"
                description="管理员还没有添加日常须知"
              />
            ) : (
              <div className="space-y-6 pb-6">
                {(['实验室', '办公室'] as const).map(category => {
                  const categoryNotices = notices.filter(n => n.category === category);
                  if (categoryNotices.length === 0) return null;
                  const colorScheme = category === '实验室'
                    ? { label: 'text-blue-600', bg: 'bg-blue-50' }
                    : { label: 'text-green-600', bg: 'bg-green-50' };
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorScheme.bg} ${colorScheme.label}`}>
                          <Bell className="w-4 h-4" />
                        </div>
                        <h2 className="text-sm font-semibold text-gray-900">{category}</h2>
                        <span className="text-xs text-gray-400">{categoryNotices.length} 条</span>
                      </div>
                      <div className="space-y-2">
                        {categoryNotices.map(notice => (
                          <div
                            key={notice.id}
                            className="bg-white border border-gray-100 rounded-lg p-3 md:p-4 shadow-sm"
                          >
                            <div className="flex items-start gap-2.5">
                              <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                              <p className="text-sm text-gray-700">{notice.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Documents tab */}
        {currentTab === 'docs' && (
          <>
            {loadingDocs ? (
              <LoadingSpinner />
            ) : documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="暂无文档"
                description="还没有添加任何文档资料"
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
          </>
        )}
      </div>
    </div>
  );
}

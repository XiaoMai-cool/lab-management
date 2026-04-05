import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Announcement, AnnouncementAttachment } from '../../lib/types';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import RichTextRenderer from '../../components/RichTextRenderer';

const priorityLabels: Record<string, string> = {
  urgent: '紧急',
  important: '重要',
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  important: 'bg-yellow-100 text-yellow-700',
};

export default function AnnouncementView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [announcement, setAnnouncement] = useState<(Announcement & { author?: { name: string } }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchAnnouncement(id);
  }, [id]);

  async function fetchAnnouncement(announcementId: string) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, author:profiles!author_id(name)')
      .eq('id', announcementId)
      .single();

    if (!error && data) {
      setAnnouncement(data as Announcement & { author?: { name: string } });
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

  if (!announcement) {
    return (
      <div className="px-4 md:px-6 py-8">
        <EmptyState title="公告不存在" description="未找到该公告，可能已被删除" />
        <div className="text-center mt-4">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const attachments = (announcement.attachments as AnnouncementAttachment[]) ?? [];
  const imageAttachments = attachments.filter((a) => a.type?.startsWith('image/'));
  const fileAttachments = attachments.filter((a) => !a.type?.startsWith('image/'));

  return (
    <div>
      {/* Header bar */}
      <div className="sticky top-14 md:top-16 z-10 bg-gray-50 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-8 max-w-3xl">
        {/* Title + priority badge */}
        <div className="flex items-start gap-2 mb-3">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {announcement.title}
          </h1>
          {announcement.priority !== 'normal' && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 mt-1 ${priorityColors[announcement.priority]}`}
            >
              {priorityLabels[announcement.priority]}
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 mb-6">
          {(announcement.author as any)?.name && (
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" />
              {(announcement.author as any).name}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(announcement.created_at)}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mb-6" />

        {/* Content - preserve whitespace */}
        <RichTextRenderer content={announcement.content} />

        {/* Image attachments */}
        {imageAttachments.length > 0 && (
          <div className="mt-6 space-y-4">
            {imageAttachments.map((att, idx) => (
              <img
                key={idx}
                src={att.url}
                alt={att.name}
                className="max-w-full rounded-lg border border-gray-200"
              />
            ))}
          </div>
        )}

        {/* File attachments */}
        {fileAttachments.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-sm font-medium text-gray-700">附件</p>
            <div className="flex flex-wrap gap-2">
              {fileAttachments.map((att, idx) => (
                <a
                  key={idx}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  {att.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

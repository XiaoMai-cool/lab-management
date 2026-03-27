import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  Calendar,
  MapPin,
  ChevronDown,
  ChevronUp,
  Plus,
  FileText,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Meeting } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';

// 汇报顺序
const REPORT_ORDER = ['彭鸿昌', '邓岩昊', '林弋杰', '陈鸿林', '麦宏博'];

export default function MeetingList() {
  const { isAdmin } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 新建会议
  const [showModal, setShowModal] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(dayjs().format('YYYY-MM-DDTHH:mm'));
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMeetings();
  }, []);

  async function fetchMeetings() {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from('meetings')
        .select('*')
        .order('scheduled_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setMeetings(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  const { upcoming, past } = useMemo(() => {
    const now = dayjs();
    const up: Meeting[] = [];
    const pa: Meeting[] = [];
    meetings.forEach((m) => {
      if (dayjs(m.scheduled_at).isAfter(now)) {
        up.push(m);
      } else {
        pa.push(m);
      }
    });
    // upcoming sorted ascending
    up.sort((a, b) =>
      dayjs(a.scheduled_at).isBefore(dayjs(b.scheduled_at)) ? -1 : 1
    );
    return { upcoming: up, past: pa };
  }, [meetings]);

  async function handleCreate() {
    if (!formTitle || !formDate || !formLocation) return;
    try {
      setSubmitting(true);
      const { error: insertErr } = await supabase.from('meetings').insert({
        title: formTitle,
        scheduled_at: new Date(formDate).toISOString(),
        location: formLocation,
        notes: formNotes || null,
      });
      if (insertErr) throw insertErr;
      setShowModal(false);
      setFormTitle('');
      setFormLocation('');
      setFormNotes('');
      fetchMeetings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
          加载失败：{error}
        </div>
      </div>
    );
  }

  function renderMeetingCard(meeting: Meeting) {
    const isExpanded = expandedId === meeting.id;
    return (
      <Card key={meeting.id}>
        <div
          className="cursor-pointer"
          onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {meeting.title}
              </h3>
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {dayjs(meeting.scheduled_at).format('YYYY年MM月DD日 HH:mm')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{meeting.location}</span>
                </div>
              </div>
            </div>
            <div className="shrink-0 ml-2 p-1 text-gray-400">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
              {meeting.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    会议备注
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {meeting.notes}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">
                  汇报顺序
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {REPORT_ORDER.map((name, idx) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-full"
                    >
                      <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="组会管理"
        subtitle={`${upcoming.length} 场即将召开`}
        action={
          isAdmin ? (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建组会
            </button>
          ) : undefined
        }
      />

      <div className="px-4 md:px-6 space-y-6">
        {/* 汇报顺序提示 */}
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
          <Users className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="text-xs text-blue-700">
            汇报顺序：{REPORT_ORDER.join(' → ')}
          </p>
        </div>

        {/* 即将召开 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            即将召开
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="暂无即将召开的组会"
              description="管理员可创建新的组会"
            />
          ) : (
            <div className="space-y-3">
              {upcoming.map(renderMeetingCard)}
            </div>
          )}
        </div>

        {/* 历史组会 */}
        {past.length > 0 && (
          <div>
            <button
              onClick={() => setShowPast(!showPast)}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 hover:text-gray-700 transition-colors"
            >
              历史组会（{past.length}）
              {showPast ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {showPast && (
              <div className="space-y-3">
                {past.map(renderMeetingCard)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 新建组会 Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="新建组会"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || !formTitle || !formLocation}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? '创建中...' : '创建'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              会议标题
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="例如：第12周组会"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              时间
            </label>
            <input
              type="datetime-local"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              地点
            </label>
            <input
              type="text"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder="例如：实验楼301会议室"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              备注
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
              placeholder="选填，如需要准备的内容等"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

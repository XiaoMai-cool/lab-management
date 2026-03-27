import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { FileText, Clock, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { MeetingReport, Meeting } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';

interface ReportContent {
  student_id: string;
  time: string;
  paper_title: string;
  last_meeting_suggestions: string;
  research_progress: string;
  experiment_plan: string;
  literature_summary: string;
  academic_activities: string;
}

interface ReportWithMeeting extends MeetingReport {
  meeting?: Meeting;
}

export default function ProgressReport() {
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [pastReports, setPastReports] = useState<ReportWithMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showPast, setShowPast] = useState(false);

  // 表单字段
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [reportDate, setReportDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [paperTitle, setPaperTitle] = useState('');
  const [lastSuggestions, setLastSuggestions] = useState('');
  const [researchProgress, setResearchProgress] = useState('');
  const [experimentPlan, setExperimentPlan] = useState('');
  const [literatureSummary, setLiteratureSummary] = useState('');
  const [academicActivities, setAcademicActivities] = useState('');

  useEffect(() => {
    fetchData();
  }, [profile]);

  async function fetchData() {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);

      const [meetingsRes, reportsRes] = await Promise.all([
        supabase
          .from('meetings')
          .select('*')
          .gte('scheduled_at', dayjs().subtract(7, 'day').toISOString())
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('meeting_reports')
          .select('*, meeting:meetings(*)')
          .eq('user_id', profile.id)
          .order('submitted_at', { ascending: false }),
      ]);

      if (meetingsRes.error) throw meetingsRes.error;
      if (reportsRes.error) throw reportsRes.error;

      setMeetings(meetingsRes.data ?? []);
      setPastReports(reportsRes.data ?? []);

      // 默认选择最近的会议
      if (meetingsRes.data && meetingsRes.data.length > 0) {
        setSelectedMeetingId(meetingsRes.data[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!profile || !selectedMeetingId) return;

    const content: ReportContent = {
      student_id: studentId,
      time: reportDate,
      paper_title: paperTitle,
      last_meeting_suggestions: lastSuggestions,
      research_progress: researchProgress,
      experiment_plan: experimentPlan,
      literature_summary: literatureSummary,
      academic_activities: academicActivities,
    };

    try {
      setSubmitting(true);
      setSubmitSuccess(false);

      const { error: insertErr } = await supabase
        .from('meeting_reports')
        .insert({
          meeting_id: selectedMeetingId,
          user_id: profile.id,
          content: JSON.stringify(content),
          submitted_at: new Date().toISOString(),
        });

      if (insertErr) throw insertErr;

      setSubmitSuccess(true);
      // 重置表单
      setStudentId('');
      setPaperTitle('');
      setLastSuggestions('');
      setResearchProgress('');
      setExperimentPlan('');
      setLiteratureSummary('');
      setAcademicActivities('');

      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  function parseReportContent(content: string): ReportContent | null {
    try {
      return JSON.parse(content);
    } catch {
      return null;
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

  return (
    <div className="pb-8">
      <PageHeader
        title="Progress Report 提交"
        subtitle="提交本次组会研究进展报告"
      />

      <div className="px-4 md:px-6 space-y-4">
        {submitSuccess && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm">
            提交成功！你的 Progress Report 已保存。
          </div>
        )}

        <Card title="填写报告">
          <div className="space-y-4">
            {/* 关联组会 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                关联组会
              </label>
              <select
                value={selectedMeetingId}
                onChange={(e) => setSelectedMeetingId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">请选择组会</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} - {dayjs(m.scheduled_at).format('MM/DD')}
                  </option>
                ))}
              </select>
            </div>

            {/* 姓名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                姓名
              </label>
              <input
                type="text"
                value={profile?.name ?? ''}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
              />
            </div>

            {/* 学号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                学号
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="请输入学号"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 时间 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                时间
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 论文题目 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                论文题目
              </label>
              <input
                type="text"
                value={paperTitle}
                onChange={(e) => setPaperTitle(e.target.value)}
                placeholder="请输入论文题目"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 上次组会建议 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                上次组会建议
              </label>
              <textarea
                value={lastSuggestions}
                onChange={(e) => setLastSuggestions(e.target.value)}
                rows={3}
                placeholder="上次组会老师/同学提出的建议及改进情况"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* 本次研究工作进展 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                本次研究工作进展
              </label>
              <textarea
                value={researchProgress}
                onChange={(e) => setResearchProgress(e.target.value)}
                rows={5}
                placeholder="详细描述本次研究工作的进展..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* 实验计划及安排 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                实验计划及安排
              </label>
              <textarea
                value={experimentPlan}
                onChange={(e) => setExperimentPlan(e.target.value)}
                rows={4}
                placeholder="下一步的实验计划和时间安排..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* 文献阅读总结 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                文献阅读总结
              </label>
              <textarea
                value={literatureSummary}
                onChange={(e) => setLiteratureSummary(e.target.value)}
                rows={4}
                placeholder="近期阅读的文献及总结..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* 学术活动总结 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                学术活动总结
              </label>
              <textarea
                value={academicActivities}
                onChange={(e) => setAcademicActivities(e.target.value)}
                rows={3}
                placeholder="参加的学术讲座、会议等..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* 提交按钮 */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedMeetingId}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {submitting ? '提交中...' : '提交报告'}
            </button>
          </div>
        </Card>

        {/* 历史提交 */}
        <div>
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 hover:text-gray-700 transition-colors"
          >
            历史提交（{pastReports.length}）
            {showPast ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showPast && (
            <>
              {pastReports.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="暂无提交记录"
                  description="提交后可在此查看历史报告"
                />
              ) : (
                <div className="space-y-3">
                  {pastReports.map((report) => {
                    const parsed = parseReportContent(report.content);
                    return (
                      <Card key={report.id}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-900">
                              {report.meeting?.title ?? '组会报告'}
                            </h4>
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              {dayjs(report.submitted_at).format('MM/DD HH:mm')}
                            </div>
                          </div>
                          {parsed && (
                            <div className="space-y-1.5 text-xs text-gray-600">
                              {parsed.paper_title && (
                                <p>
                                  <span className="font-medium text-gray-500">
                                    论文题目：
                                  </span>
                                  {parsed.paper_title}
                                </p>
                              )}
                              {parsed.research_progress && (
                                <p className="line-clamp-3">
                                  <span className="font-medium text-gray-500">
                                    研究进展：
                                  </span>
                                  {parsed.research_progress}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

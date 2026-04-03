import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Calendar, Shield, Wrench, Plus, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { DutyRoster as DutyRosterType, Profile } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';

dayjs.extend(isBetween);

// 办公室值日顺序（每周四轮换）
// 值日排班：每人一天（周一~周五），每4周轮换（每人往后挪一天，周五→周一）
// 基准：2026-03-30 周一起，周一=陈鸿琳
const DUTY_PEOPLE = ['陈鸿琳', '麦宏博', '彭鸿昌', '邓岩昊', '林弋杰'];
const DUTY_REF_MONDAY = dayjs('2026-03-30');
const DUTY_ROTATION_WEEKS = 4;

interface DutyWithUser extends DutyRosterType {
  user?: Profile;
}

export default function DutyRoster() {
  const { isAdmin } = useAuth();
  const [dutyList, setDutyList] = useState<DutyWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 编辑排班表单
  const [formArea, setFormArea] = useState<'lab' | 'office'>('lab');
  const [formUserId, setFormUserId] = useState('');
  const [formStartDate, setFormStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [formEndDate, setFormEndDate] = useState(dayjs().add(1, 'month').format('YYYY-MM-DD'));
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const today = dayjs();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const [dutyRes, equipRes] = await Promise.all([
        supabase
          .from('duty_roster')
          .select('*, user:profiles(*)')
          .order('start_date', { ascending: true }),
      ]);

      if (dutyRes.error) throw dutyRes.error;

      setDutyList(dutyRes.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('name');
    if (data) setProfiles(data);
  }

  function openModal() {
    fetchProfiles();
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!formUserId || !formStartDate || !formEndDate) return;
    try {
      setSubmitting(true);
      const { error: insertErr } = await supabase.from('duty_roster').insert({
        area: formArea,
        user_id: formUserId,
        start_date: formStartDate,
        end_date: formEndDate,
      });
      if (insertErr) throw insertErr;
      setShowModal(false);
      setFormUserId('');
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  // 当前实验室卫生值日人
  const currentLabDuty = useMemo(() => {
    return dutyList.find(
      (d) =>
        d.area === 'lab' &&
        today.isBetween(dayjs(d.start_date), dayjs(d.end_date), 'day', '[]')
    );
  }, [dutyList, today]);

  // 计算本周值日排班
  const weekDutySchedule = useMemo(() => {
    const diffWeeks = today.diff(DUTY_REF_MONDAY, 'week');
    const rotationCount = Math.floor(diffWeeks / DUTY_ROTATION_WEEKS);
    const days = ['周一', '周二', '周三', '周四', '周五'];
    return days.map((day, i) => ({
      day,
      name: DUTY_PEOPLE[(((i - rotationCount) % 5) + 5) % 5],
    }));
  }, [today]);

  const todayDutyName = useMemo(() => {
    const dow = today.day(); // 0=周日
    if (dow === 0 || dow === 6) return '今日无值日';
    return weekDutySchedule[dow - 1]?.name ?? '';
  }, [today, weekDutySchedule]);

  // 即将到来的排班
  const upcomingDuties = useMemo(() => {
    return dutyList.filter(
      (d) => dayjs(d.end_date).isAfter(today.subtract(1, 'day'))
    );
  }, [dutyList, today]);

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
        title="值日排班"
        subtitle="实验室卫生与办公室值日安排"
        action={
          isAdmin ? (
            <button
              onClick={openModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              编辑排班
            </button>
          ) : undefined
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {/* 本周值日 */}
        <Card title="本周值日">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">实验室卫生（月度轮换）</p>
                <p className="text-base font-semibold text-gray-900">
                  {currentLabDuty?.user?.name ?? '暂无安排'}
                </p>
                {currentLabDuty && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {dayjs(currentLabDuty.start_date).format('MM/DD')} ~{' '}
                    {dayjs(currentLabDuty.end_date).format('MM/DD')}
                  </p>
                )}
              </div>
            </div>

            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-gray-700">
                  今日值日：<span className="font-bold text-gray-900">{todayDutyName}</span>
                </p>
              </div>
              <p className="text-xs text-gray-500 mb-2">每4周轮换一次，每人往后挪一天</p>
              <div className="flex gap-1.5">
                {weekDutySchedule.map((item) => {
                  const dow = today.day();
                  const isToday = item.day === ['', '周一', '周二', '周三', '周四', '周五', ''][dow];
                  return (
                    <div
                      key={item.day}
                      className={`flex-1 text-center rounded-lg py-2 ${
                        isToday ? 'bg-green-600 text-white' : 'bg-white text-gray-600'
                      }`}
                    >
                      <p className={`text-[10px] ${isToday ? 'text-green-100' : 'text-gray-400'}`}>{item.day}</p>
                      <p className={`text-xs font-bold mt-0.5 ${isToday ? 'text-white' : 'text-gray-700'}`}>
                        {item.name}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* 排班表 */}
        <Card title="排班表">
          {upcomingDuties.length === 0 ? (
            <EmptyState title="暂无排班记录" description="管理员可添加排班" />
          ) : (
            <div className="space-y-3">
              {upcomingDuties.map((duty) => {
                const isCurrent = today.isBetween(
                  dayjs(duty.start_date),
                  dayjs(duty.end_date),
                  'day',
                  '[]'
                );
                return (
                  <div
                    key={duty.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isCurrent
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isCurrent ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {duty.user?.name ?? '未知'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {duty.area === 'lab' ? '实验室卫生' : '办公室值日'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {dayjs(duty.start_date).format('MM/DD')} ~{' '}
                        {dayjs(duty.end_date).format('MM/DD')}
                      </p>
                      {isCurrent && (
                        <span className="text-xs text-blue-600 font-medium">
                          当前
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

      </div>

      {/* 编辑排班 Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="添加排班"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !formUserId}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? '保存中...' : '保存'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              类型
            </label>
            <select
              value={formArea}
              onChange={(e) => setFormArea(e.target.value as 'lab' | 'office')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="lab">实验室卫生</option>
              <option value="office">办公室值日</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              值日人
            </label>
            <select
              value={formUserId}
              onChange={(e) => setFormUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">请选择</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                开始日期
              </label>
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                结束日期
              </label>
              <input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

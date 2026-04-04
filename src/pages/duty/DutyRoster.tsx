import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { Calendar, Shield, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  getLabDutyToday,
  getLabWeekSchedule,
  getOfficeDutyThisMonth,
  getMonday,
  type DutyConfig,
  type DutyOverride,
} from '../../lib/dutyCalculation';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';

// Fallback configs if DB fetch fails
const FALLBACK_LAB_CONFIG: DutyConfig = {
  type: 'lab',
  people: ['陈鸿琳', '麦宏博', '彭鸿昌', '邓岩昊', '林弋杰'],
  rotation_period: 4,
  ref_date: '2026-03-30',
};
const FALLBACK_OFFICE_CONFIG: DutyConfig = {
  type: 'office',
  people: ['林弋杰', '陈鸿琳', '麦宏博', '彭鸿昌', '邓岩昊'],
  rotation_period: 1,
  ref_date: '2026-03-01',
};

export default function DutyRoster() {
  const { isDutyManager, isAdmin } = useAuth();
  const navigate = useNavigate();
  const canManage = isDutyManager || isAdmin;

  const [dutyConfigs, setDutyConfigs] = useState<DutyConfig[]>([]);
  const [dutyOverrides, setDutyOverrides] = useState<DutyOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = dayjs();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const [configRes, overrideRes] = await Promise.all([
        supabase.from('duty_config').select('*'),
        supabase.from('duty_overrides').select('*'),
      ]);

      if (configRes.error) throw configRes.error;
      if (overrideRes.error) throw overrideRes.error;

      setDutyConfigs((configRes.data as DutyConfig[]) || []);
      setDutyOverrides((overrideRes.data as DutyOverride[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  const labConfig = useMemo(
    () => dutyConfigs.find((c) => c.type === 'lab') ?? FALLBACK_LAB_CONFIG,
    [dutyConfigs],
  );
  const officeConfig = useMemo(
    () => dutyConfigs.find((c) => c.type === 'office') ?? FALLBACK_OFFICE_CONFIG,
    [dutyConfigs],
  );
  const labOverrides = useMemo(
    () => dutyOverrides.filter((o) => o.type === 'lab'),
    [dutyOverrides],
  );
  const officeOverrides = useMemo(
    () => dutyOverrides.filter((o) => o.type === 'office'),
    [dutyOverrides],
  );

  const todayDutyName = useMemo(() => {
    const person = getLabDutyToday(labConfig, labOverrides);
    return person ?? '今日无值日';
  }, [labConfig, labOverrides]);

  const weekDutySchedule = useMemo(() => {
    const monday = getMonday(new Date());
    const names = getLabWeekSchedule(labConfig, labOverrides, monday);
    return ['周一', '周二', '周三', '周四', '周五'].map((day, i) => ({
      day,
      name: names[i],
    }));
  }, [labConfig, labOverrides]);

  const officeDutyName = useMemo(
    () => getOfficeDutyThisMonth(officeConfig, officeOverrides),
    [officeConfig, officeOverrides],
  );

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
          canManage ? (
            <button
              onClick={() => navigate('/admin/duty-manage')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
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
                <p className="text-sm text-gray-500">实验室今日值日</p>
                <p className="text-base font-semibold text-gray-900">
                  {todayDutyName}
                </p>
              </div>
            </div>

            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-gray-700">本周排班</p>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                每{labConfig.rotation_period}周轮换一次
              </p>
              <div className="flex gap-1.5">
                {weekDutySchedule.map((item) => {
                  const dow = today.day();
                  const isToday =
                    item.day ===
                    ['', '周一', '周二', '周三', '周四', '周五', ''][dow];
                  return (
                    <div
                      key={item.day}
                      className={`flex-1 text-center rounded-lg py-2 ${
                        isToday
                          ? 'bg-green-600 text-white'
                          : 'bg-white text-gray-600'
                      }`}
                    >
                      <p
                        className={`text-[10px] ${
                          isToday ? 'text-green-100' : 'text-gray-400'
                        }`}
                      >
                        {item.day}
                      </p>
                      <p
                        className={`text-xs font-bold mt-0.5 ${
                          isToday ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {item.name}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* 办公室值日 */}
        <Card title="办公室值日">
          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                {today.format('M')}月办公室值日
              </p>
              <p className="text-base font-semibold text-gray-900">
                {officeDutyName}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                每{officeConfig.rotation_period}月轮换
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

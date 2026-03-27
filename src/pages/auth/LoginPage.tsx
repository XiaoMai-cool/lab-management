import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  FlaskConical,
  Megaphone,
  CalendarCheck,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  created_at: string;
}

interface DutyInfo {
  area: string;
  user: { name: string } | null;
  start_date: string;
  end_date: string;
}

// 值日排班：每人一天（周一~周五），每4周轮换一次（每人往后挪一天，周五→周一）
// 基准：2026-03-30 这一周开始，周一=陈鸿琳
const DUTY_PEOPLE = ['陈鸿琳', '麦宏博', '彭鸿昌', '邓岩昊', '林弋杰'];
const DUTY_REF_MONDAY = new Date(2026, 2, 30); // 2026-03-30 周一
const DUTY_ROTATION_WEEKS = 4; // 每4周轮换

function getTodayDutyPerson(): { name: string; isWeekday: boolean } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=周日, 1=周一, ..., 5=周五, 6=周六

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { name: '今日无值日', isWeekday: false };
  }

  // 计算从基准周一到现在经过了多少天
  const diffDays = Math.floor((now.getTime() - DUTY_REF_MONDAY.getTime()) / (24 * 60 * 60 * 1000));
  // 计算经过了多少个4周周期
  const diffWeeks = Math.floor(diffDays / 7);
  const rotationCount = Math.floor(diffWeeks / DUTY_ROTATION_WEEKS);

  // 当天是周几（0=周一, 1=周二, ..., 4=周五）
  const weekdayIndex = dayOfWeek - 1;

  // 每次轮换，所有人往后挪一天：原来周一的人变周二，周五的人变周一
  // 等价于：dayIndex 对应的人 = (weekdayIndex - rotationCount) mod 5
  const personIndex = (((weekdayIndex - rotationCount) % 5) + 5) % 5;

  return { name: DUTY_PEOPLE[personIndex], isWeekday: true };
}

function getWeekDutySchedule(): { day: string; name: string }[] {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - DUTY_REF_MONDAY.getTime()) / (24 * 60 * 60 * 1000));
  const diffWeeks = Math.floor(diffDays / 7);
  const rotationCount = Math.floor(diffWeeks / DUTY_ROTATION_WEEKS);

  const days = ['周一', '周二', '周三', '周四', '周五'];
  return days.map((day, i) => ({
    day,
    name: DUTY_PEOPLE[(((i - rotationCount) % 5) + 5) % 5],
  }));
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getToday() {
  const now = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${now.getMonth() + 1}月${now.getDate()}日 星期${weekdays[now.getDay()]}`;
}

const priorityStyles = {
  urgent: 'border-l-red-500 bg-red-50',
  important: 'border-l-yellow-500 bg-yellow-50',
  normal: 'border-l-blue-500 bg-white',
};

const priorityLabels = {
  urgent: '紧急',
  important: '重要',
  normal: '',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Public data (no auth required)
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dutyRosters, setDutyRosters] = useState<DutyInfo[]>([]);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Fetch public data
  useEffect(() => {
    async function fetchPublicData() {
      const today = new Date().toISOString().split('T')[0];

      const [announcementsRes, dutyRes] = await Promise.all([
        supabase
          .from('announcements')
          .select('id,title,content,priority,created_at')
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('duty_roster')
          .select('area,start_date,end_date,user:profiles!user_id(name)')
          .lte('start_date', today)
          .gte('end_date', today),
      ]);

      if (announcementsRes.data) setAnnouncements(announcementsRes.data);
      if (dutyRes.data) setDutyRosters(dutyRes.data as unknown as DutyInfo[]);
    }
    fetchPublicData();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('邮箱或密码错误，请重试');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('邮箱尚未验证，请联系管理员');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }
    } catch {
      setError('登录失败，请稍后再试');
      setLoading(false);
    }
  }

  const labDuty = dutyRosters.find((d) => d.area === 'lab');
  const todayDuty = getTodayDutyPerson();
  const weekSchedule = getWeekDutySchedule();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-blue-600" />
            <span className="text-lg font-bold text-gray-900">实验室管理系统</span>
          </div>
          <span className="text-sm text-gray-500">{getToday()}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Left: Public Info (announcements + duty) */}
          <div className="md:col-span-2 space-y-5 order-2 md:order-1">

            {/* Duty Info Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarCheck className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-gray-900">今日值日</h2>
              </div>
              {/* 今日值日 */}
              <div className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3 mb-3">
                <div>
                  <p className="text-xs text-blue-600 font-medium">今日值日</p>
                  <p className="text-lg font-bold text-gray-900 mt-0.5">{todayDuty.name}</p>
                </div>
                <CalendarCheck className="w-8 h-8 text-blue-200" />
              </div>

              {/* 本周排班 */}
              <div className="flex gap-1.5">
                {weekSchedule.map((item) => {
                  const isToday = item.day === ['', '周一', '周二', '周三', '周四', '周五', ''][new Date().getDay()];
                  return (
                    <div
                      key={item.day}
                      className={`flex-1 text-center rounded-lg py-2 ${
                        isToday ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      <p className={`text-[10px] ${isToday ? 'text-blue-100' : 'text-gray-400'}`}>{item.day}</p>
                      <p className={`text-xs font-bold mt-0.5 ${isToday ? 'text-white' : 'text-gray-700'}`}>
                        {item.name.slice(0, 1)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* 实验室卫生 */}
              {labDuty?.user?.name && (
                <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-3 mt-3">
                  <div>
                    <p className="text-xs text-green-600 font-medium">实验室卫生（月轮换）</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{labDuty.user.name}</p>
                  </div>
                  <CalendarCheck className="w-8 h-8 text-green-200" />
                </div>
              )}
            </div>

            {/* Announcements */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="w-5 h-5 text-orange-500" />
                <h2 className="text-sm font-bold text-gray-900">公告通知</h2>
              </div>

              {announcements.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  暂无公告
                </div>
              ) : (
                <div className="space-y-2.5">
                  {announcements.map((a) => (
                    <div
                      key={a.id}
                      className={`border-l-4 rounded-lg px-4 py-3 ${priorityStyles[a.priority]}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {a.title}
                            </h3>
                            {a.priority !== 'normal' && (
                              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                a.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {priorityLabels[a.priority]}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {a.content}
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                          {formatDate(a.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-bold text-gray-900">注意事项</h2>
              </div>
              <ul className="space-y-2 text-xs text-gray-600">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                  <span>耗材预约每周一 11:00 后统一发放，周一 9:00 后提交的顺延至下周</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                  <span>危化品使用需登记，使用完的空瓶集中放在药品柜旁纸箱</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                  <span>办公室值日时间为每周四，请将高挥发性物品及时带离</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                  <span>违规两次及以上暂停一周领取资格</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right: Login Form */}
          <div className="order-1 md:order-2">
            <div className="md:sticky md:top-6">
              {/* Logo */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-3">
                  <FlaskConical className="w-8 h-8" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">系统登录</h1>
                <p className="text-xs text-gray-500 mt-1">深圳大学 冯老师课题组</p>
              </div>

              {/* Login Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700">
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                      账号
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="请输入账号"
                      required
                      autoComplete="email"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                      密码
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="请输入密码"
                        required
                        autoComplete="current-password"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? '登录中...' : '登录'}
                  </button>
                </form>
              </div>

              <p className="text-center text-[10px] text-gray-400 mt-4">
                如需账号请联系管理员
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

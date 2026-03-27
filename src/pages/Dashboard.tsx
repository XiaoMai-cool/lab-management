import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  FlaskConical,
  Receipt,
  CalendarCheck,
  AlertTriangle,
  Megaphone,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type {
  Announcement,
  Supply,
  DutyRoster,
  SupplyReservation,
  Reimbursement,
} from '../lib/types';

const quickActions = [
  { label: '预约耗材', path: '/supplies/reserve', icon: Package, color: 'bg-blue-50 text-blue-600' },
  { label: '借用耗材', path: '/supplies/borrow', icon: Package, color: 'bg-cyan-50 text-cyan-600' },
  { label: '药品登记', path: '/chemicals/log', icon: FlaskConical, color: 'bg-purple-50 text-purple-600' },
  { label: '药品申购', path: '/reagents/purchase', icon: FlaskConical, color: 'bg-pink-50 text-pink-600' },
  { label: '报销申请', path: '/reimbursements/new', icon: Receipt, color: 'bg-green-50 text-green-600' },
  { label: '值日查询', path: '/duty', icon: CalendarCheck, color: 'bg-orange-50 text-orange-600' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getToday() {
  const now = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekdays[now.getDay()]}`;
}

// === 值日计算（与登录页保持一致） ===
const LAB_DUTY_PEOPLE = ['陈鸿琳', '麦宏博', '彭鸿昌', '邓岩昊', '林弋杰'];
const LAB_DUTY_REF_MONDAY = new Date(2026, 2, 30);
const LAB_DUTY_ROTATION_WEEKS = 4;

const OFFICE_DUTY_PEOPLE = ['林弋杰', '陈鸿琳', '麦宏博', '彭鸿昌', '邓岩昊'];
const OFFICE_DUTY_REF_YEAR = 2026;
const OFFICE_DUTY_REF_MONTH = 2; // March

function getLabDutyToday(): string {
  const now = new Date();
  const dow = now.getDay();
  if (dow === 0 || dow === 6) return '今日无值日（周末）';
  const diffDays = Math.floor((now.getTime() - LAB_DUTY_REF_MONDAY.getTime()) / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const rotationCount = Math.floor(diffWeeks / LAB_DUTY_ROTATION_WEEKS);
  const personIndex = (((dow - 1 - rotationCount) % 5) + 5) % 5;
  return LAB_DUTY_PEOPLE[personIndex];
}

function getLabWeekSchedule(): { day: string; name: string }[] {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - LAB_DUTY_REF_MONDAY.getTime()) / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const rotationCount = Math.floor(diffWeeks / LAB_DUTY_ROTATION_WEEKS);
  return ['周一', '周二', '周三', '周四', '周五'].map((day, i) => ({
    day,
    name: LAB_DUTY_PEOPLE[(((i - rotationCount) % 5) + 5) % 5],
  }));
}

function getOfficeDutyThisMonth(): string {
  const now = new Date();
  const monthDiff = (now.getFullYear() - OFFICE_DUTY_REF_YEAR) * 12 + (now.getMonth() - OFFICE_DUTY_REF_MONTH);
  return OFFICE_DUTY_PEOPLE[((monthDiff % 5) + 5) % 5];
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [lowStockSupplies, setLowStockSupplies] = useState<Supply[]>([]);
  const [_dutyRosters, _setDutyRosters] = useState<DutyRoster[]>([]);
  const [pendingReservations, setPendingReservations] = useState<SupplyReservation[]>([]);
  const [pendingReimbursements, setPendingReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        announcementsRes,
        suppliesRes,
        dutyRes,
        reservationsRes,
        reimbursementsRes,
      ] = await Promise.all([
        supabase
          .from('announcements')
          .select('*, author:profiles!author_id(name)')
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase.from('supplies').select('*, category:supply_categories(name)'),
        supabase
          .from('duty_roster')
          .select('*, user:profiles!user_id(name)')
          .lte('start_date', today)
          .gte('end_date', today),
        user
          ? supabase
              .from('supply_reservations')
              .select('*, supply:supplies(name)')
              .eq('user_id', user.id)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], error: null }),
        user
          ? supabase
              .from('reimbursements')
              .select('*')
              .eq('user_id', user.id)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (announcementsRes.data) setAnnouncements(announcementsRes.data);
      if (suppliesRes.data) {
        setLowStockSupplies(
          suppliesRes.data.filter((s: Supply) => s.stock <= s.min_stock)
        );
      }
      if (dutyRes.data) setDutyRosters(dutyRes.data);
      if (reservationsRes.data) setPendingReservations(reservationsRes.data);
      if (reimbursementsRes.data) setPendingReimbursements(reimbursementsRes.data);
    } catch (err) {
      setError('数据加载失败，请稍后再试');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-sm text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-500 mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const labDutyName = getLabDutyToday();
  const labWeekSchedule = getLabWeekSchedule();
  const officeDutyName = getOfficeDutyThisMonth();

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          你好, {profile?.name || '用户'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{getToday()}</p>
      </div>

      {/* 公告栏 */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">公告栏</h2>
        </div>
        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
            暂无公告
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`bg-white rounded-xl border border-gray-200 p-4 ${
                  a.priority === 'urgent'
                    ? 'border-l-4 border-l-red-500'
                    : a.priority === 'important'
                      ? 'border-l-4 border-l-yellow-500'
                      : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
                    {a.priority === 'urgent' && (
                      <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded mr-1.5">
                        紧急
                      </span>
                    )}
                    {a.priority === 'important' && (
                      <span className="inline-block px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded mr-1.5">
                        重要
                      </span>
                    )}
                    {a.title}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 mt-1.5 line-clamp-2 whitespace-pre-line">
                  {a.content}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{(a.author as any)?.name || '未知'}</span>
                  <span>{formatDate(a.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 快捷操作 */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">快捷操作</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.path}
                to={action.path}
                className="flex flex-col items-center gap-2.5 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 库存预警 & 本周值日 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 库存预警 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900">库存预警</h2>
          </div>
          {lowStockSupplies.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
              库存充足
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockSupplies.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {s.name}
                    </p>
                    <p className="text-xs text-gray-500">{s.specification}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span
                      className={`text-sm font-semibold ${
                        s.stock === 0 ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {s.stock}
                    </span>
                    <span className="text-xs text-gray-400 ml-0.5">{s.unit}</span>
                    <p className="text-xs text-gray-400">
                      最低 {s.min_stock}
                      {s.unit}
                    </p>
                  </div>
                </div>
              ))}
              {lowStockSupplies.length > 5 && (
                <Link
                  to="/supplies"
                  className="block text-center text-sm text-blue-600 hover:text-blue-700 py-2"
                >
                  查看全部 ({lowStockSupplies.length})
                </Link>
              )}
            </div>
          )}
        </section>

        {/* 本周值日 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck className="w-5 h-5 text-green-600" />
            <h2 className="text-base font-semibold text-gray-900">值日安排</h2>
          </div>
          <div className="space-y-3">
            {/* 今日值日 + 办公室本月 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 rounded-xl px-3 py-3 text-center">
                <p className="text-[10px] text-blue-500 font-medium">实验室今日</p>
                <p className="text-base font-bold text-gray-900 mt-1">{labDutyName}</p>
              </div>
              <div className="bg-green-50 rounded-xl px-3 py-3 text-center">
                <p className="text-[10px] text-green-500 font-medium">办公室本月</p>
                <p className="text-base font-bold text-gray-900 mt-1">{officeDutyName}</p>
              </div>
            </div>
            {/* 本周排班 */}
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] text-gray-400 mb-2">实验室本周排班</p>
              <div className="flex gap-1.5">
                {labWeekSchedule.map((item) => {
                  const dow = new Date().getDay();
                  const isToday = item.day === ['', '周一', '周二', '周三', '周四', '周五', ''][dow];
                  return (
                    <div
                      key={item.day}
                      className={`flex-1 text-center rounded-lg py-2 ${
                        isToday ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      <p className={`text-[10px] ${isToday ? 'text-blue-100' : 'text-gray-400'}`}>{item.day}</p>
                      <p className={`text-xs font-bold mt-0.5 ${isToday ? 'text-white' : 'text-gray-700'}`}>{item.name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 我的待办 */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">我的待办</h2>
        </div>
        {pendingReservations.length === 0 && pendingReimbursements.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
            暂无待办事项
          </div>
        ) : (
          <div className="space-y-2">
            {pendingReservations.map((r) => (
              <Link
                key={r.id}
                to="/supplies/my-reservations"
                className="block bg-white rounded-xl border border-gray-200 p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      耗材预约 - {(r.supply as any)?.name || '未知'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      数量: {r.quantity} | {formatDate(r.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    待审批
                  </span>
                </div>
              </Link>
            ))}
            {pendingReimbursements.map((r) => (
              <Link
                key={r.id}
                to="/reimbursements"
                className="block bg-white rounded-xl border border-gray-200 p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      报销申请 - {r.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      金额: ¥{r.amount.toFixed(2)} | {formatDate(r.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    待审批
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

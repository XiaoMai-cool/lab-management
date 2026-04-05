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
  ClipboardList,
  FileText,
  ChevronRight,
  Download,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { stripHtml } from '../lib/sanitize';
import type {
  Announcement,
  AnnouncementAttachment,
  Supply,

  SupplyReservation,
} from '../lib/types';

const quickActions = [
  { label: '申领物资', path: '/supplies/reserve', icon: Package, color: 'bg-blue-50 text-blue-600' },
  { label: '采购申请', path: '/purchase-approvals/new', icon: Receipt, color: 'bg-purple-50 text-purple-600' },
  { label: '药品总览', path: '/reagents', icon: FlaskConical, color: 'bg-pink-50 text-pink-600' },
  { label: '值日查询', path: '/duty', icon: CalendarCheck, color: 'bg-orange-50 text-orange-600' },
  { label: '公告与文档', path: '/documents', icon: FileText, color: 'bg-teal-50 text-teal-600' },
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

import {
  getLabDutyToday as calcLabDutyToday,
  getLabWeekSchedule as calcLabWeekSchedule,
  getOfficeDutyThisMonth as calcOfficeDutyThisMonth,
  getMonday,
  type DutyConfig,
  type DutyOverride,
} from '../lib/dutyCalculation';

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

interface ChemicalWarning {
  id: string;
  status: string;
  chemical: { name: string; batch_number: string } | null;
}

export default function Dashboard() {
  const { user, profile, isSuppliesManager, isChemicalsManager, isTeacher, isReimbursementApprover, isSuperAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [lowStockSupplies, setLowStockSupplies] = useState<Supply[]>([]);
  const [pendingReservations, setPendingReservations] = useState<SupplyReservation[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<{ id: string; title: string; estimated_amount: number | null; created_at: string }[]>([]);
  const [chemicalWarnings, setChemicalWarnings] = useState<ChemicalWarning[]>([]);
  const [pendingTaskCounts, setPendingTaskCounts] = useState<{
    supplyReservations: number;
    chemicalWarningsPending: number;
    purchaseApprovals: number;
    reimbursementsPending: number;
  }>({ supplyReservations: 0, chemicalWarningsPending: 0, purchaseApprovals: 0, reimbursementsPending: 0 });
  const [todayReturnedCount, setTodayReturnedCount] = useState(0);
  const [dutyConfigs, setDutyConfigs] = useState<DutyConfig[]>([]);
  const [dutyOverrides, setDutyOverrides] = useState<DutyOverride[]>([]);
  const hasAnyManagerRole = isSuppliesManager || isChemicalsManager || isTeacher || isReimbursementApprover || isSuperAdmin;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);

    let hasAnyError = false;

    // 所有查询并行执行，大幅减少总耗时
    const promises: PromiseLike<void>[] = [];

    promises.push(
      supabase
        .from('announcements')
        .select('*, author:profiles!author_id(name)')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(3)
        .then(({ data, error: err }) => {
          if (err) { hasAnyError = true; console.error('Announcements:', err); return; }
          setAnnouncements(data || []);
        })
    );

    promises.push(
      supabase
        .from('supplies')
        .select('id,name,specification,stock,unit,min_stock,category:supply_categories(name)')
        .then(({ data, error: err }) => {
          if (err) { hasAnyError = true; console.error('Supplies:', err); return; }
          setLowStockSupplies(((data || []) as unknown as Supply[]).filter((s: Supply) => s.stock <= s.min_stock));
        })
    );

    if (user) {
      promises.push(
        supabase
          .from('supply_reservations')
          .select('id,quantity,purpose,status,created_at,supply:supplies(name)')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5)
          .then(({ data, error: err }) => {
            if (err) { hasAnyError = true; return; }
            setPendingReservations((data || []) as unknown as SupplyReservation[]);
          })
      );

      promises.push(
        supabase
          .from('purchases')
          .select('id,title,estimated_amount,created_at')
          .eq('applicant_id', user.id)
          .eq('approval_status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5)
          .then(({ data, error: err }) => {
            if (err) { hasAnyError = true; return; }
            setPendingPurchases(data || []);
          })
      );
    }

    if (isChemicalsManager) {
      promises.push(
        supabase
          .from('chemical_warnings')
          .select('id, status, chemical:chemicals(name, batch_number)')
          .neq('status', 'arrived')
          .order('created_at', { ascending: false })
          .then(({ data, error: err }) => {
            if (err) { hasAnyError = true; console.error('Warnings:', err); return; }
            setChemicalWarnings((data as unknown as ChemicalWarning[]) || []);
          })
      );
    }

    // 待办事项计数查询
    if (isSuppliesManager) {
      promises.push(
        supabase
          .from('supply_reservations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .then(({ count, error: err }) => {
            if (err) { hasAnyError = true; return; }
            setPendingTaskCounts((prev) => ({ ...prev, supplyReservations: count ?? 0 }));
          })
      );
    }

    if (isChemicalsManager) {
      promises.push(
        supabase
          .from('chemical_warnings')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .then(({ count, error: err }) => {
            if (err) { hasAnyError = true; return; }
            setPendingTaskCounts((prev) => ({ ...prev, chemicalWarningsPending: count ?? 0 }));
          })
      );
    }

    if (isTeacher && profile) {
      const purchaseQuery = supabase
        .from('purchases')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'pending');
      if (!isSuperAdmin) {
        purchaseQuery.eq('approver_id', profile.id);
      }
      promises.push(
        purchaseQuery.then(({ count, error: err }) => {
            if (err) { hasAnyError = true; return; }
            setPendingTaskCounts((prev) => ({ ...prev, purchaseApprovals: count ?? 0 }));
          })
      );
    }

    if (isReimbursementApprover) {
      promises.push(
        supabase
          .from('reimbursements')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .then(({ count, error: err }) => {
            if (err) { hasAnyError = true; return; }
            setPendingTaskCounts((prev) => ({ ...prev, reimbursementsPending: count ?? 0 }));
          })
      );
    }

    // Today's returned items (for supplies manager)
    if (isSuppliesManager) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      promises.push(
        supabase
          .from('supply_borrowings')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'returned')
          .gte('returned_at', todayStart.toISOString())
          .then(({ count, error: err }) => {
            if (err) { hasAnyError = true; return; }
            setTodayReturnedCount(count ?? 0);
          })
      );
    }

    // Duty config & overrides
    promises.push(
      supabase
        .from('duty_config')
        .select('*')
        .then(({ data, error: err }) => {
          if (err) { console.error('Duty config:', err); return; }
          setDutyConfigs((data as DutyConfig[]) || []);
        })
    );
    promises.push(
      supabase
        .from('duty_overrides')
        .select('*')
        .then(({ data, error: err }) => {
          if (err) { console.error('Duty overrides:', err); return; }
          setDutyOverrides((data as DutyOverride[]) || []);
        })
    );

    try {
      await Promise.all(promises);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      hasAnyError = true;
    }

    if (hasAnyError) {
      setError('部分数据加载失败');
    }
    setLoading(false);
  }

  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  // Loading timeout: after 10 seconds, show content anyway
  useEffect(() => {
    if (!loading) {
      setLoadingTimeout(false);
      return;
    }
    const timer = setTimeout(() => {
      if (loading) {
        setLoadingTimeout(true);
        setLoading(false);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading]);

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

  const labConfig = dutyConfigs.find((c) => c.type === 'lab') ?? FALLBACK_LAB_CONFIG;
  const officeConfig = dutyConfigs.find((c) => c.type === 'office') ?? FALLBACK_OFFICE_CONFIG;
  const labOverridesOnly = dutyOverrides.filter((o) => o.type === 'lab');
  const officeOverridesOnly = dutyOverrides.filter((o) => o.type === 'office');

  const labDutyPerson = calcLabDutyToday(labConfig, labOverridesOnly);
  const labDutyName = labDutyPerson ?? '今日无值日（周末）';
  const monday = getMonday(new Date());
  const labWeekNames = calcLabWeekSchedule(labConfig, labOverridesOnly, monday);
  const labWeekSchedule = ['周一', '周二', '周三', '周四', '周五'].map((day, i) => ({
    day,
    name: labWeekNames[i],
  }));
  const officeDutyName = calcOfficeDutyThisMonth(officeConfig, officeOverridesOnly);

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 space-y-6">
      {/* Loading timeout notice */}
      {loadingTimeout && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-sm">
          <RefreshCw className="w-4 h-4 shrink-0" />
          部分数据加载中，已显示可用内容
        </div>
      )}

      {/* Error banner (non-blocking) */}
      {error && (
        <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <span>{error}</span>
          <button
            onClick={fetchData}
            className="shrink-0 ml-3 px-3 py-1 bg-red-600 text-white rounded-md text-xs hover:bg-red-700 transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {/* Welcome Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          你好, {profile?.name || '用户'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{getToday()}</p>
      </div>

      {/* 待办事项 (managers only) */}
      {hasAnyManagerRole && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">待办事项</h2>
          </div>
          {(() => {
            const tasks: { label: string; count: number; path: string; color: string }[] = [];
            if (isSuppliesManager && pendingTaskCounts.supplyReservations > 0) {
              tasks.push({ label: '耗材申领待审批', count: pendingTaskCounts.supplyReservations, path: '/supplies/review', color: 'bg-red-50 text-red-700 border-red-200' });
            }
            if (isChemicalsManager && pendingTaskCounts.chemicalWarningsPending > 0) {
              tasks.push({ label: '药品补货待处理', count: pendingTaskCounts.chemicalWarningsPending, path: '/reagents/warnings', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' });
            }
            if (isTeacher && pendingTaskCounts.purchaseApprovals > 0) {
              tasks.push({ label: '采购待审批', count: pendingTaskCounts.purchaseApprovals, path: '/purchase-approvals/review', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' });
            }
            if (isReimbursementApprover && pendingTaskCounts.reimbursementsPending > 0) {
              tasks.push({ label: '报销待审批', count: pendingTaskCounts.reimbursementsPending, path: '/reimbursements/review', color: 'bg-blue-50 text-blue-700 border-blue-200' });
            }
            if (isSuppliesManager && todayReturnedCount > 0) {
              tasks.push({ label: '物资已归还', count: todayReturnedCount, path: '/supplies/borrowings', color: 'bg-green-50 text-green-700 border-green-200' });
            }
            if (tasks.length === 0) {
              return (
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-400">
                  暂无待办
                </div>
              );
            }
            return (
              <div className="flex flex-wrap gap-3">
                {tasks.map((t) => (
                  <Link
                    key={t.path}
                    to={t.path}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm hover:shadow-md transition-shadow ${t.color}`}
                  >
                    <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-current/10 text-xs font-bold">
                      {t.count}
                    </span>
                    <span>{t.path === '/supplies/borrowings' ? `今日${t.count}项${t.label}` : `${t.count}条${t.label}`}</span>
                  </Link>
                ))}
              </div>
            );
          })()}
        </section>
      )}

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

      {/* 公告栏 */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">公告栏</h2>
          <Link to="/documents?tab=announcements" className="ml-auto text-sm text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
            查看全部 <ChevronRight className="w-3.5 h-3.5" />
          </Link>
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
                <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">
                  {stripHtml(a.content)}
                </p>
                {/* Announcement attachments */}
                {a.attachments && (a.attachments as AnnouncementAttachment[]).length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {(a.attachments as AnnouncementAttachment[]).map((att, idx) =>
                      att.type?.startsWith('image/') ? (
                        <img key={idx} src={att.url} alt={att.name} className="max-w-full max-h-48 rounded-lg border border-gray-200" />
                      ) : (
                        <a
                          key={idx}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md"
                        >
                          <Download className="w-3 h-3" />
                          {att.name}
                        </a>
                      )
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{(a.author as any)?.name || '未知'}</span>
                  <span>{formatDate(a.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 值日安排 */}
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

      {/* 库存预警 (耗材管理员 & 超级管理员 only) */}
      {(isSuppliesManager || isSuperAdmin) && (
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
      )}

      {/* 药品预警 (chemicals managers only) */}
      {isChemicalsManager && chemicalWarnings.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-base font-semibold text-gray-900">药品补货提醒</h2>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold">
              {chemicalWarnings.length}
            </span>
          </div>
          <div className="space-y-2">
            {chemicalWarnings.slice(0, 5).map((w) => (
              <div
                key={w.id}
                className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {w.chemical?.name || '未知药品'}
                  </p>
                  <p className="text-xs text-gray-500">{w.chemical?.batch_number || '-'}</p>
                </div>
                <span
                  className={`shrink-0 ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    w.status === 'pending'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {w.status === 'pending' ? '即将用完' : w.status === 'ordered' ? '已下单' : w.status}
                </span>
              </div>
            ))}
            {chemicalWarnings.length > 5 && (
              <Link
                to="/reagents/warnings"
                className="block text-center text-sm text-blue-600 hover:text-blue-700 py-2"
              >
                查看全部 ({chemicalWarnings.length})
              </Link>
            )}
          </div>
        </section>
      )}

      {/* 我的待办 */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">我的待办</h2>
        </div>
        {pendingReservations.length === 0 && pendingPurchases.length === 0 ? (
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
            {pendingPurchases.map((r) => (
              <Link
                key={r.id}
                to="/purchase-approvals"
                className="block bg-white rounded-xl border border-gray-200 p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      采购申请 - {r.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.estimated_amount ? `预估: ¥${r.estimated_amount}` : ''} {formatDate(r.created_at)}
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

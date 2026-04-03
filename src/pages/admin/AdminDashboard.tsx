import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Megaphone,
  Users,
  Package,
  FileText,
  CalendarDays,
  Download,
  ClipboardCheck,
  Receipt,
  FlaskConical,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';

interface ModuleCard {
  title: string;
  description: string;
  icon: typeof Megaphone;
  path: string;
  color: string;
  badgeKey?: 'pendingReservations' | 'pendingReimbursements';
}

const modules: ModuleCard[] = [
  {
    title: '公告管理',
    description: '发布和管理课题组公告',
    icon: Megaphone,
    path: '/admin/announcements',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    title: '人员管理',
    description: '管理成员账号和权限',
    icon: Users,
    path: '/admin/members',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    title: '耗材管理',
    description: '管理库存和耗材信息',
    icon: Package,
    path: '/admin/supplies',
    color: 'bg-green-50 text-green-600',
  },
  {
    title: '制度文档',
    description: '管理规章制度和文档',
    icon: FileText,
    path: '/documents',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    title: '排班管理',
    description: '安排值日和排班',
    icon: CalendarDays,
    path: '/duty',
    color: 'bg-teal-50 text-teal-600',
  },
  {
    title: '数据导出',
    description: '导出各类数据报表',
    icon: Download,
    path: '/admin/export',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    title: '预约审批',
    description: '审批耗材预约申请',
    icon: ClipboardCheck,
    path: '/supplies/review',
    color: 'bg-amber-50 text-amber-600',
    badgeKey: 'pendingReservations',
  },
  {
    title: '报销审批',
    description: '审批报销申请',
    icon: Receipt,
    path: '/reimbursements/review',
    color: 'bg-rose-50 text-rose-600',
    badgeKey: 'pendingReimbursements',
  },
  {
    title: '供应商管理',
    description: '管理试剂供应商信息',
    icon: FlaskConical,
    path: '/reagents/suppliers',
    color: 'bg-cyan-50 text-cyan-600',
  },
  {
    title: '借用管理',
    description: '查看耗材借用与归还',
    icon: Package,
    path: '/supplies/borrowings',
    color: 'bg-teal-50 text-teal-600',
  },
  {
    title: '药品补货',
    description: '查看药品补货与到货状态',
    icon: AlertTriangle,
    path: '/reagents/warnings',
    color: 'bg-red-50 text-red-600',
  },
  {
    title: '报销统计',
    description: '查看报销数据统计',
    icon: BarChart3,
    path: '/reimbursements/stats',
    color: 'bg-emerald-50 text-emerald-600',
  },
];

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const [pendingCounts, setPendingCounts] = useState({
    pendingReservations: 0,
    pendingReimbursements: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPendingCounts() {
      try {
        const [reservationsRes, reimbursementsRes] = await Promise.all([
          supabase
            .from('supply_reservations')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('reimbursements')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        ]);

        setPendingCounts({
          pendingReservations: reservationsRes.count ?? 0,
          pendingReimbursements: reimbursementsRes.count ?? 0,
        });
      } catch (err) {
        console.error('Failed to fetch pending counts:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPendingCounts();
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-gray-500 text-sm">您没有权限访问管理后台</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">管理后台</h1>
        <p className="text-sm text-gray-500 mt-1">系统管理和数据维护</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const badgeCount = mod.badgeKey ? pendingCounts[mod.badgeKey] : 0;

          return (
            <Link
              key={mod.path}
              to={mod.path}
              className="relative bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 hover:shadow-md active:scale-[0.98] transition-all"
            >
              {badgeCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold">
                  {badgeCount}
                </span>
              )}
              <div
                className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${mod.color} mb-3`}
              >
                <Icon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <h3 className="text-sm md:text-base font-semibold text-gray-900">
                {mod.title}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                {mod.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

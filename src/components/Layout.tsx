import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Package,
  FlaskConical,
  FileText,
  User,
  Settings,
  Bell,
  LogOut,
  ChevronDown,
  ClipboardCheck,
  BarChart3,
  AlertTriangle,
  Beaker,
  ArrowLeftRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMode } from '../contexts/ModeContext';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  manager: '板块负责人',
  teacher: '教师',
  student: '学生',
};

// 使用模式导航
const useNavItems: NavItem[] = [
  { label: '首页', icon: Home, path: '/' },
  { label: '物资', icon: Package, path: '/supplies' },
  { label: '药品', icon: FlaskConical, path: '/reagents' },
  { label: '报销', icon: FileText, path: '/reimbursements' },
  { label: '我的', icon: User, path: '/profile' },
];

// 管理模式导航 - 根据权限动态生成
function getManageNavItems(auth: ReturnType<typeof useAuth>): NavItem[] {
  const items: NavItem[] = [
    { label: '总览', icon: Home, path: '/' },
  ];

  if (auth.isSuppliesManager) {
    items.push({ label: '耗材审批', icon: ClipboardCheck, path: '/supplies/review' });
    items.push({ label: '耗材管理', icon: Package, path: '/admin/supplies' });
  }

  if (auth.isChemicalsManager) {
    items.push({ label: '药品补货', icon: AlertTriangle, path: '/reagents/warnings' });
    items.push({ label: '药品管理', icon: FlaskConical, path: '/reagents/new' });
  }

  if (auth.isTeacher) {
    items.push({ label: '采购审批', icon: ClipboardCheck, path: '/purchase-approvals/review' });
  }

  if (auth.isReimbursementApprover) {
    items.push({ label: '报销审批', icon: FileText, path: '/reimbursements/review' });
  }

  if (auth.isSuppliesManager || auth.isChemicalsManager) {
    items.push({ label: '报销统计', icon: BarChart3, path: '/reimbursements/stats' });
  }

  if (auth.isAdmin) {
    items.push({ label: '系统管理', icon: Settings, path: '/admin' });
  }

  items.push({ label: '我的', icon: User, path: '/profile' });

  return items;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { profile, signOut } = auth;
  const { mode, setMode } = useMode();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 如果之前选过管理模式（localStorage 记住了），即使 profile 还没加载也显示切换按钮
  const profileLoaded = !!profile;
  const hasManagePermission = profileLoaded
    ? (auth.isAdmin || auth.isManager || auth.isTeacher)
    : (mode === 'manage'); // profile 没加载但之前选过管理模式，也显示按钮
  const navItems = mode === 'manage' && (hasManagePermission || !profileLoaded) ? getManageNavItems(auth) : useNavItems;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  function toggleMode() {
    const newMode = mode === 'use' ? 'manage' : 'use';
    setMode(newMode);
    navigate('/');
  }

  async function handleLogout() {
    try {
      await signOut();
      localStorage.removeItem('app_mode');
      localStorage.removeItem('has_chosen_mode');
      navigate('/login', { replace: true });
    } catch {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  }

  const modeLabel = mode === 'manage' ? '管理模式' : '使用模式';
  const modeColor = mode === 'manage' ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-5 border-b border-gray-200 shrink-0">
          <FlaskConical className="w-7 h-7 text-blue-600 mr-2.5" />
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            实验室管理
          </span>
        </div>

        {/* Mode Indicator + Switcher */}
        {hasManagePermission && (
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={toggleMode}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${modeColor}`}
            >
              <span className="flex items-center gap-2">
                {mode === 'manage' ? <Settings className="w-4 h-4" /> : <Beaker className="w-4 h-4" />}
                {modeLabel}
              </span>
              <ArrowLeftRight className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>
        )}

        {/* Sidebar Nav */}
        <nav className="flex-1 py-2 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
              {profile?.name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{profile?.name || '用户'}</p>
              <p className="text-xs text-gray-500 truncate">{ROLE_LABELS[profile?.role ?? ''] ?? '成员'}</p>
            </div>
            <button onClick={handleLogout} title="退出登录" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-60">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-20 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-blue-600" />
            <span className="text-base font-bold text-gray-900">实验室管理</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Mode switcher */}
            {hasManagePermission && (
              <button
                onClick={toggleMode}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                  mode === 'manage'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {mode === 'manage' ? '⚙️ 管理' : '🧪 使用'}
                <ArrowLeftRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            )}
            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                  {profile?.name?.charAt(0) || 'U'}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-fade-in">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{profile?.name || '用户'}</p>
                      <p className="text-xs text-gray-500">{ROLE_LABELS[profile?.role ?? ''] ?? '成员'}</p>
                    </div>
                    <button
                      onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      个人中心
                    </button>
                    <button
                      onClick={() => { handleLogout(); setShowUserMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex sticky top-0 z-20 h-16 bg-white border-b border-gray-200 items-center justify-end px-6">
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 pl-3 border-l border-gray-200 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                  {profile?.name?.charAt(0) || 'U'}
                </div>
                <span className="text-sm font-medium text-gray-700">{profile?.name || '用户'}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-fade-in">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{profile?.name || '用户'}</p>
                      <p className="text-xs text-gray-500">{profile?.email || ''}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium text-blue-700 bg-blue-50 rounded-full">
                        {ROLE_LABELS[profile?.role ?? ''] ?? '成员'}
                      </span>
                    </div>
                    <button
                      onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      个人中心
                    </button>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => { handleLogout(); setShowUserMenu(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5"
                      >
                        <LogOut className="w-4 h-4" />
                        退出登录
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-colors cursor-pointer ${
                  active ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

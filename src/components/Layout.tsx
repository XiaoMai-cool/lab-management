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
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

interface ManageGroup {
  label: string;
  colorScheme: 'yellow' | 'blue' | 'purple' | 'gray';
  items: NavItem[];
}

interface ManageConfig {
  standalone: NavItem[];
  groups: ManageGroup[];
}

const GROUP_COLORS = {
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    iconBg: 'bg-yellow-100',
    iconText: 'text-yellow-600',
    label: 'text-yellow-800',
    activeBg: 'bg-yellow-50',
    activeText: 'text-yellow-700',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    label: 'text-blue-800',
    activeBg: 'bg-blue-50',
    activeText: 'text-blue-700',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600',
    label: 'text-purple-800',
    activeBg: 'bg-purple-50',
    activeText: 'text-purple-700',
  },
  gray: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    iconBg: 'bg-gray-100',
    iconText: 'text-gray-600',
    label: 'text-gray-700',
    activeBg: 'bg-gray-100',
    activeText: 'text-gray-700',
  },
} as const;

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  manager: '板块负责人',
  teacher: '教师',
  student: '学生',
};

// 底部导航（固定5个，所有人一样）
const bottomNavItems: NavItem[] = [
  { label: '首页', icon: Home, path: '/' },
  { label: '物资', icon: Package, path: '/supplies' },
  { label: '药品', icon: FlaskConical, path: '/reagents' },
  { label: '采购', icon: FileText, path: '/purchase-approvals' },
  { label: '我的', icon: User, path: '/profile' },
];

// 管理功能配置（根据权限动态生成，按职责分组）
function getManageConfig(auth: ReturnType<typeof useAuth>): ManageConfig {
  const standalone: NavItem[] = [];
  const groups: ManageGroup[] = [];

  if (auth.isTeacher) {
    standalone.push({ label: '采购审批', icon: ClipboardCheck, path: '/purchase-approvals/review' });
  }

  const reimbursementItems: NavItem[] = [];
  if (auth.isReimbursementApprover) {
    reimbursementItems.push({ label: '报销审批', icon: FileText, path: '/reimbursements/review' });
  }
  if (auth.isReimbursementApprover || auth.isSuppliesManager || auth.isChemicalsManager) {
    reimbursementItems.push({ label: '报销统计', icon: BarChart3, path: '/reimbursements/stats' });
  }
  if (reimbursementItems.length > 0) {
    groups.push({ label: '报销管理', colorScheme: 'yellow', items: reimbursementItems });
  }

  if (auth.isSuppliesManager) {
    groups.push({
      label: '耗材管理', colorScheme: 'blue',
      items: [
        { label: '申领审批', icon: ClipboardCheck, path: '/supplies/review' },
        { label: '库存管理', icon: Package, path: '/admin/supplies' },
        { label: '物资追踪', icon: Package, path: '/supplies/borrowings' },
        { label: '入库登记', icon: Package, path: '/purchases/registration' },
      ],
    });
  }

  if (auth.isChemicalsManager) {
    groups.push({
      label: '药品管理', colorScheme: 'purple',
      items: [
        { label: '药品库存', icon: FlaskConical, path: '/reagents' },
        { label: '补货管理', icon: AlertTriangle, path: '/reagents/warnings' },
        { label: '入库登记', icon: FlaskConical, path: '/purchases/registration' },
      ],
    });
  }

  if (auth.isAdmin) {
    groups.push({
      label: '系统管理', colorScheme: 'gray',
      items: [
        { label: '公告管理', icon: Bell, path: '/admin/announcements' },
        { label: '人员管理', icon: User, path: '/admin/members' },
        { label: '数据导出', icon: BarChart3, path: '/admin/export' },
        { label: '日常须知', icon: Bell, path: '/admin/daily-notices' },
      ],
    });
  }

  return { standalone, groups };
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { profile, signOut } = auth;
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showManagePanel, setShowManagePanel] = useState(false);

  const isStudent = profile?.role === 'student';
  const hasManagePermission = !isStudent;
  const manageConfig = hasManagePermission ? getManageConfig(auth) : { standalone: [], groups: [] };
  const hasManageItems = manageConfig.standalone.length > 0 || manageConfig.groups.length > 0;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  async function handleLogout() {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">
        <div className="h-16 flex items-center px-5 border-b border-gray-200 shrink-0">
          <FlaskConical className="w-7 h-7 text-blue-600 mr-2.5" />
          <span className="text-lg font-bold text-gray-900 tracking-tight">实验室管理</span>
        </div>

        {/* 使用导航 */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.label}
              </button>
            );
          })}

          {/* 管理入口（桌面侧边栏） */}
          {hasManagePermission && hasManageItems && (
            <>
              {manageConfig.standalone.length > 0 && (
                <>
                  <div className="pt-3 pb-1 px-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">审批</p>
                  </div>
                  {manageConfig.standalone.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          active ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <Icon className={`w-4.5 h-4.5 ${active ? 'text-green-500' : 'text-gray-400'}`} />
                        {item.label}
                      </button>
                    );
                  })}
                </>
              )}

              {manageConfig.groups.map((group) => {
                const colors = GROUP_COLORS[group.colorScheme];
                return (
                  <div key={group.label}>
                    <div className="pt-3 pb-1 px-1">
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${colors.label}`}>{group.label}</p>
                    </div>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <button
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                            active ? `${colors.activeBg} ${colors.activeText}` : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <Icon className={`w-4.5 h-4.5 ${active ? colors.iconText : 'text-gray-400'}`} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
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
            {/* 管理按钮 */}
            {hasManagePermission && hasManageItems && (
              <button
                onClick={() => setShowManagePanel(!showManagePanel)}
                className={`ml-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  showManagePanel
                    ? 'bg-orange-100 text-orange-700 border-orange-300'
                    : 'bg-orange-50 text-orange-600 border-orange-200'
                }`}
              >
                ⚙ 管理
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
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

        {/* Mobile 管理面板（从顶部展开） */}
        {showManagePanel && (
          <>
            <div className="md:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setShowManagePanel(false)} />
            <div className="md:hidden fixed top-14 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-lg animate-slide-up max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900">管理功能</p>
                <button onClick={() => setShowManagePanel(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 space-y-4">
                {manageConfig.standalone.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setShowManagePanel(false); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-sm font-semibold text-green-800">{item.label}</span>
                    </button>
                  );
                })}

                {manageConfig.groups.map((group) => {
                  const colors = GROUP_COLORS[group.colorScheme];
                  return (
                    <div key={group.label}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 px-0.5 ${colors.label}`}>
                        {group.label}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.path}
                              onClick={() => { navigate(item.path); setShowManagePanel(false); }}
                              className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border transition-colors ${colors.bg} ${colors.border} hover:opacity-80`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.iconBg}`}>
                                <Icon className={`w-4 h-4 ${colors.iconText}`} />
                              </div>
                              <span className={`text-[10px] font-medium ${colors.label} text-center leading-tight`}>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

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

      {/* Mobile Bottom Tab Bar（固定5个使用功能） */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => {
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

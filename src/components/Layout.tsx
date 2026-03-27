import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Package,
  FlaskConical,
  FileText,
  User,
  Settings,
  Bell,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: '首页', icon: Home, path: '/' },
  { label: '物资', icon: Package, path: '/supplies' },
  { label: '危化品', icon: FlaskConical, path: '/chemicals' },
  { label: '制度', icon: FileText, path: '/documents' },
  { label: '我的', icon: User, path: '/profile' },
  { label: '管理', icon: Settings, path: '/admin', adminOnly: true },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, isManager } = useAuth();

  const showAdmin = isAdmin || isManager;

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || showAdmin
  );

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-5 border-b border-gray-200 shrink-0">
          <FlaskConical className="w-7 h-7 text-blue-600 mr-2.5" />
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            实验室管理系统
          </span>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
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

        {/* Sidebar Footer - User Info */}
        <div className="p-4 border-t border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
              {profile?.name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profile?.name || '用户'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {profile?.role === 'admin'
                  ? '管理员'
                  : profile?.role === 'manager'
                    ? '负责人'
                    : '成员'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-60">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-20 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-blue-600" />
            <span className="text-base font-bold text-gray-900">
              实验室管理系统
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-1.5 text-gray-500 hover:text-gray-700 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
              {profile?.name?.charAt(0) || 'U'}
            </div>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex sticky top-0 z-20 h-16 bg-white border-b border-gray-200 items-center justify-end px-6">
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                {profile?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm font-medium text-gray-700">
                {profile?.name || '用户'}
              </span>
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
          {visibleItems.map((item) => {
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
                <span className="text-[10px] font-medium leading-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

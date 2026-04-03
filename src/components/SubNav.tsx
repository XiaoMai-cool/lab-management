import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export interface SubNavItem {
  to: string;
  label: string;
  exact?: boolean;
  /** Only show to users who can manage this module */
  managerModule?: string;
  /** Only show to admins */
  adminOnly?: boolean;
  /** Only show to teachers (including admin) */
  teacherOnly?: boolean;
}

interface SubNavProps {
  items: SubNavItem[];
}

export default function SubNav({ items }: SubNavProps) {
  const location = useLocation();
  const { isAdmin, isTeacher, canManageModule } = useAuth();

  const visibleItems = items.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.teacherOnly && !isTeacher) return false;
    if (item.managerModule && !canManageModule(item.managerModule)) return false;
    return true;
  });

  function isActive(item: SubNavItem) {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
      {visibleItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isActive(item)
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

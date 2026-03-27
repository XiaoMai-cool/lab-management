import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import type { Role } from '../lib/types';
import type { ReactNode } from 'react';

const ROLE_LEVEL: Record<Role, number> = {
  super_admin: 5,
  admin: 4,
  manager: 3,
  teacher: 2,
  student: 1,
};

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: Role;
  requiredModule?: string;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredModule,
}: ProtectedRouteProps) {
  const { user, profile, loading, canManageModule } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && profile) {
    const userLevel = ROLE_LEVEL[profile.role] ?? 0;
    const requiredLevel = ROLE_LEVEL[requiredRole] ?? 0;
    if (userLevel < requiredLevel) {
      return <Navigate to="/" replace />;
    }
  }

  if (requiredModule && !canManageModule(requiredModule)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

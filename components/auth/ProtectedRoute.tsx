import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { PermissionKey } from '../../lib/permissions';
import type { AppRole } from '../../types';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: AppRole[];
  requiredPermission?: PermissionKey;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, requiredPermission }) => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const { can, isLoading: permissionsLoading } = usePermissions();

  if (isLoading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-light-100 dark:bg-surface-dark-50">
        <Loader2 size={28} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission && !can(requiredPermission, 'visible')) {
    return <Navigate to="/" replace />;
  }

  return <>{children ?? <Outlet />}</>;
};

export default ProtectedRoute;

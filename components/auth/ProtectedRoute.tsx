import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { PERMISSION_DEFINITIONS, type PermissionKey } from '../../lib/permissions';
import type { AppRole } from '../../types';
import { useToast } from '../ui/ToastProvider';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: AppRole[];
  requiredPermission?: PermissionKey;
}

/** Leva a pessoa para uma tela que ela pode abrir e diz por quê, em vez de trocar de tela em silêncio. */
const AccessDeniedRedirect: React.FC<{ to: string; screenLabel?: string }> = ({ to, screenLabel }) => {
  const toast = useToast();
  useEffect(() => {
    toast.info(
      screenLabel
        ? `Seu perfil não tem acesso a ${screenLabel}. Peça a liberação a um administrador.`
        : 'Seu perfil não tem acesso a essa tela. Peça a liberação a um administrador.'
    );
    // Avisa uma vez por redirecionamento.
  }, []);
  return <Navigate to={to} replace />;
};

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

  const getAccessibleFallback = () => {
    if (can('dashboard', 'visible')) return '/';
    const first = PERMISSION_DEFINITIONS
      .filter((d) => d.routePrefixes.length > 0 && d.key !== 'dashboard' && can(d.key, 'visible'))
      .flatMap((d) => d.routePrefixes)[0];
    return first ?? '/login';
  };

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <AccessDeniedRedirect to={getAccessibleFallback()} />;
  }

  if (requiredPermission && !can(requiredPermission, 'visible')) {
    const screenLabel = PERMISSION_DEFINITIONS.find((d) => d.key === requiredPermission)?.label;
    return <AccessDeniedRedirect to={getAccessibleFallback()} screenLabel={screenLabel} />;
  }

  return <>{children ?? <Outlet />}</>;
};

export default ProtectedRoute;

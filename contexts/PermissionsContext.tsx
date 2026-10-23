import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import type { AppRole } from '../types';
import {
  buildDefaultPermissionMatrix,
  PERMISSION_DEFINITIONS,
  type PermissionAction,
  type PermissionKey,
  type PermissionMatrix,
} from '../lib/permissions';

type PermissionPatch = Partial<Record<PermissionAction, boolean>>;

type PermissionsContextType = {
  matrix: PermissionMatrix;
  isLoading: boolean;
  can: (key: PermissionKey, action?: PermissionAction) => boolean;
  updatePermission: (role: AppRole, key: PermissionKey, patch: PermissionPatch) => Promise<void>;
  refreshPermissions: () => Promise<void>;
};

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

const mergeRowsIntoMatrix = (
  rows: Array<{
    role: AppRole;
    permission_key: PermissionKey;
    is_visible: boolean;
    is_editable: boolean;
    is_deletable: boolean;
  }>
): PermissionMatrix => {
  const matrix = buildDefaultPermissionMatrix();

  for (const row of rows) {
    if (!matrix[row.role]?.[row.permission_key]) continue;
    matrix[row.role][row.permission_key] = {
      visible: !!row.is_visible,
      editable: !!row.is_editable,
      deletable: !!row.is_deletable,
    };
  }

  return matrix;
};

// Admin altera tudo; quem tem "Permissões e Privacidade" editável altera
// gerente e vendedor, nunca o admin (o banco aplica a mesma regra).
const assertCanEditRolePermissions = (
  role: AppRole | null,
  targetRole: AppRole,
  can: (key: PermissionKey, action?: PermissionAction) => boolean
) => {
  if (role === 'admin') return;
  if (!can('permissions_privacy', 'editable')) {
    throw new Error('Seu perfil não pode alterar permissões.');
  }
  if (targetRole === 'admin') {
    throw new Error('Somente admin pode alterar as permissões do admin.');
  }
};

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, isAuthenticated, isLoading: authLoading } = useAuth();
  const [matrix, setMatrix] = useState<PermissionMatrix>(() => buildDefaultPermissionMatrix());
  const [isLoading, setIsLoading] = useState(true);

  const refreshPermissions = useCallback(async () => {
    if (!isAuthenticated) {
      setMatrix(buildDefaultPermissionMatrix());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // A leitura da matriz é liberada para todos (RLS): carrega todos os papéis
      // para que a aba de permissões mostre o estado real a quem puder vê-la.
      const { data, error } = await supabase
        .from('app_role_permissions')
        .select('role, permission_key, is_visible, is_editable, is_deletable');
      if (error) throw error;

      const parsedRows = (data || []).map((row: any) => ({
        role: row.role as AppRole,
        permission_key: row.permission_key as PermissionKey,
        is_visible: !!row.is_visible,
        is_editable: !!row.is_editable,
        is_deletable: !!row.is_deletable,
      }));

      setMatrix(mergeRowsIntoMatrix(parsedRows));
    } catch (error) {
      console.error('Failed to load app permissions:', error);
      setMatrix(buildDefaultPermissionMatrix());
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    void refreshPermissions();
  }, [authLoading, refreshPermissions]);

  const can = useCallback(
    (key: PermissionKey, action: PermissionAction = 'visible') => {
      const safeRole: AppRole = role ?? 'seller';
      const entry = matrix[safeRole]?.[key];
      if (!entry) return false;
      return entry[action];
    },
    [matrix, role]
  );

  const updatePermission = useCallback(
    async (targetRole: AppRole, key: PermissionKey, patch: PermissionPatch) => {
      assertCanEditRolePermissions(role, targetRole, can);

      const definition = PERMISSION_DEFINITIONS.find((item) => item.key === key);
      if (!definition) {
        throw new Error('Permissao invalida.');
      }

      const current = matrix[targetRole]?.[key] || { visible: false, editable: false, deletable: false };
      const next = {
        visible: patch.visible ?? current.visible,
        editable: patch.editable ?? current.editable,
        deletable: patch.deletable ?? current.deletable,
      };

      const { error } = await supabase.from('app_role_permissions').upsert(
        {
          role: targetRole,
          permission_key: key,
          label: definition.label,
          is_visible: next.visible,
          is_editable: next.editable,
          is_deletable: next.deletable,
        },
        { onConflict: 'role,permission_key' }
      );

      if (error) throw error;

      setMatrix((prev) => ({
        ...prev,
        [targetRole]: {
          ...prev[targetRole],
          [key]: next,
        },
      }));
    },
    [matrix, role, can]
  );

  const value = useMemo<PermissionsContextType>(
    () => ({
      matrix,
      isLoading,
      can,
      updatePermission,
      refreshPermissions,
    }),
    [matrix, isLoading, can, updatePermission, refreshPermissions]
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within a PermissionsProvider');
  return ctx;
};

/** Igual a usePermissions, mas devolve null fora do provider (ex.: testes do DataProvider). */
export const useOptionalPermissions = () => useContext(PermissionsContext) ?? null;

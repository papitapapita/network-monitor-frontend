'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { UserAccountDTO } from '@/types/user.types';
import { useAuth } from '@/contexts/auth.context';
import { usePermissions } from '@/hooks/usePermissions';
import { isAdminRole } from '@/constants/roles';
import { ROLE_LABELS, ROLE_VARIANTS } from '@/constants/user.constants';
import { StatusPage } from '@/components/layout/StatusPage';
import { Badge, ConfirmModal, DataTable, EditIcon, ErrorBanner, IconButton, PageHeader, PlusIcon } from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';
import { UserFormModal } from '@/components/users/UserFormModal';
import { useToast } from '@/contexts/toast.context';

const USERS_QUERY_KEY = ['users'] as const;

function ShieldResetIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 10.5a2.5 2.5 0 114.2 1.8M14 14.5V12h-2.5" />
    </svg>
  );
}

const COLUMNS: DataTableColumn<UserAccountDTO>[] = [
  {
    key: 'email',
    header: 'Correo',
    cell: (u) => <span className="font-medium text-gray-900 dark:text-gray-100 wrap-anywhere">{u.email}</span>,
  },
  {
    key: 'role',
    header: 'Rol',
    cell: (u) => <Badge variant={ROLE_VARIANTS[u.role]}>{ROLE_LABELS[u.role]}</Badge>,
  },
  {
    key: 'status',
    header: 'Estado',
    cell: (u) =>
      u.disabled ? <Badge variant="neutral">Deshabilitado</Badge> : <Badge variant="success">Activo</Badge>,
  },
  {
    key: 'twoFactor',
    header: 'Verificación',
    className: 'hidden sm:table-cell',
    cell: (u) =>
      u.twoFactorEnabled ? (
        <Badge variant="success">Activa</Badge>
      ) : (
        <span title="La configura en su próximo inicio de sesión">
          <Badge variant="neutral">Sin configurar</Badge>
        </span>
      ),
  },
  {
    key: 'createdAt',
    header: 'Creado',
    className: 'hidden md:table-cell',
    cell: (u) => (
      <span className="text-sm text-gray-600 dark:text-gray-400">{new Date(u.createdAt).toLocaleDateString('es')}</span>
    ),
  },
];

/**
 * The install's staff accounts (IDN-140), for its administrators. Nobody edits
 * their own account here (IDN-143) nor the vendor's (IDN-141) — the backend
 * refuses both, so those rows carry no action.
 */
export default function UsersPage() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [editing, setEditing] = useState<UserAccountDTO | null | undefined>(undefined);
  const [resetting, setResetting] = useState<UserAccountDTO | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const canSee = isAdminRole(user?.role);
  const { data: users = [], isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const r = await apiService.listUsers();
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los usuarios');
      return r.data.users;
    },
    enabled: canSee,
  });

  if (!canSee) {
    return (
      <StatusPage
        icon={
          <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path strokeLinecap="round" d="M8 11V7a4 4 0 118 0v4" />
          </svg>
        }
        iconTone="amber"
        title="Solo para administradores"
        description="La gestión de usuarios está disponible para los administradores de la instalación."
        primaryAction={{ label: 'Volver al inicio', href: '/' }}
      />
    );
  }

  const editable = (u: UserAccountDTO) => permissions.isAdmin && u.id !== user?.id && u.role !== 'VENDOR';
  // IDN-172: never the vendor's, and an administrator's only by the vendor.
  const canResetTwoFactor = (u: UserAccountDTO) =>
    editable(u) && u.twoFactorEnabled && (u.role !== 'ADMIN' || user?.role === 'VENDOR');

  const resetTwoFactor = async () => {
    if (!resetting) return;
    setIsResetting(true);
    const result = await apiService.resetUserTwoFactor(resetting.id);
    setIsResetting(false);
    queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    if (!result.success) {
      showError(result.error || 'No se pudo restablecer la verificación');
    } else {
      showSuccess(`Verificación de ${resetting.email} restablecida. La configura de nuevo al iniciar sesión.`);
    }
    setResetting(null);
  };
  const active = users.filter((u) => !u.disabled).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {editing !== undefined && (
        <UserFormModal
          key={editing?.id ?? 'new'}
          user={editing}
          isOpen
          onClose={() => setEditing(undefined)}
          onSaved={(saved, invited) => {
            queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
            showSuccess(
              editing
                ? `Usuario ${saved.email} actualizado`
                : invited
                  ? `Invitación enviada a ${saved.email}`
                  : `Usuario ${saved.email} creado`,
            );
            setEditing(undefined);
          }}
        />
      )}

      <ConfirmModal
        isOpen={resetting !== null}
        onClose={() => setResetting(null)}
        onConfirm={resetTwoFactor}
        title="Restablecer verificación en dos pasos"
        message={`Para cuando ${resetting?.email ?? ''} perdió el teléfono y los códigos de recuperación. Se cierran todas sus sesiones, se olvidan los navegadores recordados y al entrar configurará la verificación de nuevo. El chat de la instalación recibe un aviso.`}
        confirmText="Restablecer"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isResetting}
      />

      <PageHeader
        title="Usuarios"
        subtitle={users.length > 0 ? `${active} ${active === 1 ? 'cuenta activa' : 'cuentas activas'}` : 'Cuentas del personal'}
        info="Cada persona entra con su propia cuenta y un código de su aplicación de autenticación. Un cambio de rol, contraseña o estado cierra sus sesiones abiertas. No se eliminan cuentas: se deshabilitan."
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={
          permissions.isAdmin && (
            <IconButton icon={<PlusIcon />} label="Nuevo usuario" variant="primary" size="md" onClick={() => setEditing(null)} />
          )
        }
      />

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      <DataTable
        columns={COLUMNS}
        rows={users}
        getRowId={(u) => u.id}
        getRowLabel={(u) => u.email}
        isLoading={isLoading}
        loadingMessage="Cargando usuarios..."
        emptyMessage="Sin usuarios."
        rowActions={(u) =>
          editable(u) ? (
            <div className="flex items-center gap-1">
              {canResetTwoFactor(u) && (
                <IconButton
                  icon={<ShieldResetIcon />}
                  label={`Restablecer verificación de ${u.email}`}
                  onClick={() => setResetting(u)}
                />
              )}
              <IconButton icon={<EditIcon />} label={`Editar ${u.email}`} onClick={() => setEditing(u)} />
            </div>
          ) : u.id === user?.id ? (
            <span className="text-xs text-gray-500 dark:text-gray-400">Tú</span>
          ) : null
        }
      />
    </div>
  );
}

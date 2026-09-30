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
import { Badge, DataTable, EditIcon, ErrorBanner, IconButton, PageHeader, PlusIcon } from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';
import { UserFormModal } from '@/components/users/UserFormModal';
import { useToast } from '@/contexts/toast.context';

const USERS_QUERY_KEY = ['users'] as const;

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
  const { showSuccess } = useToast();
  const [editing, setEditing] = useState<UserAccountDTO | null | undefined>(undefined);

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
  const active = users.filter((u) => !u.disabled).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {editing !== undefined && (
        <UserFormModal
          key={editing?.id ?? 'new'}
          user={editing}
          isOpen
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
            showSuccess(editing ? `Usuario ${saved.email} actualizado` : `Usuario ${saved.email} creado`);
            setEditing(undefined);
          }}
        />
      )}

      <PageHeader
        title="Usuarios"
        subtitle={users.length > 0 ? `${active} ${active === 1 ? 'cuenta activa' : 'cuentas activas'}` : 'Cuentas del personal'}
        info="Cada persona entra con su propia cuenta. Un cambio de rol, contraseña o estado cierra sus sesiones abiertas. No se eliminan cuentas: se deshabilitan."
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
            <IconButton icon={<EditIcon />} label={`Editar ${u.email}`} onClick={() => setEditing(u)} />
          ) : u.id === user?.id ? (
            <span className="text-xs text-gray-500 dark:text-gray-400">Tú</span>
          ) : null
        }
      />
    </div>
  );
}

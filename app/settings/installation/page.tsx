'use client';

import React from 'react';
import { useAuth } from '@/contexts/auth.context';
import { isVendorRole } from '@/constants/roles';
import { StatusPage } from '@/components/layout/StatusPage';
import { VendorSettingsForm } from '@/components/settings/VendorSettingsForm';

/**
 * The vendor's settings for this install (INS-028). Gated on the role alone,
 * not on `usePermissions().isVendor`: the route is exempt from the
 * subscription guard, and recording a payment on a lapsed install is exactly
 * what it is for.
 */
export default function VendorSettingsPage() {
  const { user } = useAuth();

  if (!isVendorRole(user?.role)) {
    return (
      <StatusPage
        icon={<span className="text-2xl font-semibold">403</span>}
        iconTone="amber"
        title="Solo para el proveedor"
        description="Esta configuración la administra el proveedor del sistema."
        primaryAction={{ label: 'Volver a Configuración', href: '/settings' }}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configuración del proveedor</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Suscripción, retención de datos e integraciones de esta instalación. Los cambios aplican sin reiniciar.
        </p>
      </div>
      <VendorSettingsForm />
    </div>
  );
}

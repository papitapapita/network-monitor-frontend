'use client';

import React, { useState } from 'react';
import { apiService } from '@/services/api.service';
import { useToast } from '@/contexts/toast.context';
import { DataPurgeResultDTO } from '@/types/user.types';
import { Button, ConfirmModal } from '@/components/ui';

/**
 * Runs the daily retention sweep now (NOT-131). A vendor maintenance action:
 * the settings page shows it to the vendor only, as the API asks.
 */
export function DataPurgeCard() {
  const { showError } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DataPurgeResultDTO | null>(null);

  const run = async () => {
    setIsRunning(true);
    const r = await apiService.purgeStaleData();
    setIsRunning(false);
    setConfirming(false);
    if (r.success && r.data) setResult(r.data);
    else showError(r.error || 'No se pudo depurar');
  };

  const rows: [string, number][] = result
    ? [
        ['Resultados de ping', result.pingResultsDeleted],
        ['Alertas resueltas', result.alertsDeleted],
        ['Lecturas inalámbricas', result.wirelessSnapshotsDeleted],
        ['Registros de alertas inalámbricas', result.wirelessAlertRecordsDeleted],
      ]
    : [];

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <ConfirmModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={run}
        title="Depurar datos antiguos"
        message="Borra ya lo que la limpieza diaria borraría esta noche: todo lo que supera el período de retención configurado. Las alertas abiertas no se tocan. No se puede deshacer."
        confirmText="Depurar ahora"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isRunning}
      />
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Mantenimiento (proveedor)</h2>
      </div>
      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Ejecuta ahora la depuración diaria de datos antiguos. Solo tú, como proveedor, ves esta opción.
        </p>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Depurar datos antiguos
        </Button>
        {result && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm" role="status">
            {rows.map(([label, count]) => (
              <React.Fragment key={label}>
                <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                <dd className="text-gray-900 dark:text-gray-100">{count.toLocaleString('es')} borrados</dd>
              </React.Fragment>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

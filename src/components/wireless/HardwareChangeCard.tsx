'use client';

import React, { useState } from 'react';
import { apiService } from '@/services/api.service';
import type { DeviceModelResponseDTO, VendorDTO } from '@/types/device.types';
import type { WirelessIdentitySuggestion } from '@/types/wireless.types';
import { Button, Card, LoadingSpinner, SectionTitle } from '@/components/ui';
import { InlineModelForm } from '@/components/devices/InlineModelForm';

/**
 * A reported MAC, serial or model that the backend says to accept as a new
 * box (`REPLACE`) or as another unit's hardware (`SWAP`), rather than as a
 * typo. Together they describe one change, so they share one card
 * (WLS-152/153; the serial for MikroTiks, DEV-215).
 */
export const isHardwareChange = (s: WirelessIdentitySuggestion) =>
  (s.field === 'macAddress' || s.field === 'serialNumber' || s.field === 'deviceModel') &&
  (s.actions[0] === 'REPLACE' || s.actions[0] === 'SWAP');

/** What a hardware change hands the replace modal. */
export interface ReplacePrefill {
  deviceModelId?: string;
  macAddress?: string;
  serialNumber?: string;
}

/** The device fields a hardware suggestion's `UPDATE` writes. */
export interface HardwarePatch {
  macAddress?: string;
  serialNumber?: string;
  deviceModelId?: string;
  /** A MikroTik's own name (its identity), DEV-216. */
  name?: string;
}

const WHY_REPLACE =
  'Cada registro es una unidad física y sus mediciones le pertenecen. Si cambió el equipo, regístralo como reemplazo para que el historial quede con la unidad que lo produjo, en vez de editar la MAC o el modelo.';

const FIELD_LABELS: Partial<Record<WirelessIdentitySuggestion['field'], string>> = {
  name: 'Nombre en el router',
  macAddress: 'Dirección MAC',
  serialNumber: 'Serie',
  deviceModel: 'Modelo',
};

/**
 * A reported model the catalog lacks: say so, and offer to add it in place.
 * AirOS radios are one vendor's, so with the device's own vendor known the
 * form locks it; without it the operator picks.
 */
export function MissingModelNote({
  reportedName,
  vendorSlug,
  wireless = true,
  canWrite,
  onCreated,
}: {
  reportedName: string;
  vendorSlug?: string | null;
  /** AirOS radios report models; a MikroTik's model is a router's. */
  wireless?: boolean;
  canWrite: boolean;
  onCreated: (model: DeviceModelResponseDTO) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [vendors, setVendors] = useState<VendorDTO[]>([]);

  const open = () => {
    setAdding(true);
    if (vendors.length === 0) {
      apiService.listVendors({ limit: 100 }).then((r) => {
        if (r.success && r.data) setVendors(r.data.vendors);
      });
    }
  };

  if (adding) {
    // The form reads its vendor once, so wait for the list rather than lock it late.
    return vendors.length === 0 ? (
      <LoadingSpinner size="sm" />
    ) : (
      <InlineModelForm
        vendors={vendors}
        lockedVendorId={vendors.find((v) => v.slug === vendorSlug)?.id}
        initialModelName={reportedName}
        defaultIsWireless={wireless}
        onCreated={(model) => {
          setAdding(false);
          onCreated(model);
        }}
        onCancel={() => setAdding(false)}
      />
    );
  }
  return (
    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
      «{reportedName}» no está en el catálogo de modelos.{' '}
      {canWrite && (
        <button type="button" className="font-medium underline cursor-pointer" onClick={open}>
          Agregar modelo
        </button>
      )}
    </p>
  );
}

interface Props {
  /** The device's `macAddress` and `deviceModel` suggestions; a MikroTik's may add `serialNumber` and `name`. */
  suggestions: WirelessIdentitySuggestion[];
  /** What reported it: a polled radio, or a MikroTik describing itself. */
  source?: 'RADIO' | 'ROUTER';
  /** Replaces the default title — the global list names the device here. */
  heading?: React.ReactNode;
  /** A quiet line under the description, e.g. when the radio was read. */
  meta?: React.ReactNode;
  vendorSlug?: string | null;
  canWrite: boolean;
  /** Absent when the operator may not, or the unit was already replaced: the card then only explains. */
  onReplace?: (prefill: ReplacePrefill) => void;
  onSwap?: (otherDeviceId: string) => void;
  /** A device PATCH; resolves once it lands, whatever the outcome. */
  onUpdate: (patch: HardwarePatch) => Promise<void>;
  onDismiss?: () => void;
  /** A model was added to the catalog for this radio — re-read the suggestions. */
  onModelCreated?: () => void;
}

/**
 * The radio reports another MAC and/or model. One card, one main action — the
 * first of the suggestions' `actions`: record the replacement, the swap with
 * the device that carries the reported MAC, or (on a unit never put in
 * service) just correct the record.
 */
export function HardwareChangeCard({
  suggestions,
  source = 'RADIO',
  heading,
  meta,
  vendorSlug,
  canWrite,
  onReplace,
  onSwap,
  onUpdate,
  onDismiss,
  onModelCreated,
}: Props) {
  // A model added here is usable at once, without waiting on the backend to re-match it.
  const [createdModelId, setCreatedModelId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<'all' | 'id' | 'name' | null>(null);

  const name = suggestions.find((s) => s.field === 'name');
  const mac = suggestions.find((s) => s.field === 'macAddress');
  const serial = suggestions.find((s) => s.field === 'serialNumber');
  const model = suggestions.find((s) => s.field === 'deviceModel');
  const swapSuggestion = suggestions.find((s) => s.actions[0] === 'SWAP');
  const swapWith = swapSuggestion?.swapWith ?? null;
  const primary = swapWith ? 'SWAP' : suggestions.some((s) => s.actions[0] === 'REPLACE') ? 'REPLACE' : 'UPDATE';
  const modelId = model ? model.suggestedValue ?? createdModelId : null;
  const missingModel = !!model && modelId === null;
  // A lone MAC or serial may still be a typo from when it was entered; a model change too rules that out.
  const lone = mac && serial ? null : (mac ?? serial);
  const idMayBeTypo = primary === 'REPLACE' && lone && !model && lone.actions.includes('UPDATE') ? lone : null;
  // A MikroTik's own name is only ever an UPDATE; beside a replacement it is offered on its own.
  const nameAlone = name && primary !== 'UPDATE' ? name : null;
  const router = source === 'ROUTER';

  const update = async (which: 'all' | 'id' | 'name') => {
    setUpdating(which);
    await onUpdate(
      which === 'name'
        ? { name: name!.suggestedValue! }
        : {
            ...(mac?.suggestedValue ? { macAddress: mac.suggestedValue } : {}),
            ...(serial?.suggestedValue ? { serialNumber: serial.suggestedValue } : {}),
            ...(which === 'all' && modelId ? { deviceModelId: modelId } : {}),
            ...(which === 'all' && name?.suggestedValue ? { name: name.suggestedValue } : {}),
          }
    );
    setUpdating(null);
  };

  const what = swapSuggestion?.field === 'serialNumber' ? 'la serie' : 'la MAC';
  const description =
    primary === 'SWAP'
      ? `${router ? 'El router' : 'La radio'} reporta ${what} registrada en «${swapWith!.name}»: parece que estos dos equipos cambiaron de lugar.`
      : primary === 'REPLACE'
        ? `${router ? 'El router reporta' : 'El último sondeo reporta'} un equipo distinto al registrado: probablemente se instaló otra unidad.`
        : name && !mac && !serial && !model
          ? 'El router se llama a sí mismo distinto que en la app.'
          : `${router ? 'El router reporta' : 'El último sondeo reporta'} otros datos para esta unidad, que aún no está en servicio: corrige el registro.`;

  return (
    <Card>
      <Card.Header>
        {/* A heading of its own means a list, whose page already explains. */}
        <SectionTitle info={heading ? undefined : WHY_REPLACE}>
          {heading ?? (primary === 'SWAP' ? 'Intercambio de equipo detectado' : 'Cambio de equipo detectado')}
        </SectionTitle>
      </Card.Header>
      <Card.Body>
        <p className="text-sm text-gray-700 dark:text-gray-300">{description}</p>
        {meta && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{meta}</p>}
        <dl className="mt-3 space-y-1 text-sm">
          {[name, mac, serial, model].map((s) =>
            s ? (
              <div key={s.field} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                <dt className="text-gray-500 dark:text-gray-400">{FIELD_LABELS[s.field]}</dt>
                <dd className="min-w-0 wrap-anywhere">
                  <span className="text-gray-400 dark:text-gray-500 line-through">
                    {s.currentLabel ?? s.currentValue ?? '—'}
                  </span>{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    → {s.suggestedLabel ?? s.suggestedValue}
                  </span>
                  {s.field === 'deviceModel' && missingModel && s.suggestedLabel && (
                    <MissingModelNote
                      reportedName={s.suggestedLabel}
                      vendorSlug={vendorSlug ?? (router ? 'mikrotik' : undefined)}
                      wireless={!router}
                      canWrite={canWrite}
                      onCreated={(m) => {
                        setCreatedModelId(m.id);
                        onModelCreated?.();
                      }}
                    />
                  )}
                </dd>
              </div>
            ) : null
          )}
        </dl>
        {canWrite && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {primary === 'SWAP' && onSwap && (
              <Button size="sm" onClick={() => onSwap(swapWith!.deviceId)} disabled={updating !== null}>
                Intercambiar con «{swapWith!.name}»
              </Button>
            )}
            {primary === 'REPLACE' && onReplace && (
              <Button
                size="sm"
                onClick={() =>
                  onReplace({
                    deviceModelId: modelId ?? undefined,
                    macAddress: mac?.suggestedValue ?? undefined,
                    serialNumber: serial?.suggestedValue ?? undefined,
                  })
                }
                disabled={updating !== null}
              >
                Registrar reemplazo
              </Button>
            )}
            {primary === 'UPDATE' && (
              <Button
                size="sm"
                onClick={() => update('all')}
                isLoading={updating === 'all'}
                disabled={updating !== null || missingModel}
              >
                Aplicar
              </Button>
            )}
            {idMayBeTypo && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => update('id')}
                isLoading={updating === 'id'}
                disabled={updating !== null}
              >
                {idMayBeTypo.field === 'serialNumber' ? 'Solo corregir la serie' : 'Solo corregir la MAC'}
              </Button>
            )}
            {nameAlone?.suggestedValue && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => update('name')}
                isLoading={updating === 'name'}
                disabled={updating !== null}
              >
                Usar el nombre «{nameAlone.suggestedValue}»
              </Button>
            )}
            {onDismiss && (
              <Button size="sm" variant="outline" onClick={onDismiss} disabled={updating !== null}>
                Descartar
              </Button>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

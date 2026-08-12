'use client';

import React from 'react';
import { Input } from '@/components/ui';
import { TicketAddressDTO, TicketAddressInput } from '@/types/ticket.types';

/** The address as the forms hold it — all strings, like every other form here. */
export interface AddressForm {
  street: string;
  municipality: string;
  neighborhood: string;
  reference: string;
  latitude: string;
  longitude: string;
}

export const emptyAddressForm = (): AddressForm => ({
  street: '',
  municipality: '',
  neighborhood: '',
  reference: '',
  latitude: '',
  longitude: '',
});

export const addressFormFrom = (address: TicketAddressDTO | null): AddressForm =>
  address
    ? {
        street: address.street,
        municipality: address.municipality,
        neighborhood: address.neighborhood,
        reference: address.reference ?? '',
        latitude: address.latitude?.toString() ?? '',
        longitude: address.longitude?.toString() ?? '',
      }
    : emptyAddressForm();

const filled = (form: AddressForm): string[] =>
  [form.street, form.municipality, form.neighborhood].filter((v) => v.trim());

/** True once the operator has begun writing an address at all. */
export const hasAddress = (form: AddressForm): boolean => filled(form).length > 0;

/**
 * The three parts travel together or not at all, and the coordinates are their
 * own pair. Both rules are the backend's; checking here means the operator
 * learns them at the field instead of from a rejected submit.
 */
export function validateAddress(form: AddressForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const parts = filled(form);

  if (parts.length > 0 && parts.length < 3) {
    if (!form.street.trim()) errors.street = 'Una dirección necesita calle, municipio y barrio';
    if (!form.municipality.trim())
      errors.municipality = 'Una dirección necesita calle, municipio y barrio';
    if (!form.neighborhood.trim())
      errors.neighborhood = 'Una dirección necesita calle, municipio y barrio';
  }

  const lat = form.latitude.trim();
  const lng = form.longitude.trim();
  if (!!lat !== !!lng) {
    const message = 'La latitud y la longitud van juntas';
    if (!lat) errors.latitude = message;
    else errors.longitude = message;
  }
  if (lat && (Number.isNaN(Number(lat)) || Number(lat) < -90 || Number(lat) > 90)) {
    errors.latitude = 'La latitud debe estar entre -90 y 90';
  }
  if (lng && (Number.isNaN(Number(lng)) || Number(lng) < -180 || Number(lng) > 180)) {
    errors.longitude = 'La longitud debe estar entre -180 y 180';
  }

  return errors;
}

/** The DTO fragment, or `null` when the operator left the block empty. */
export function addressPayload(form: AddressForm): TicketAddressInput | null {
  if (!hasAddress(form)) return null;
  return {
    street: form.street.trim(),
    municipality: form.municipality.trim(),
    neighborhood: form.neighborhood.trim(),
    reference: form.reference.trim() || null,
    latitude: form.latitude.trim() ? Number(form.latitude) : null,
    longitude: form.longitude.trim() ? Number(form.longitude) : null,
  };
}

interface TicketAddressFieldsProps {
  form: AddressForm;
  errors: Record<string, string>;
  onChange: (field: keyof AddressForm, value: string) => void;
}

export function TicketAddressFields({ form, errors, onChange }: TicketAddressFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Input
            label="Calle"
            name="street"
            value={form.street}
            onChange={(e) => onChange('street', e.target.value)}
            error={errors.street}
            maxLength={255}
            placeholder="Cra 12 #4-55"
            fullWidth
          />
        </div>
        <Input
          label="Municipio"
          name="municipality"
          value={form.municipality}
          onChange={(e) => onChange('municipality', e.target.value)}
          error={errors.municipality}
          maxLength={100}
          fullWidth
        />
        <Input
          label="Barrio"
          name="neighborhood"
          value={form.neighborhood}
          onChange={(e) => onChange('neighborhood', e.target.value)}
          error={errors.neighborhood}
          maxLength={150}
          fullWidth
        />
        <div className="md:col-span-2">
          <Input
            label="Referencia"
            name="reference"
            value={form.reference}
            onChange={(e) => onChange('reference', e.target.value)}
            error={errors.reference}
            maxLength={255}
            placeholder="casa azul, portón negro"
            fullWidth
          />
        </div>
        <Input
          label="Latitud"
          name="latitude"
          value={form.latitude}
          onChange={(e) => onChange('latitude', e.target.value)}
          error={errors.latitude}
          placeholder="6.3373"
          fullWidth
        />
        <Input
          label="Longitud"
          name="longitude"
          value={form.longitude}
          onChange={(e) => onChange('longitude', e.target.value)}
          error={errors.longitude}
          placeholder="-75.5581"
          fullWidth
        />
      </div>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        La dirección se copia al ticket y no se vuelve a consultar: es el único lugar del sistema
        donde vive la dirección de una visita, y un ticket cerrado conserva la dirección donde
        realmente se trabajó aunque el cliente se mude.
      </p>
    </>
  );
}

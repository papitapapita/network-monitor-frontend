'use client';

import React from 'react';
import { Input } from '@/components/ui';
import { TicketContactDTO, TicketContactInput } from '@/types/ticket.types';

/** The on-site contact as the forms hold it. */
export interface ContactForm {
  contactName: string;
  contactPhone: string;
}

export const emptyContactForm = (): ContactForm => ({ contactName: '', contactPhone: '' });

export const contactFormFrom = (contact: TicketContactDTO | null): ContactForm => ({
  contactName: contact?.name ?? '',
  contactPhone: contact?.phone ?? '',
});

/** The backend strips spaces, dashes, dots and parentheses, then wants 7–15 digits. */
const phoneDigits = (phone: string) => phone.trim().replace(/[\s\-.()]/g, '');

/** Mirrors the backend: a phone needs a name, and must be 7–15 digits. */
export function validateContact(form: ContactForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const phone = phoneDigits(form.contactPhone);
  if (phone && !form.contactName.trim()) {
    errors.contactName = 'Un teléfono de contacto necesita un nombre';
  }
  if (phone && !/^\+?\d{7,15}$/.test(phone)) {
    errors.contactPhone = 'El teléfono debe tener entre 7 y 15 dígitos';
  }
  return errors;
}

/** The DTO fragment, or `null` when the operator left the contact empty. */
export function contactPayload(form: ContactForm): TicketContactInput | null {
  const name = form.contactName.trim();
  if (!name) return null;
  const phone = phoneDigits(form.contactPhone);
  return { name, phone: phone || null };
}

interface TicketContactFieldsProps {
  form: ContactForm;
  errors: Record<string, string>;
  onChange: (field: keyof ContactForm, value: string) => void;
}

/**
 * Who to ask for on site — typically a prospect with no customer record yet.
 * Kept on the ticket as written, even after a customer is linked.
 */
export function TicketContactFields({ form, errors, onChange }: TicketContactFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Input
        label="Contacto en sitio"
        name="contactName"
        value={form.contactName}
        onChange={(e) => onChange('contactName', e.target.value)}
        error={errors.contactName}
        maxLength={150}
        placeholder="Nombre de quien atiende"
        fullWidth
      />
      <Input
        label="Teléfono del contacto"
        name="contactPhone"
        type="tel"
        value={form.contactPhone}
        onChange={(e) => onChange('contactPhone', e.target.value)}
        error={errors.contactPhone}
        maxLength={20}
        placeholder="300 123 4567"
        fullWidth
      />
    </div>
  );
}

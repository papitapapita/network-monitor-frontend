'use client';

import { useEffect } from 'react';
import { StatusPage } from '@/components/layout/StatusPage';

function WarningIcon() {
  return (
    <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5l9.5 16.5H2.5L12 3.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v4" />
      <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code="500"
      icon={<WarningIcon />}
      iconTone="amber"
      title="Algo salió mal"
      description="Ocurrió un error inesperado al cargar esta página. Puedes intentarlo de nuevo o volver al inicio."
      primaryAction={{ label: 'Reintentar', onClick: reset }}
      secondaryAction={{ label: 'Volver al inicio', href: '/' }}
    />
  );
}

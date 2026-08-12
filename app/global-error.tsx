'use client';

import { useEffect } from 'react';
import { StatusPage } from '@/components/layout/StatusPage';
import './globals.css';

function CriticalIcon() {
  return (
    <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5l9.5 16.5H2.5L12 3.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v4" />
      <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Replaces the root layout entirely when it fails to render, so it defines its own
 * html/body and re-imports globals.css (app/layout.tsx is not rendered in this path).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    const saved = localStorage.getItem('theme');
    document.documentElement.classList.toggle('dark', saved === 'dark');
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-white dark:bg-gray-900">
        <StatusPage
          icon={<CriticalIcon />}
          iconTone="red"
          fullScreen
          title="La aplicación encontró un error crítico"
          description="No pudimos recuperar la aplicación automáticamente. Intenta recargar la página; si el problema persiste, contacta al administrador."
          primaryAction={{ label: 'Recargar', onClick: reset }}
        />
      </body>
    </html>
  );
}

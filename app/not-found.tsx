'use client';

import { useRouter } from 'next/navigation';
import { StatusPage } from '@/components/layout/StatusPage';

function DisconnectedNodesIcon() {
  return (
    <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path strokeLinecap="round" strokeDasharray="1 3" d="M9 9l6 6" />
      <path strokeLinecap="round" d="M14 5l4 4m0-4l-4 4" />
    </svg>
  );
}

export default function NotFound() {
  const router = useRouter();

  return (
    <StatusPage
      code="404"
      icon={<DisconnectedNodesIcon />}
      title="Página no encontrada"
      description="La página que buscas no existe o fue movida. Verifica la dirección o vuelve al panel principal."
      primaryAction={{ label: 'Volver al inicio', href: '/' }}
      secondaryAction={{ label: 'Volver atrás', onClick: () => router.back() }}
    />
  );
}

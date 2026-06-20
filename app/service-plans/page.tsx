'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { ServicePlanDTO } from '@/types/customer.types';
import { Table, TableEmptyState, Pagination, Button, LoadingSpinner, Input, Badge } from '@/components/ui';

const LIMIT = 20;

async function fetchAllPlans(): Promise<ServicePlanDTO[]> {
  const all: ServicePlanDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listServicePlans({ limit: 100, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar planes');
    all.push(...r.data.servicePlans);
    hasMore = r.data.hasMore;
    offset += 100;
  }
  return all;
}

function fmtPrice(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function ServicePlansContent() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: all = [], isLoading, error, refetch } = useQuery({
    queryKey: ['servicePlans'],
    queryFn: fetchAllPlans,
  });

  const filtered = search
    ? all.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : all;

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paginated = filtered.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Planes de Servicio</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {all.length > 0 ? `${all.length} ${all.length === 1 ? 'plan' : 'planes'} en total` : 'Administra los planes de internet'}
          </p>
        </div>
        <Button onClick={() => router.push('/service-plans/create')}>Agregar Plan</Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Buscar" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Nombre del plan..." fullWidth />
          <div className="flex items-end">
            <Button variant="outline" fullWidth onClick={() => { setSearch(''); setCurrentPage(1); }} disabled={!search}>Limpiar</Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{(error as Error).message}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">Reintentar</Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" message="Cargando planes..." /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Head>Nombre</Table.Head>
              <Table.Head>Velocidad</Table.Head>
              <Table.Head>Precio/mes</Table.Head>
              <Table.Head>Estado</Table.Head>
              <Table.Head>Acciones</Table.Head>
            </Table.Header>
            <Table.Body>
              {paginated.length === 0 ? (
                <TableEmptyState message={search ? 'Ningún plan coincide con la búsqueda' : 'Sin planes. Agrega el primero para comenzar.'} />
              ) : (
                paginated.map((p) => (
                  <Table.Row key={p.id} onClick={() => router.push(`/service-plans/${p.id}`)}>
                    <Table.Cell>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
                      {p.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{p.description}</div>}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{p.downloadMbps}↓ / {p.uploadMbps}↑ Mbps</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-900 dark:text-gray-100">{fmtPrice(p.monthlyPrice)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Activo' : 'Inactivo'}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); router.push(`/service-plans/${p.id}`); }}>Ver</Button>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
          {filtered.length > LIMIT && (
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} itemsPerPage={LIMIT} onPageChange={setCurrentPage} />
          )}
        </div>
      )}
    </div>
  );
}

export default function ServicePlansPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <ServicePlansContent />
    </Suspense>
  );
}

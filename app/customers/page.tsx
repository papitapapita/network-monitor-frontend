'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CustomerDTO } from '@/types/customer.types';
import { Table, TableEmptyState, Pagination, Button, LoadingSpinner, Input } from '@/components/ui';

const LIMIT = 20;

async function fetchAllCustomers(): Promise<CustomerDTO[]> {
  const all: CustomerDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listCustomers({ limit: 100, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar clientes');
    all.push(...r.data.customers);
    hasMore = r.data.hasMore;
    offset += 100;
  }
  return all;
}

function CustomersPageContent() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: all = [], isLoading, error, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchAllCustomers,
  });

  const filtered = search
    ? all.filter((c) =>
        c.fullName.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.cedula ?? '').includes(search)
      )
    : all;

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paginated = filtered.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Clientes</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {all.length > 0 ? `${all.length} ${all.length === 1 ? 'cliente' : 'clientes'} en total` : 'Administra los clientes del servicio'}
          </p>
        </div>
        <Button onClick={() => router.push('/customers/create')}>Agregar Cliente</Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Buscar"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Nombre, teléfono, email o cédula..."
            fullWidth
          />
          <div className="flex items-end">
            <Button variant="outline" fullWidth onClick={() => { setSearch(''); setCurrentPage(1); }} disabled={!search}>
              Limpiar
            </Button>
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
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" message="Cargando clientes..." /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Head>Nombre</Table.Head>
              <Table.Head>Teléfono</Table.Head>
              <Table.Head>Email</Table.Head>
              <Table.Head>Cédula</Table.Head>
              <Table.Head>Acciones</Table.Head>
            </Table.Header>
            <Table.Body>
              {paginated.length === 0 ? (
                <TableEmptyState message={search ? 'Ningún cliente coincide con la búsqueda' : 'Sin clientes. Agrega el primero para comenzar.'} />
              ) : (
                paginated.map((c) => (
                  <Table.Row key={c.id} onClick={() => router.push(`/customers/${c.id}`)}>
                    <Table.Cell>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{c.fullName}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{c.phone}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">{c.email ?? '—'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{c.cedula ?? '—'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); router.push(`/customers/${c.id}`); }}>
                        Ver
                      </Button>
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

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <CustomersPageContent />
    </Suspense>
  );
}

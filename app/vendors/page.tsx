'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { VendorDTO } from '@/types/device.types';
import {
  Table,
  TableEmptyState,
  Pagination,
  Button,
  LoadingSpinner,
  Input,
} from '@/components/ui';

const LIMIT = 20;

async function fetchAllVendors(): Promise<VendorDTO[]> {
  const batches: VendorDTO[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await apiService.listVendors({ limit: 100, offset });
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Error al cargar fabricantes');
    }
    batches.push(...result.data.vendors);
    hasMore = result.data.hasMore;
    offset += 100;
  }

  return batches;
}

function VendorsPageContent() {
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data: allVendors = [], isLoading, error, refetch } = useQuery({
    queryKey: ['vendors'],
    queryFn: fetchAllVendors,
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const searched = search
    ? allVendors.filter((v) =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.slug.toLowerCase().includes(search.toLowerCase())
      )
    : allVendors;

  const sorted = sortField
    ? [...searched].sort((a, b) => {
        let aVal = '';
        let bVal = '';
        if (sortField === 'name') { aVal = a.name; bVal = b.name; }
        else if (sortField === 'slug') { aVal = a.slug; bVal = b.slug; }
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      })
    : searched;

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / LIMIT));
  const paginated = sorted.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  const countLabel = allVendors.length > 0
    ? `${allVendors.length} ${allVendors.length === 1 ? 'fabricante' : 'fabricantes'} en total`
    : 'Administra los fabricantes de dispositivos';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Fabricantees</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{countLabel}</p>
        </div>
        <Button onClick={() => router.push('/vendors/create')}>Agregar Fabricante</Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Buscar"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Nombre o slug..."
            fullWidth
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              fullWidth
              onClick={() => { setSearch(''); setCurrentPage(1); }}
              disabled={!search}
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{(error as Error).message}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" message="Cargando fabricantes..." />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Head
                sortable
                onSort={() => handleSort('name')}
                sortDirection={sortField === 'name' ? sortDirection : null}
              >
                Nombre
              </Table.Head>
              <Table.Head
                sortable
                onSort={() => handleSort('slug')}
                sortDirection={sortField === 'slug' ? sortDirection : null}
              >
                Slug
              </Table.Head>
              <Table.Head>Descripción</Table.Head>
              <Table.Head>Acciones</Table.Head>
            </Table.Header>
            <Table.Body>
              {paginated.length === 0 ? (
                <TableEmptyState
                  message={
                    search
                      ? 'Ningún fabricante coincide con la búsqueda'
                      : 'Sin fabricantes. Agrega el primero para comenzar.'
                  }
                />
              ) : (
                paginated.map((vendor) => (
                  <Table.Row
                    key={vendor.id}
                    onClick={() => router.push(`/vendors/${vendor.id}`)}
                  >
                    <Table.Cell>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{vendor.name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{vendor.slug}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">
                        {vendor.description ?? <span className="italic text-gray-400 dark:text-gray-600">—</span>}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/vendors/${vendor.id}`);
                        }}
                      >
                        Ver
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>

          {totalFiltered > LIMIT && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalFiltered}
              itemsPerPage={LIMIT}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function VendorsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><span>Cargando...</span></div>}>
      <VendorsPageContent />
    </Suspense>
  );
}

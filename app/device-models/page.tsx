'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { DeviceModelResponseDTO, DeviceType } from '@/types/device.types';
import {
  Table,
  TableEmptyState,
  Pagination,
  Button,
  Badge,
  LoadingSpinner,
  Select,
  Input,
} from '@/components/ui';

const LIMIT = 20;

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  ANTENNA: 'Antena',
  OTHER: 'Otro',
  RADIO: 'Radio',
  ROUTER: 'Router',
  ROUTERBOARD: 'RouterBoard',
  SERVER: 'Servidor',
  SWITCH: 'Switch',
};

function DeviceModelsPageContent() {
  const router = useRouter();

  const [models, setModels] = useState<DeviceModelResponseDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalModels, setTotalModels] = useState(0);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await apiService.listDeviceModels({
      limit: LIMIT,
      offset: (currentPage - 1) * LIMIT,
    });
    if (!result.success || !result.data) {
      setError(result.error || 'Error al cargar modelos');
      setIsLoading(false);
      return;
    }
    setModels(result.data.deviceModels);
    setTotalModels(result.data.total);
    setTotalPages(Math.max(1, Math.ceil(result.data.total / LIMIT)));
    setIsLoading(false);
  }, [currentPage]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setCurrentPage(1);
  };

  const hasFilters = search || typeFilter;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filtered = typeFilter
    ? models.filter((m) => m.deviceType === typeFilter)
    : models;

  const searched = search
    ? filtered.filter((m) =>
        m.model.toLowerCase().includes(search.toLowerCase()) ||
        m.vendorName.toLowerCase().includes(search.toLowerCase())
      )
    : filtered;

  const sorted = sortField
    ? [...searched].sort((a, b) => {
        let aVal = '';
        let bVal = '';
        if (sortField === 'model') { aVal = a.model; bVal = b.model; }
        else if (sortField === 'vendor') { aVal = a.vendorName; bVal = b.vendorName; }
        else if (sortField === 'type') { aVal = a.deviceType; bVal = b.deviceType; }
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      })
    : searched;

  const countLabel = totalModels > 0
    ? `${totalModels} ${totalModels === 1 ? 'modelo' : 'modelos'} en total`
    : 'Administra los modelos de dispositivos';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Modelos de Dispositivo</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{countLabel}</p>
        </div>
        <Button onClick={() => router.push('/device-models/create')}>Agregar Modelo</Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Buscar"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Proveedor o modelo..."
            fullWidth
          />
          <Select
            label="Tipo de Dispositivo"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'Todos los Tipos' },
              { value: 'ANTENNA', label: 'Antena' },
              { value: 'OTHER', label: 'Otro' },
              { value: 'RADIO', label: 'Radio' },
              { value: 'ROUTER', label: 'Router' },
              { value: 'ROUTERBOARD', label: 'RouterBoard' },
              { value: 'SERVER', label: 'Servidor' },
              { value: 'SWITCH', label: 'Switch' },
            ]}
            fullWidth
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              fullWidth
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchModels} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" message="Cargando modelos..." />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Head
                sortable
                onSort={() => handleSort('vendor')}
                sortDirection={sortField === 'vendor' ? sortDirection : null}
              >
                Proveedor
              </Table.Head>
              <Table.Head
                sortable
                onSort={() => handleSort('model')}
                sortDirection={sortField === 'model' ? sortDirection : null}
              >
                Modelo
              </Table.Head>
              <Table.Head
                sortable
                onSort={() => handleSort('type')}
                sortDirection={sortField === 'type' ? sortDirection : null}
              >
                Tipo
              </Table.Head>
              <Table.Head>Acciones</Table.Head>
            </Table.Header>
            <Table.Body>
              {sorted.length === 0 ? (
                <TableEmptyState
                  message={
                    hasFilters
                      ? 'Ningún modelo coincide con los filtros'
                      : 'Sin modelos. Agrega el primero para comenzar.'
                  }
                />
              ) : (
                sorted.map((model) => (
                  <Table.Row
                    key={model.id}
                    onClick={() => router.push(`/device-models/${model.id}`)}
                  >
                    <Table.Cell>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{model.vendorName}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-900 dark:text-gray-100">{model.model}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="info">
                        {DEVICE_TYPE_LABELS[model.deviceType] ?? model.deviceType}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/device-models/${model.id}`);
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

          {models.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalModels}
              itemsPerPage={LIMIT}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function DeviceModelsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><span>Cargando...</span></div>}>
      <DeviceModelsPageContent />
    </Suspense>
  );
}

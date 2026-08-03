'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, TableEmptyState } from './Table';
import { SelectCheckbox } from './SelectCheckbox';
import { Pagination } from './Pagination';
import { LoadingSpinner } from './LoadingSpinner';
import { ConfirmModal } from './Modal';
import { ErrorBanner } from './ErrorBanner';
import { ApiResponse } from '@/types/common.types';
import { BulkDeleteProgress, runBulkDelete } from '@/services/bulk-delete';

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  /** Identifies the column and doubles as the sort field. */
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Providing this makes the column sortable and lets `sortRows` order it. */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Marks a column sortable when the page sorts the rows itself. */
  sortable?: boolean;
  /** Responsive/utility classes applied to the header *and* the body cells. */
  className?: string;
  headClassName?: string;
  cellClassName?: string;
}

export interface TableSort {
  field: string | null;
  direction: SortDirection;
  onSort: (field: string) => void;
}

/** Grammatical info needed to word the selection bar and confirmation in Spanish. */
export interface EntityNoun {
  singular: string;
  plural: string;
  gender?: 'm' | 'f';
}

export interface BulkDeleteConfig<T> {
  /** Deletes a single row; DataTable fans out over the selection and aggregates the results. */
  deleteOne: (id: string) => Promise<ApiResponse<void>>;
  /** Runs once the batch settles, so the page can refetch. */
  onFinished?: () => void | Promise<void>;
  entity: EntityNoun;
  /** Rows failing this cannot be selected (e.g. alerts that are still open). */
  canDelete?: (row: T) => boolean;
  /** Tooltip explaining why a blocked row cannot be selected. */
  blockedHint?: string;
}

export interface DataTablePagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (size: number) => void;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Used for the checkbox's accessible name. */
  getRowLabel?: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Trailing "Acciones" column. Clicks inside it never reach `onRowClick`. */
  rowActions?: (row: T) => React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  emptyMessage: string;
  sort?: TableSort;
  /** Enables row selection and the bulk-delete bar. */
  bulkDelete?: BulkDeleteConfig<T>;
  /** Selection is cleared whenever this value changes (page, filters, …). */
  selectionResetKey?: unknown;
  pagination?: DataTablePagination;
}

/** Sorts rows using the matching column's `sortValue`. Empty values always sort last. */
export function sortRows<T>(
  rows: T[],
  columns: DataTableColumn<T>[],
  field: string | null,
  direction: SortDirection
): T[] {
  if (!field) return rows;
  const sortValue = columns.find((c) => c.key === field)?.sortValue;
  if (!sortValue) return rows;

  return [...rows].sort((a, b) => {
    const aVal = sortValue(a);
    const bVal = sortValue(b);
    const aEmpty = aVal === null || aVal === undefined || aVal === '';
    const bEmpty = bVal === null || bVal === undefined || bVal === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    const cmp =
      typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), 'es', { sensitivity: 'base' });
    return direction === 'asc' ? cmp : -cmp;
  });
}

/** Sort state for a DataTable: clicking the active column flips direction. */
export function useTableSort(options?: {
  initialField?: string | null;
  initialDirection?: SortDirection;
  /** Called after every sort change — typically to reset pagination. */
  onChange?: () => void;
}): TableSort {
  const [field, setField] = useState<string | null>(options?.initialField ?? null);
  const [direction, setDirection] = useState<SortDirection>(options?.initialDirection ?? 'asc');
  const onChange = options?.onChange;

  const onSort = useCallback(
    (next: string) => {
      if (field === next) {
        setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setField(next);
        setDirection('asc');
      }
      onChange?.();
    },
    [field, onChange]
  );

  return useMemo(() => ({ field, direction, onSort }), [field, direction, onSort]);
}

function countLabel(n: number, entity: EntityNoun): string {
  return `${n} ${n === 1 ? entity.singular : entity.plural}`;
}

/** What the confirmation says once the batch is running, including any rate-limit wait. */
function progressMessage(progress: BulkDeleteProgress, entity: EntityNoun): string {
  const { done, total, retryAt } = progress;
  const head = `Eliminando ${done} de ${countLabel(total, entity)}...`;
  if (retryAt === null) return head;
  const seconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
  return `${head} El servidor limitó el ritmo de eliminación; se reanuda en ${seconds} s.`;
}

function selectedLabel(n: number, entity: EntityNoun): string {
  const suffix = entity.gender === 'f' ? 'seleccionada' : 'seleccionado';
  return `${n} ${suffix}${n === 1 ? '' : 's'}`;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  getRowLabel,
  onRowClick,
  rowActions,
  isLoading = false,
  loadingMessage = 'Cargando...',
  emptyMessage,
  sort,
  bulkDelete,
  selectionResetKey,
  pagination,
}: DataTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState<BulkDeleteProgress | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds(new Set());
    setShowConfirm(false);
  }, [selectionResetKey]);

  const canDelete = bulkDelete?.canDelete;
  const selectableRows = useMemo(
    () => (canDelete ? rows.filter(canDelete) : rows),
    [rows, canDelete]
  );
  const selectableIds = useMemo(
    () => selectableRows.map(getRowId),
    [selectableRows, getRowId]
  );

  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && selectableIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      selectableIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!bulkDelete) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsDeleting(true);
    setDeleteError(null);
    setProgress({ done: 0, total: ids.length, retryAt: null });
    try {
      const { deleted, failed, rateLimited } = await runBulkDelete(
        ids,
        bulkDelete.deleteOne,
        setProgress
      );

      if (failed.length === 0) {
        setSelectedIds(new Set());
      } else {
        // A run stopped by the rate limit is not a per-row failure: say what is
        // left and that waiting fixes it, rather than repeating the 429 prose.
        const throttleNote = `Quedan ${countLabel(rateLimited.length, bulkDelete.entity)} sin eliminar por el límite de solicitudes del servidor. Espera un minuto y vuelve a intentarlo — la selección se conservó.`;
        const allRateLimited = rateLimited.length === failed.length;
        setDeleteError(
          deleted === 0
            ? allRateLimited
              ? throttleNote
              : failed[0].error
            : `Se eliminaron ${countLabel(deleted, bulkDelete.entity)} de ${ids.length}. ${
                allRateLimited ? throttleNote : `Error: ${failed[0].error}`
              }`
        );
        // Keep only the rows that could not be deleted selected.
        setSelectedIds(new Set(failed.map((f) => f.id)));
      }
    } catch {
      setDeleteError(`Error al eliminar ${bulkDelete.entity.plural}`);
    } finally {
      setShowConfirm(false);
      setIsDeleting(false);
      setProgress(null);
      await bulkDelete.onFinished?.();
    }
  };

  const selectionEnabled = !!bulkDelete;
  const selectedCount = selectedIds.size;

  return (
    <>
      {deleteError && (
        <ErrorBanner
          message={deleteError}
          onDismiss={() => setDeleteError(null)}
          className="mb-3"
        />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" message={loadingMessage} />
          </div>
        ) : (
          <>
            <Table>
              <Table.Header>
                {selectionEnabled && (
                  <Table.Head className="w-10 pl-4 pr-0">
                    <SelectCheckbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleAll}
                      disabled={selectableIds.length === 0}
                      label="Seleccionar todo"
                    />
                  </Table.Head>
                )}
                {columns.map((col) => {
                  const sortable = !!sort && (col.sortable ?? !!col.sortValue);
                  return (
                    <Table.Head
                      key={col.key}
                      sortable={sortable}
                      onSort={sortable ? () => sort!.onSort(col.key) : undefined}
                      sortDirection={sort?.field === col.key ? sort.direction : null}
                      className={`${col.className ?? ''} ${col.headClassName ?? ''}`}
                    >
                      {col.header}
                    </Table.Head>
                  );
                })}
                {rowActions && <Table.Head>Acciones</Table.Head>}
              </Table.Header>

              <Table.Body>
                {rows.length === 0 ? (
                  <TableEmptyState message={emptyMessage} />
                ) : (
                  rows.map((row) => {
                    const id = getRowId(row);
                    const isSelected = selectedIds.has(id);
                    const rowSelectable = !canDelete || canDelete(row);
                    return (
                      <Table.Row
                        key={id}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        className={isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}
                      >
                        {selectionEnabled && (
                          <Table.Cell className="w-10 pl-4 pr-0">
                            <span title={!rowSelectable ? bulkDelete?.blockedHint : undefined}>
                              <SelectCheckbox
                                checked={isSelected}
                                onChange={() => toggleOne(id)}
                                disabled={!rowSelectable}
                                label={`Seleccionar ${getRowLabel?.(row) ?? id}`}
                              />
                            </span>
                          </Table.Cell>
                        )}
                        {columns.map((col) => (
                          <Table.Cell
                            key={col.key}
                            className={`${col.className ?? ''} ${col.cellClassName ?? ''}`}
                          >
                            {col.cell(row)}
                          </Table.Cell>
                        ))}
                        {rowActions && (
                          <Table.Cell>
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              {rowActions(row)}
                            </div>
                          </Table.Cell>
                        )}
                      </Table.Row>
                    );
                  })
                )}
              </Table.Body>
            </Table>

            {pagination && pagination.totalItems > pagination.itemsPerPage && (
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                itemsPerPage={pagination.itemsPerPage}
                onPageChange={pagination.onPageChange}
                pageSizeOptions={pagination.pageSizeOptions}
                onPageSizeChange={pagination.onPageSizeChange}
              />
            )}
          </>
        )}
      </div>

      {/* Floating bulk-action bar — same on every page. */}
      {bulkDelete && selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-gray-900 dark:bg-gray-950 text-white rounded-2xl shadow-2xl px-5 py-3 border border-gray-700 dark:border-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-white leading-none">{selectedCount}</span>
              </div>
              <span className="text-sm font-medium">
                {selectedLabel(selectedCount, bulkDelete.entity)}
              </span>
            </div>
            <div className="h-4 w-px bg-gray-600" />
            <button
              onClick={() => setShowConfirm(true)}
              className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Eliminar
            </button>
            <div className="h-4 w-px bg-gray-600" />
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {bulkDelete && (
        <ConfirmModal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleBulkDelete}
          title={`Eliminar ${bulkDelete.entity.plural}`}
          message={
            progress
              ? progressMessage(progress, bulkDelete.entity)
              : `¿Estás seguro de que deseas eliminar ${countLabel(selectedCount, bulkDelete.entity)}? Esta acción no se puede deshacer.`
          }
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="danger"
          isLoading={isDeleting}
        />
      )}
    </>
  );
}

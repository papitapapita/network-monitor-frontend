'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, TableEmptyState } from './Table';
import { SelectCheckbox } from './SelectCheckbox';
import { Pagination } from './Pagination';
import { LoadingSpinner } from './LoadingSpinner';
import { ConfirmModal, Modal, UndoModal } from './Modal';
import { Button } from './Button';
import { Textarea } from './Textarea';
import { ErrorBanner } from './ErrorBanner';
import { ApiResponse, BulkActionSummary } from '@/types/common.types';
import { BulkFanOutProgress, runBulkFanOut } from '@/services/bulk-fanout';

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

/**
 * A second thing the selection can be put through, beside deleting it — the
 * alerts list resolving what it selected, the devices list polling it.
 *
 * Give it `run` where the API takes the whole selection in one request, and
 * `runOne` where it does not; `run` wins if both are set. The batch form is
 * always preferable — the endpoint's own report says exactly which ids it
 * declined, and one call cannot trip a rate limit — but most single-row
 * endpoints will never grow a batch twin, and an operator selecting fifteen
 * rows should not have to visit fifteen pages because of that.
 */
export interface BulkAction<T = unknown> {
  /** Identifies the action; also the React key of its button. */
  key: string;
  /** Button label in the floating selection bar. */
  label: string;
  confirmTitle: string;
  /** Worded for the rows that will actually run, which `skipRow` may have thinned. */
  confirmMessage: (count: number) => string;
  confirmText: string;
  /** Past participle for the result note — "resueltas", "reabiertas". */
  doneParticiple: string;
  /** One request for the whole selection. */
  run?: (ids: string[], input?: string) => Promise<ApiResponse<BulkActionSummary>>;
  /** One request per row, paced and aggregated here. Ignored when `run` is set. */
  runOne?: (id: string, input?: string) => Promise<ApiResponse<unknown>>;
  /** Gerund for the progress line of a `runOne` fan-out — "Sondeando", "Resolviendo". */
  progressVerb?: string;
  /**
   * Why this row cannot take *this* action, or `null` if it can. Such rows are
   * dropped from the run and reported as skipped rather than made unselectable:
   * `canDelete` blocks the checkbox itself, which is shared by every action on
   * the table, so an unmonitored device would stop being deletable just because
   * it cannot be polled.
   */
  skipRow?: (row: T) => string | null;
  /**
   * An extra value the action needs, collected in the confirmation and passed
   * to the runner. One value for the whole selection — say so in `helper` where
   * it gets written into each row's record, as a ticket's resolution notes are.
   */
  prompt?: {
    label: string;
    placeholder?: string;
    helper?: string;
    maxLength?: number;
    /** Shown under the field while it is empty; the confirm button stays disabled. */
    requiredMessage: string;
  };
}

export interface BulkDeleteConfig<T> {
  /**
   * Deletes a single row; DataTable fans out over the selection and aggregates
   * the results. Optional so a table can carry `bulkActions` alone — a role
   * that may resolve alerts but not delete them still needs the checkboxes.
   */
  deleteOne?: (id: string) => Promise<ApiResponse<void>>;
  /**
   * Deletes the whole selection in one request. Preferred wherever the API
   * offers it: the fan-out only exists to stay inside the per-IP DELETE budget,
   * which one call cannot trip, and the endpoint's own report says precisely
   * which ids it refused. Takes precedence over `deleteOne` when both are set.
   */
  deleteMany?: (ids: string[]) => Promise<ApiResponse<BulkActionSummary>>;
  /**
   * Puts a deleted row back. Providing it turns the batch's result into an undo
   * offer; leave it off where the delete is final, as the recycle bin's purge is.
   */
  undoOne?: (id: string) => Promise<ApiResponse<unknown>>;
  /** Runs once the batch settles, so the page can refetch. */
  onFinished?: () => void | Promise<void>;
  /**
   * Retries a single row's delete once the operator confirms a second time —
   * for a refusal `deleteOne` flagged as recoverable via `binnedDeviceCount`
   * on its `ApiResponse` (DEV-030: a device model whose only devices are
   * already in the recycle bin). Offered only when exactly one row is being
   * deleted and it is the one blocked this way; anything else falls back to
   * the plain error banner.
   */
  confirmAndRetry?: (id: string) => Promise<ApiResponse<void>>;
  entity: EntityNoun;
  /** Extra buttons in the selection bar, each acting on the whole selection. */
  bulkActions?: BulkAction<T>[];
  /** Rows failing this cannot be selected (e.g. alerts that are still open). */
  canDelete?: (row: T) => boolean;
  /** Tooltip explaining why a blocked row cannot be selected. */
  blockedHint?: string;
  /**
   * Replaces the "cannot be undone" sentence in the confirmation. Set it wherever
   * that is not true — devices are soft-deleted and restorable for a week — since
   * promising permanence the API does not deliver makes the dialog scarier than
   * the action.
   */
  confirmNote?: string;
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
function progressMessage(
  progress: BulkFanOutProgress,
  entity: EntityNoun,
  verb = 'Eliminando'
): string {
  const { done, total, retryAt } = progress;
  const head = `${verb} ${done} de ${countLabel(total, entity)}...`;
  if (retryAt === null) return head;
  const seconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
  return `${head} El servidor limitó el ritmo; se reanuda en ${seconds} s.`;
}

/** "3 alertas resueltas" — a count with its participle agreeing in gender and number. */
function participleLabel(n: number, entity: EntityNoun, stem: string): string {
  return `${countLabel(n, entity)} ${stem}${entity.gender === 'f' ? 'a' : 'o'}${n === 1 ? '' : 's'}`;
}

/**
 * What a batch endpoint's report amounts to, in one line. Both buckets have to
 * be read out: the call answers 200 whether or not every id went through, so
 * silence about them would let a half-done run look complete.
 */
function summaryMessage(summary: BulkActionSummary, entity: EntityNoun, stem: string): string {
  const parts = [participleLabel(summary.succeeded.length, entity, stem)];
  if (summary.skipped.length > 0) {
    parts.push(`${summary.skipped.length} sin cambios (${summary.skipped[0].reason})`);
  }
  if (summary.failed.length > 0) {
    parts.push(`${summary.failed.length} con error (${summary.failed[0].error})`);
  }
  return parts.join(' · ');
}

/** "Dispositivo eliminado" / "Alertas eliminadas" — the undo modal's title. */
function deletedTitle(n: number, entity: EntityNoun): string {
  const noun = n === 1 ? entity.singular : entity.plural;
  const participle = `eliminad${entity.gender === 'f' ? 'a' : 'o'}${n === 1 ? '' : 's'}`;
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${participle}`;
}

function selectedLabel(n: number, entity: EntityNoun): string {
  const suffix = entity.gender === 'f' ? 'seleccionada' : 'seleccionado';
  return `${n} ${suffix}${n === 1 ? '' : 's'}`;
}

/** Ids from `anchor` to `id` inclusive, in row order. Falls back to `[id]` if either is gone. */
function rangeBetween(ids: string[], anchor: string, id: string): string[] {
  const from = ids.indexOf(anchor);
  const to = ids.indexOf(id);
  if (from === -1 || to === -1) return [id];
  return ids.slice(Math.min(from, to), Math.max(from, to) + 1);
}

const RANGE_HINT = 'Mantén Shift para seleccionar un rango';

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
  const [progress, setProgress] = useState<BulkFanOutProgress | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** The extra action awaiting its confirmation, and the note its run left behind. */
  const [pendingAction, setPendingAction] = useState<BulkAction<T> | null>(null);
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [actionProgress, setActionProgress] = useState<BulkFanOutProgress | null>(null);
  /** Value typed into the pending action's `prompt`, cleared with the modal. */
  const [actionInput, setActionInput] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  /** The single row blocked behind a DEV-030-style confirm-and-retry, awaiting the second confirmation. */
  const [blockedRetry, setBlockedRetry] = useState<{ id: string; message: string } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  /** Ids the last batch took, held only to offer them back. */
  const [undoableIds, setUndoableIds] = useState<string[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  /** Last row toggled on its own — the anchor a Shift+click extends from. */
  const anchorId = useRef<string | null>(null);

  useEffect(() => {
    setSelectedIds(new Set());
    setShowConfirm(false);
    setBlockedRetry(null);
    anchorId.current = null;
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

  /** The page's rows by id — a bulk action needs the row to judge whether it applies to it. */
  const rowsById = useMemo(
    () => new Map(rows.map((row) => [getRowId(row), row])),
    [rows, getRowId]
  );

  /**
   * Splits the selection into what `action` can actually run and what it has to
   * report as skipped. Selection is reset whenever the page changes, so every
   * selected id is on this page and has a row to judge.
   */
  const partitionForAction = useCallback(
    (action: BulkAction<T>, ids: string[]) => {
      const skipRow = action.skipRow;
      if (!skipRow) return { runnable: ids, skipped: [] as Array<{ id: string; reason: string }> };

      const runnable: string[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];
      ids.forEach((id) => {
        const row = rowsById.get(id);
        const reason = row ? skipRow(row) : null;
        if (reason) skipped.push({ id, reason });
        else runnable.push(id);
      });
      return { runnable, skipped };
    },
    [rowsById]
  );

  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && selectableIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      selectableIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
    anchorId.current = null;
  };

  /** Shift+click applies the clicked row's new state to every selectable row back to the anchor. */
  const toggleOne = (id: string, shiftKey = false) => {
    // Read the anchor now: the updater below runs at render time, by which point
    // the assignment at the end of this function has already moved the anchor.
    const anchor = anchorId.current;
    setSelectedIds((prev) => {
      const select = !prev.has(id);
      const ids =
        shiftKey && anchor && anchor !== id ? rangeBetween(selectableIds, anchor, id) : [id];

      const next = new Set(prev);
      ids.forEach((rowId) => (select ? next.add(rowId) : next.delete(rowId)));
      return next;
    });
    anchorId.current = id;
  };

  /**
   * The one-request path. The endpoint decides each id's fate and reports it,
   * so there is no partial-run bookkeeping to do here: a failure of the call
   * itself is the only thing that leaves the selection untouched.
   */
  const runDeleteMany = async (
    deleteMany: NonNullable<BulkDeleteConfig<T>['deleteMany']>,
    ids: string[]
  ) => {
    const result = await deleteMany(ids);
    if (!result.success || !result.data) {
      setDeleteError(result.error ?? `Error al eliminar ${bulkDelete!.entity.plural}`);
      return;
    }
    const summary = result.data;
    if (bulkDelete!.undoOne && summary.succeeded.length > 0) setUndoableIds(summary.succeeded);

    const unresolved = [...summary.skipped.map((s) => s.id), ...summary.failed.map((f) => f.id)];
    if (unresolved.length > 0) {
      setDeleteError(summaryMessage(summary, bulkDelete!.entity, 'eliminad'));
      // Leaves selected exactly what the batch did not take, so a retry aims
      // at those rows and not at the ones already gone.
      setSelectedIds(new Set(unresolved));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDelete) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsDeleting(true);
    setDeleteError(null);
    setUndoError(null);
    setActionNotice(null);

    if (bulkDelete.deleteMany) {
      try {
        await runDeleteMany(bulkDelete.deleteMany, ids);
      } catch {
        setDeleteError(`Error al eliminar ${bulkDelete.entity.plural}`);
      } finally {
        setShowConfirm(false);
        setIsDeleting(false);
        await bulkDelete.onFinished?.();
      }
      return;
    }

    const deleteOne = bulkDelete.deleteOne;
    if (!deleteOne) {
      setIsDeleting(false);
      setShowConfirm(false);
      return;
    }

    setProgress({ done: 0, total: ids.length, retryAt: null });
    try {
      const { succeededIds, failed, rateLimited } = await runBulkFanOut(
        ids,
        deleteOne,
        setProgress
      );
      const deleted = succeededIds.length;
      // However the batch went, whatever it did take can be put back — that
      // offer is the whole report on a run that worked.
      if (bulkDelete.undoOne && deleted > 0) setUndoableIds(succeededIds);

      if (failed.length === 0) {
        setSelectedIds(new Set());
      } else if (
        failed.length === 1 &&
        failed[0].binnedDeviceCount !== undefined &&
        bulkDelete.confirmAndRetry
      ) {
        // Refused for a recoverable reason rather than a hard failure: offer the
        // second confirmation instead of dead-ending on the error banner.
        setBlockedRetry({ id: failed[0].id, message: failed[0].error });
        setSelectedIds(new Set(failed.map((f) => f.id)));
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

  const closeAction = () => {
    setPendingAction(null);
    setActionInput('');
    setActionProgress(null);
  };

  const handleRunAction = async () => {
    if (!bulkDelete || !pendingAction) return;
    const action = pendingAction;
    const { runnable, skipped } = partitionForAction(action, Array.from(selectedIds));
    if (runnable.length === 0) return;

    const input = action.prompt ? actionInput.trim() : undefined;
    if (action.prompt && !input) return;

    setIsRunningAction(true);
    setDeleteError(null);
    setActionNotice(null);
    try {
      let summary: BulkActionSummary;

      if (action.run) {
        const result = await action.run(runnable, input);
        if (!result.success || !result.data) {
          setDeleteError(result.error ?? `Error al procesar ${bulkDelete.entity.plural}`);
          return;
        }
        summary = result.data;
      } else if (action.runOne) {
        const runOne = action.runOne;
        setActionProgress({ done: 0, total: runnable.length, retryAt: null });
        // Same paced fan-out as the delete: one write per row against the same
        // 60/min budget, so a selection of thirty must not be fired at once.
        const { succeededIds, failed } = await runBulkFanOut(
          runnable,
          (id) => runOne(id, input),
          setActionProgress
        );
        summary = {
          succeeded: succeededIds,
          skipped: [],
          failed: failed.map(({ id, error }) => ({ id, error })),
        };
      } else {
        return;
      }

      // Rows this action never sent are part of its report too — otherwise a run
      // that quietly left half the selection alone reads as a clean success.
      const merged: BulkActionSummary = {
        ...summary,
        skipped: [...skipped, ...summary.skipped],
      };
      const message = summaryMessage(merged, bulkDelete.entity, action.doneParticiple);
      // A row the endpoint refused outright is a failure worth the red banner;
      // one it merely skipped (already resolved, not monitored) is a normal run.
      if (merged.failed.length > 0) setDeleteError(message);
      else setActionNotice(message);

      // Leaves selected exactly what the action did not take, so a retry — or a
      // different action — aims at those rows and not at the ones already done.
      const unresolved = [...merged.skipped.map((s) => s.id), ...merged.failed.map((f) => f.id)];
      setSelectedIds(new Set(unresolved));
    } catch {
      setDeleteError(`Error al procesar ${bulkDelete.entity.plural}`);
    } finally {
      closeAction();
      setIsRunningAction(false);
      await bulkDelete.onFinished?.();
    }
  };

  const handleConfirmRetry = async () => {
    if (!blockedRetry || !bulkDelete?.confirmAndRetry) return;
    setIsRetrying(true);
    setDeleteError(null);
    const result = await bulkDelete.confirmAndRetry(blockedRetry.id);
    setIsRetrying(false);
    setBlockedRetry(null);

    if (result.success) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(blockedRetry.id);
        return next;
      });
    } else {
      setDeleteError(result.error ?? `Error al eliminar ${bulkDelete.entity.singular}`);
    }
    await bulkDelete.onFinished?.();
  };

  const handleUndo = async () => {
    const undoOne = bulkDelete?.undoOne;
    if (!undoOne || undoableIds.length === 0) return;

    setIsUndoing(true);
    setUndoError(null);
    // Same runner as the delete: a restore per row is the same fan-out against
    // the same per-IP budget, so it wants the same pacing and 429 backoff.
    const { failed } = await runBulkFanOut(undoableIds, undoOne);
    setIsUndoing(false);

    if (failed.length === 0) {
      setUndoableIds([]);
    } else {
      setUndoError(
        `No se pudieron restaurar ${countLabel(failed.length, bulkDelete!.entity)}. ${failed[0].error}`
      );
      // Leaves the modal open on exactly what is still missing, so the button
      // retries those and not the rows that already came back.
      setUndoableIds(failed.map((f) => f.id));
    }
    await bulkDelete?.onFinished?.();
  };

  const selectionEnabled = !!bulkDelete;
  const selectedCount = selectedIds.size;
  /** What the pending action would run and skip, for the confirmation's wording. */
  const actionSplit = pendingAction
    ? partitionForAction(pendingAction, Array.from(selectedIds))
    : { runnable: [], skipped: [] as Array<{ id: string; reason: string }> };
  const canRunDelete = !!(bulkDelete?.deleteMany || bulkDelete?.deleteOne);

  return (
    <>
      {deleteError && (
        <ErrorBanner
          message={deleteError}
          onDismiss={() => setDeleteError(null)}
          className="mb-3"
        />
      )}

      {actionNotice && (
        <div
          role="status"
          className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
        >
          <p className="text-sm text-green-800 dark:text-green-400">{actionNotice}</p>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="shrink-0 text-green-400 transition-colors hover:text-green-600 dark:hover:text-green-300"
          >
            <span className="sr-only">Descartar</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
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
                          <Table.Cell className="w-10 pl-4 pr-0 select-none">
                            <span title={rowSelectable ? RANGE_HINT : bulkDelete?.blockedHint}>
                              <SelectCheckbox
                                checked={isSelected}
                                onChange={(shiftKey) => toggleOne(id, shiftKey)}
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
            {bulkDelete.bulkActions?.map((action) => (
              <React.Fragment key={action.key}>
                <div className="h-4 w-px bg-gray-600" />
                <button
                  onClick={() => setPendingAction(action)}
                  className="text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
                >
                  {action.label}
                </button>
              </React.Fragment>
            ))}
            {canRunDelete && (
              <>
                <div className="h-4 w-px bg-gray-600" />
                <button
                  onClick={() => setShowConfirm(true)}
                  className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  Eliminar
                </button>
              </>
            )}
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

      {bulkDelete?.bulkActions && pendingAction && (
        <Modal
          isOpen
          onClose={closeAction}
          title={pendingAction.confirmTitle}
          size="sm"
          showCloseButton={!isRunningAction}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {actionProgress
                ? progressMessage(actionProgress, bulkDelete.entity, pendingAction.progressVerb)
                : actionSplit.runnable.length === 0
                  ? `Ninguno de los ${bulkDelete.entity.plural} seleccionados admite esta acción.`
                  : pendingAction.confirmMessage(actionSplit.runnable.length)}
            </p>

            {/* What the action will leave alone, said before the run rather than after. */}
            {!actionProgress && actionSplit.skipped.length > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-500">
                Se omitirá{actionSplit.skipped.length === 1 ? '' : 'n'}{' '}
                {countLabel(actionSplit.skipped.length, bulkDelete.entity)}:{' '}
                {actionSplit.skipped[0].reason}.
              </p>
            )}

            {pendingAction.prompt && !actionProgress && (
              <Textarea
                label={pendingAction.prompt.label}
                name={`bulk-${pendingAction.key}-input`}
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                helperText={pendingAction.prompt.helper}
                error={
                  actionInput.trim() ? undefined : pendingAction.prompt.requiredMessage
                }
                placeholder={pendingAction.prompt.placeholder}
                maxLength={pendingAction.prompt.maxLength}
                rows={4}
                required
                fullWidth
                disabled={isRunningAction}
              />
            )}
          </div>
          <Modal.Footer>
            <Button variant="outline" onClick={closeAction} disabled={isRunningAction}>
              Cancelar
            </Button>
            <Button
              onClick={handleRunAction}
              isLoading={isRunningAction}
              disabled={
                actionSplit.runnable.length === 0 ||
                (!!pendingAction.prompt && !actionInput.trim())
              }
            >
              {pendingAction.confirmText}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {bulkDelete && canRunDelete && (
        <ConfirmModal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleBulkDelete}
          title={`Eliminar ${bulkDelete.entity.plural}`}
          message={
            progress
              ? progressMessage(progress, bulkDelete.entity)
              : `¿Estás seguro de que deseas eliminar ${countLabel(selectedCount, bulkDelete.entity)}? ${
                  bulkDelete.confirmNote ?? 'Esta acción no se puede deshacer.'
                }`
          }
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="danger"
          isLoading={isDeleting}
        />
      )}

      {bulkDelete?.confirmAndRetry && (
        <ConfirmModal
          isOpen={blockedRetry !== null}
          onClose={() => setBlockedRetry(null)}
          onConfirm={handleConfirmRetry}
          title="Vaciar la papelera y eliminar"
          message={blockedRetry?.message ?? ''}
          confirmText="Eliminar de todas formas"
          cancelText="Cancelar"
          variant="danger"
          isLoading={isRetrying}
        />
      )}

      {bulkDelete?.undoOne && (
        <UndoModal
          isOpen={undoableIds.length > 0}
          onClose={() => { setUndoableIds([]); setUndoError(null); }}
          onUndo={handleUndo}
          title={deletedTitle(undoableIds.length, bulkDelete.entity)}
          message={`${undoableIds.length === 1 ? 'Se eliminó' : 'Se eliminaron'} ${countLabel(
            undoableIds.length,
            bulkDelete.entity
          )}.`}
          isUndoing={isUndoing}
          error={undoError}
        />
      )}
    </>
  );
}

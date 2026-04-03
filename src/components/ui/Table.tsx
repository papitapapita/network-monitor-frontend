import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

interface TableHeaderProps {
  children: React.ReactNode;
}

interface TableBodyProps {
  children: React.ReactNode;
}

interface TableRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

interface TableHeadProps {
  children: React.ReactNode;
  sortable?: boolean;
  onSort?: () => void;
  sortDirection?: 'asc' | 'desc' | null;
  className?: string;
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children }: TableHeaderProps) {
  return (
    <thead className="bg-gray-50 dark:bg-gray-900">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableBody({ children }: TableBodyProps) {
  return (
    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
      {children}
    </tbody>
  );
}

export function TableRow({ children, onClick, className = '' }: TableRowProps) {
  return (
    <tr
      className={`
        ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  sortable = false,
  onSort,
  sortDirection = null,
  className = '',
}: TableHeadProps) {
  return (
    <th
      scope="col"
      className={`
        px-6 py-3 text-left text-xs font-medium
        text-gray-500 dark:text-gray-400 uppercase tracking-wider
        ${sortable ? 'cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
        ${className}
      `}
      onClick={sortable ? onSort : undefined}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && (
          <span className="ml-1">
            {sortDirection === 'asc' && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            )}
            {sortDirection === 'desc' && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
              </svg>
            )}
            {sortDirection === null && (
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            )}
          </span>
        )}
      </div>
    </th>
  );
}

export function TableCell({ children, className = '' }: TableCellProps) {
  return (
    <td
      className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${className}`}
    >
      {children}
    </td>
  );
}

Table.Header = TableHeader;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Head = TableHead;
Table.Cell = TableCell;

interface TableEmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export function TableEmptyState({ message, icon }: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={100} className="px-6 py-12 text-center">
        <div className="flex flex-col items-center justify-center">
          {icon && <div className="mb-4 text-gray-400">{icon}</div>}
          <p className="text-gray-500 dark:text-gray-400 text-sm">{message}</p>
        </div>
      </td>
    </tr>
  );
}

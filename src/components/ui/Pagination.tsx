'use client';

import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  showPageNumbers?: boolean;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  showPageNumbers = true,
  pageSizeOptions,
  onPageSizeChange,
}: PaginationProps) {
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // maxVisible caps how many page buttons show at once (numbers + the two
  // ellipses); first and last page are always kept so jumping to either end
  // stays one tap away.
  const getPageNumbers = (maxVisible = 7) => {
    const pages: (number | string)[] = [];

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    const siblingCount = Math.max(0, Math.floor((maxVisible - 5) / 2));
    const leftSibling = Math.max(currentPage - siblingCount, 2);
    const rightSibling = Math.min(currentPage + siblingCount, totalPages - 1);

    pages.push(1);
    if (leftSibling > 2) pages.push('...');
    for (let i = leftSibling; i <= rightSibling; i++) pages.push(i);
    if (rightSibling < totalPages - 1) pages.push('...');
    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      {/* Mobile */}
      <div className="flex-1 flex flex-col items-center gap-3 sm:hidden">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canGoPrevious}
            aria-label="Anterior"
            className={`
              inline-flex items-center justify-center h-8 w-8 rounded-md shrink-0
              border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              ${canGoPrevious
                ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}
            `}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {showPageNumbers ? (
            getPageNumbers(5).map((page, index) =>
              typeof page === 'number' ? (
                <button
                  key={index}
                  onClick={() => onPageChange(page)}
                  className={`
                    inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-md text-xs font-medium shrink-0
                    ${page === currentPage
                      ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-500 dark:border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}
                  `}
                >
                  {page}
                </button>
              ) : (
                <span key={index} className="px-0.5 text-xs text-gray-400 dark:text-gray-600">
                  {page}
                </span>
              )
            )
          ) : (
            <span className="px-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Página <span className="font-medium">{currentPage}</span> de{' '}
              <span className="font-medium">{totalPages}</span>
            </span>
          )}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canGoNext}
            aria-label="Siguiente"
            className={`
              inline-flex items-center justify-center h-8 w-8 rounded-md shrink-0
              border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              ${canGoNext
                ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}
            `}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {pageSizeOptions && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
              Por página
            </label>
            <select
              value={itemsPerPage}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {pageSizeOptions && onPageSizeChange && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                Por página
              </label>
              <select
                value={itemsPerPage}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          )}
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {totalItems !== undefined && itemsPerPage !== undefined ? (
              <>
                Mostrando{' '}
                <span className="font-medium">
                  {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}
                </span>{' '}
                a{' '}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, totalItems)}
                </span>{' '}
                de <span className="font-medium">{totalItems}</span> resultados
              </>
            ) : (
              <>
                Página <span className="font-medium">{currentPage}</span> de{' '}
                <span className="font-medium">{totalPages}</span>
              </>
            )}
          </p>
        </div>

        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!canGoPrevious}
              className={`
                relative inline-flex items-center px-2 py-2 rounded-l-md
                border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800 text-sm font-medium
                ${canGoPrevious
                  ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}
              `}
            >
              <span className="sr-only">Anterior</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {showPageNumbers &&
              getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (
                  <button
                    key={index}
                    onClick={() => onPageChange(page)}
                    className={`
                      relative inline-flex items-center px-4 py-2 border text-sm font-medium
                      ${page === currentPage
                        ? 'z-10 bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}
                    `}
                  >
                    {page}
                  </button>
                ) : (
                  <span
                    key={index}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {page}
                  </span>
                )
              )}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!canGoNext}
              className={`
                relative inline-flex items-center px-2 py-2 rounded-r-md
                border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800 text-sm font-medium
                ${canGoNext
                  ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}
              `}
            >
              <span className="sr-only">Siguiente</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

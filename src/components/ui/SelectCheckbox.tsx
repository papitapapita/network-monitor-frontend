'use client';

interface SelectCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label?: string;
}

export function SelectCheckbox({ checked, indeterminate = false, onChange, label }: SelectCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`
        w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0
        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
        dark:focus:ring-offset-gray-800
        ${(checked || indeterminate)
          ? 'bg-blue-600 border-blue-600 shadow-sm'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-gray-800'
        }
      `}
    >
      {indeterminate && !checked && (
        <div className="w-2 h-px bg-white rounded-full" />
      )}
      {checked && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4.5" />
        </svg>
      )}
    </button>
  );
}

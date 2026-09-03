'use client';

import React, { useRef, useState } from 'react';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const SIDE_CLASSES: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

/**
 * Wraps an icon-only control with a label that appears on hover — free via CSS
 * `group-hover`, no state involved — and on a touch device's press-and-hold,
 * which has no CSS equivalent and needs a timer.
 */
export function Tooltip({ label, children, side = 'top' }: TooltipProps) {
  const [heldVisible, setHeldVisible] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHold = () => {
    holdTimer.current = setTimeout(() => setHeldVisible(true), 450);
  };
  const endHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (heldVisible) setTimeout(() => setHeldVisible(false), 1200);
  };

  return (
    <span
      className="group/tooltip relative inline-flex"
      onTouchStart={startHold}
      onTouchEnd={endHold}
      onTouchCancel={endHold}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-40 whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-700 px-2 py-1 text-xs font-medium text-white shadow-lg transition-opacity duration-150 opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 ${
          heldVisible ? 'opacity-100' : ''
        } ${SIDE_CLASSES[side]}`}
      >
        {label}
      </span>
    </span>
  );
}

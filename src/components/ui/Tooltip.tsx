'use client';

import React, { useCallback, useRef, useState } from 'react';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const SIDE_CLASSES: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 mb-2',
  bottom: 'top-full left-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

// Keeps the label a comfortable distance from the clipping edge instead of
// touching it exactly.
const EDGE_PADDING = 8;

/** Ancestor overflow values that actually clip content painted past their box. */
function clips(overflow: string): boolean {
  return overflow === 'hidden' || overflow === 'auto' || overflow === 'scroll' || overflow === 'clip';
}

/**
 * Finds the horizontal bounds a tooltip must stay within: the nearest
 * ancestor that clips overflow (a table's `overflow-x-auto` wrapper, the app
 * shell's scrollable `main`, ...), or the document viewport if nothing
 * clips before that. `window.innerWidth` alone isn't enough — a table
 * that's tall enough to scroll vertically eats a scrollbar's worth of width
 * from its own box well before content reaches the actual window edge.
 */
function getClipBounds(el: HTMLElement): { left: number; right: number } {
  let node = el.parentElement;
  while (node && node !== document.body) {
    if (clips(getComputedStyle(node).overflowX)) {
      // `getBoundingClientRect` is the border box, which still includes a
      // scrollbar's width — overflow actually clips at the padding edge, so
      // `clientLeft`/`clientWidth` (border-box minus border and scrollbar)
      // are what the tooltip really has to stay inside of.
      const rect = node.getBoundingClientRect();
      const left = rect.left + node.clientLeft;
      return { left, right: left + node.clientWidth };
    }
    node = node.parentElement;
  }
  return { left: 0, right: document.documentElement.clientWidth };
}

/**
 * Wraps an icon-only control with a label that appears on hover — free via CSS
 * `group-hover`, no state involved — and on a touch device's press-and-hold,
 * which has no CSS equivalent and needs a timer.
 *
 * `top`/`bottom` labels are centered under the trigger by default, which cuts
 * them off mid-word for a trigger sitting near the edge of whatever clips it
 * (e.g. a page header's rightmost action, or a row action in a table that
 * runs to the edge of the page). On show, we measure the label against its
 * real clipping bounds and nudge it back inside instead of relying on pure
 * centering.
 */
export function Tooltip({ label, children, side = 'bottom' }: TooltipProps) {
  const [heldVisible, setHeldVisible] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  const isHorizontallyCentered = side === 'top' || side === 'bottom';

  const updateShift = useCallback(() => {
    if (!isHorizontallyCentered || !labelRef.current || !wrapperRef.current) return;
    // Compute where the label would sit if perfectly centered, purely from
    // geometry (never by writing to the live `transform` to measure it):
    // `offsetWidth` is unaffected by transforms, so this is stable across
    // repeat hovers. Mutating the DOM transform to "reset" it before
    // measuring, then calling setState, previously broke on a repeat hover —
    // when the freshly computed shift matched the already-applied one, React
    // saw no state change and skipped re-applying the style, leaving the
    // reset (centered, unshifted) transform on screen instead.
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const labelWidth = labelRef.current.offsetWidth;
    const anchorX = wrapperRect.left + wrapperRect.width / 2;
    const centeredLeft = anchorX - labelWidth / 2;
    const centeredRight = anchorX + labelWidth / 2;
    const bounds = getClipBounds(wrapperRef.current);
    let shift = 0;
    if (centeredRight > bounds.right - EDGE_PADDING) {
      shift = bounds.right - EDGE_PADDING - centeredRight;
    } else if (centeredLeft < bounds.left + EDGE_PADDING) {
      shift = bounds.left + EDGE_PADDING - centeredLeft;
    }
    setShiftX(shift);
  }, [isHorizontallyCentered]);

  const startHold = () => {
    holdTimer.current = setTimeout(() => {
      updateShift();
      setHeldVisible(true);
    }, 450);
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
      ref={wrapperRef}
      className="group/tooltip relative inline-flex"
      onMouseEnter={updateShift}
      onFocus={updateShift}
      onTouchStart={startHold}
      onTouchEnd={endHold}
      onTouchCancel={endHold}
    >
      {children}
      <span
        ref={labelRef}
        role="tooltip"
        style={isHorizontallyCentered ? { transform: `translateX(calc(-50% + ${shiftX}px))` } : undefined}
        className={`pointer-events-none absolute z-40 whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-700 px-2 py-1 text-xs font-medium text-white shadow-lg transition-opacity duration-150 opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 ${
          heldVisible ? 'opacity-100' : ''
        } ${SIDE_CLASSES[side]}`}
      >
        {label}
      </span>
    </span>
  );
}

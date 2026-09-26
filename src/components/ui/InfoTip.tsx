'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { InfoIcon } from './icons';

interface InfoTipProps {
  /** The explanation: how the thing next to it behaves. Plain text or short inline markup. */
  children: React.ReactNode;
  /** Names what is being explained, for screen readers — e.g. the section title. */
  label?: string;
  className?: string;
}

const WIDTH = 288;
const GAP = 6;
const EDGE_PADDING = 8;

/**
 * An "i" button that sits beside a title or field label and holds the prose
 * explaining how that section behaves, so the explanation is one click away
 * instead of a paragraph competing with the content.
 *
 * Opens on hover and keyboard focus like a tooltip, and toggles on click so a
 * touch user can open it and read it at their own pace. Unlike Tooltip, the
 * text wraps, and it is portaled with fixed positioning so a card's or
 * table's overflow never clips it.
 */
export function InfoTip({ children, label = 'Más información', className = '' }: InfoTipProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const open = hovered || pinned;

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const width = Math.min(WIDTH, viewportWidth - EDGE_PADDING * 2);
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, EDGE_PADDING),
      viewportWidth - EDGE_PADDING - width
    );
    // Below by default; above when the button sits in the bottom third.
    if (rect.bottom > window.innerHeight * 0.66) {
      setPos({ bottom: window.innerHeight - rect.top + GAP, left });
    } else {
      setPos({ top: rect.bottom + GAP, left });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (buttonRef.current?.contains(target) || target.closest?.(`[data-infotip="${popoverId}"]`)) return;
      setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setHovered(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned, popoverId]);

  const popover =
    open && pos
      ? ReactDOM.createPortal(
          <div
            id={popoverId}
            data-infotip={popoverId}
            role="tooltip"
            style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: Math.min(WIDTH, document.documentElement.clientWidth - EDGE_PADDING * 2), zIndex: 9999 }}
            className="rounded-md bg-gray-900 dark:bg-gray-700 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg normal-case tracking-normal text-left whitespace-normal"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {children}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onClick={(e) => {
          // Beside a <label>, a click would otherwise also focus or toggle the field.
          e.preventDefault();
          e.stopPropagation();
          setPinned((v) => !v);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className={`inline-flex shrink-0 items-center justify-center rounded-full align-middle text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
          pinned ? 'text-gray-600 dark:text-gray-300' : ''
        } ${className}`}
      >
        <InfoIcon />
      </button>
      {popover}
    </>
  );
}

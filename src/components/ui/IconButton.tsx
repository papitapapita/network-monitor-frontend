'use client';

import React from 'react';
import { Button, ButtonVariant, ButtonSize } from './Button';
import { Tooltip } from './Tooltip';

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: React.ReactNode;
  /** Doubles as the tooltip text and the accessible name — an icon alone never has to be guessed at. */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * The standard icon-only action button used everywhere a label would crowd a
 * card header or a row: a square `Button` wrapped in a `Tooltip`, which reveals
 * `label` on hover and on a touch device's press-and-hold.
 */
export function IconButton({
  icon,
  label,
  variant = 'outline',
  size = 'sm',
  tooltipSide = 'top',
  ...props
}: IconButtonProps) {
  return (
    <Tooltip label={label} side={tooltipSide}>
      <Button variant={variant} size={size} iconOnly aria-label={label} {...props}>
        {icon}
      </Button>
    </Tooltip>
  );
}

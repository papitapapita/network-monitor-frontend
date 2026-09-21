import type React from 'react';

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color']);

/**
 * Whether a keydown is the Enter a native `<form>` would treat as "submit":
 * Enter pressed in a text-like input. Buttons and textareas keep their own
 * Enter, the Combobox owns its Enter (it opens/selects), and an IME
 * composition or a key someone else already handled is left alone.
 */
export function isSubmitEnter(e: KeyboardEvent | React.KeyboardEvent): boolean {
  const native = 'nativeEvent' in e ? e.nativeEvent : e;
  if (e.key !== 'Enter' || e.defaultPrevented || native.isComposing) return false;
  if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return false;
  const target = e.target;
  if (!(target instanceof HTMLInputElement)) return false;
  if (NON_TEXT_INPUTS.has(target.type) || target.getAttribute('role') === 'combobox') return false;
  return true;
}

/**
 * `onKeyDown` for a group of fields that isn't a `<form>` (an inline edit
 * card, a modal body, a form nested inside another form) — Enter runs `submit`
 * as if its save button were clicked. Never fires while `disabled`.
 */
export function submitOnEnter(submit: () => void, disabled = false) {
  return (e: React.KeyboardEvent) => {
    if (disabled || !isSubmitEnter(e)) return;
    e.preventDefault();
    submit();
  };
}

/** Whether a keydown is an Escape nobody else (an open Select or Combobox) already used to close something. */
export function isCancelEscape(e: KeyboardEvent | React.KeyboardEvent): boolean {
  const native = 'nativeEvent' in e ? e.nativeEvent : e;
  return e.key === 'Escape' && !e.defaultPrevented && !native.isComposing;
}

/** `submitOnEnter` plus Escape running `cancel`, for a group of fields that has a cancel button. */
export function submitOnEnterCancelOnEscape(submit: () => void, cancel: () => void, disabled = false) {
  const onEnter = submitOnEnter(submit, disabled);
  return (e: React.KeyboardEvent) => {
    if (isCancelEscape(e)) {
      if (disabled) return;
      e.preventDefault();
      cancel();
      return;
    }
    onEnter(e);
  };
}

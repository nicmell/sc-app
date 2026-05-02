import { memo } from 'react';

/** Variants align with @sc-app/ui-foundation's
 *  `.toast[data-variant=…]` palette. */
export type ToastVariant = 'success' | 'warn' | 'error' | 'info';

export interface ToastData {
  /** Stable identity for React keys + the dismiss callback. */
  id: number;
  /** Plain-text message rendered into the toast body. The card
   *  wraps long messages; HTML/rich content isn't supported. */
  message: string;
  /** Picks the foundation accent stripe + ARIA flavour. Default
   *  `info` (primary-accented) when callers don't specify. */
  variant: ToastVariant;
}

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: number) => void;
}

/** Single toast card. Memoized — the parent re-renders the whole
 *  stack on every show/dismiss; identity stays stable across
 *  pure re-renders. The role/aria-live mapping follows WAI-ARIA
 *  authoring practice: errors are `assertive`, others polite. */
export const ToastItem = memo(function ToastItem({
  toast,
  onDismiss,
}: ToastItemProps) {
  const role = toast.variant === 'error' ? 'alert' : 'status';
  return (
    <div
      className="toast"
      data-variant={toast.variant}
      role={role}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
    >
      <span className="toast-message">{toast.message}</span>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </button>
    </div>
  );
});

interface ToastContainerProps {
  toasts: ReadonlyArray<ToastData>;
  onDismiss: (id: number) => void;
}

/** Bottom-right anchored stack. Newest at the bottom (column
 *  flow); the foundation's CSS handles the fixed positioning,
 *  pointer-events-through-gaps, and the slide-in animation. */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastData, ToastVariant } from './Toast';

const DEFAULT_TIMEOUT_MS: Record<ToastVariant, number> = {
  success: 4000,
  info: 5000,
  warn: 7000,
  // Errors stay until the user dismisses — they're often the
  // diagnosis users need to read. 0 = no auto-dismiss.
  error: 0,
};

let nextId = 0;

export interface UseToastsResult {
  toasts: ReadonlyArray<ToastData>;
  /** Show a toast. Returns its id so callers can dismiss
   *  programmatically (e.g. cancel a "connecting…" toast when
   *  the connect succeeds). Auto-dismiss timing comes from
   *  `DEFAULT_TIMEOUT_MS[variant]`; pass `timeoutMs` to
   *  override (0 = stick around until manual dismiss). */
  show: (
    message: string,
    variant?: ToastVariant,
    timeoutMs?: number,
  ) => number;
  dismiss: (id: number) => void;
}

/** Phase 29d toast state. One stack per host (typically one
 *  AppShell) — multiple useToasts() calls produce independent
 *  stacks, so callers should hoist a single instance up to the
 *  right level. */
export function useToasts(): UseToastsResult {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  // Per-toast timer ids so a manual dismiss can cancel the
  // pending auto-dismiss without leaving a dangling timer.
  const timersRef = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (
      message: string,
      variant: ToastVariant = 'info',
      timeoutMs?: number,
    ): number => {
      const id = nextId++;
      const toast: ToastData = { id, message, variant };
      setToasts((prev) => [...prev, toast]);
      const ttl = timeoutMs ?? DEFAULT_TIMEOUT_MS[variant];
      if (ttl > 0) {
        const timer = window.setTimeout(() => dismiss(id), ttl);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  // Clean up timers on unmount so a fast unmount-during-show
  // doesn't leak a setTimeout.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return { toasts, show, dismiss };
}

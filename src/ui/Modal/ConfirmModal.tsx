import { createPortal } from 'react-dom';

// Modal chrome (.modal-backdrop, .modal, .modal-title, .modal-body,
// .modal-actions, .modal-progress) lives in @sc-app/ui-foundation,
// loaded once at app entry. No local stylesheet needed.

export interface ConfirmModalProps {
  title: string;
  /** Body copy. May be a string or pre-formatted node. */
  body: React.ReactNode;
  /** Label on the affirmative button. */
  confirmLabel?: string;
  /** Label on the cancel button. */
  cancelLabel?: string;
  /** Visual emphasis on the confirm button — `'primary'` (default)
   *  for neutral confirmations, `'danger'` for destructive ones. */
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Generic yes/no modal. Renders via portal at the document body so
 * it overlays everything regardless of the dashboard's layout.
 *
 * Doesn't trap focus or close on backdrop click — both are
 * tradeable for now since the only caller (`AppShell`'s reinit
 * confirm) has a clear keyboard path through Tab+Enter / Esc on
 * the buttons.
 */
export function ConfirmModal({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h3 className="modal-title">{title}</h3>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">
          <button type="button" data-variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            data-variant={variant === 'danger' ? 'danger' : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { createPortal } from 'react-dom';
import './Modal.scss';

export interface AlertModalProps {
  title: string;
  /** Body copy. May be a string or pre-formatted node. */
  body: React.ReactNode;
  /** Label on the single dismiss button. */
  dismissLabel?: string;
  /** Visual emphasis on the dismiss button — `'primary'` (default)
   *  for neutral notices, `'danger'` for error notices. */
  variant?: 'primary' | 'danger';
  onDismiss: () => void;
}

/**
 * Single-button alert modal. Mirrors `ConfirmModal`'s shape but
 * with no Cancel — for "your connection dropped, here's why"-style
 * notices where there's nothing to cancel. Renders via portal at
 * document.body.
 */
export function AlertModal({
  title,
  body,
  dismissLabel = 'OK',
  variant = 'primary',
  onDismiss,
}: AlertModalProps) {
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h3 className="modal-title">{title}</h3>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">
          <button
            type="button"
            className={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onDismiss}
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

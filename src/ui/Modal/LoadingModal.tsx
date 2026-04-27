import { createPortal } from 'react-dom';
import './Modal.scss';

export interface LoadingModalProps {
  /** Body copy. Brief — "Reinitializing dashboard…" or similar. */
  message: string;
  /** Title above the message. Defaults to "Working…". */
  title?: string;
}

/**
 * Full-screen overlay with an indeterminate progress bar. No
 * buttons — caller controls visibility. Renders via portal so it's
 * not constrained by the dashboard's stacking context.
 */
export function LoadingModal({
  message,
  title = 'Working…',
}: LoadingModalProps) {
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h3 className="modal-title">{title}</h3>
        <p className="modal-body">{message}</p>
        <div className="modal-progress" aria-hidden="true" />
      </div>
    </div>,
    document.body,
  );
}

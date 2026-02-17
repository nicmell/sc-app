import {type ReactNode} from "react";
import {createPortal} from "react-dom";
import {IconButton} from "@/components/ui/IconButton";
import cn from "classnames";
import "./Modal.scss";

interface ModalProps {
  open: boolean;
  title: string;
  className?: string;
  onClose?: () => void;
  children: ReactNode;
}

export function Modal({open, title, className, onClose, children}: ModalProps) {
  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className={cn("modal-content", className)} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          {onClose && (
            <IconButton size="md" onClick={onClose} aria-label="Close">&times;</IconButton>
          )}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

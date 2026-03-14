import {type ReactNode, type Ref} from "react";
import {IconButton} from "@/components/ui/IconButton";
import cn from "classnames";
import "./Dashboard.scss";

interface DashboardPanelProps {
  title?: string;
  children?: ReactNode;
  onClose?: () => void;
  onEdit?: () => void;
  onLog?: () => void;
  ref?: Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  className?: string;
}

export function DashboardPanel(props: DashboardPanelProps) {
  const {title, children, onClose, onEdit, onLog, ref, style, className, ...rest} = props;
  return (
    <div ref={ref} style={style} className={cn("dashboard-panel", className)} {...rest}>
      <div className="dashboard-panel-header">
        <span className="dashboard-panel-title">{title}</span>
          {onLog && (
            <IconButton
              size="sm"
              onMouseDown={e => e.stopPropagation()}
              onClick={onLog}
              aria-label="Log state"
            >
              &#9881;
            </IconButton>
          )}
          <IconButton
            size="sm"
            onMouseDown={e => e.stopPropagation()}
            onClick={onEdit}
            aria-label="Change plugin"
          >
            &#8943;
          </IconButton>
          <IconButton
            size="sm"
            onMouseDown={e => e.stopPropagation()}
            onClick={onClose}
            aria-label="Close panel"
          >
            &times;
          </IconButton>
      </div>
      <div className="dashboard-panel-body">
          {children}
      </div>
    </div>
  );
}

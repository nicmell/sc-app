import {type ReactNode, type Ref} from "react";
import {IconButton} from "@/components/ui/IconButton";
import cn from "classnames";
import "./Dashboard.scss";

interface DashboardPanelProps {
  title?: string;
  running?: boolean;
  children?: ReactNode;
  onClose?: () => void;
  onEdit?: () => void;
  onLog?: () => void;
  onToggleRun?: () => void;
  ref?: Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  className?: string;
}

export function DashboardPanel(props: DashboardPanelProps) {
  const {title, running, children, onClose, onEdit, onLog, onToggleRun, ref, style, className, ...rest} = props;
  return (
    <div ref={ref} style={style} className={cn("dashboard-panel", className)} {...rest}>
      <div className="dashboard-panel-header">
        <span className="dashboard-panel-title">{title}</span>
          {onToggleRun && (
            <IconButton
              size="sm"
              onMouseDown={e => e.stopPropagation()}
              onClick={onToggleRun}
              aria-label={running ? "Stop" : "Play"}
            >
              <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor">
                {running
                  ? <>
                      <rect x="4" y="3.5" width="3" height="11" rx="1"/>
                      <rect x="11" y="3.5" width="3" height="11" rx="1"/>
                    </>
                  : <polygon points="5,2.5 5,15.5 15,9"/>}
              </svg>
            </IconButton>
          )}
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

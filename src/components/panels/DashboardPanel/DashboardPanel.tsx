import {type ReactNode, type Ref} from "react";
import "./DashboardPanel.scss";

interface DashboardPanelProps {
  title: string;
  children?: ReactNode;
  onClose?: () => void;
  ref?: Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  className?: string;
}

export function DashboardPanel({title, children, onClose, ref, style, className, ...rest}: DashboardPanelProps) {
  return (
    <div ref={ref} style={style} className={`dashboard-panel ${className ?? ""}`} {...rest}>
      <div className="dashboard-panel-header">
        <span className="dashboard-panel-title">{title}</span>
        {onClose && (
          <button
            className="dashboard-panel-close"
            onMouseDown={e => e.stopPropagation()}
            onClick={onClose}
          >
            &times;
          </button>
        )}
      </div>
      {children && <div className="dashboard-panel-body">{children}</div>}
    </div>
  );
}

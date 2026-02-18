import {type ReactNode, type Ref} from "react";
import {IconButton} from "@/components/ui/IconButton";
import cn from "classnames";
import "./Dashboard.scss";

interface DashboardPanelProps {
  title: string;
  boxId: string;
  pluginId?: string;
  children?: ReactNode;
  onClose?: () => void;
  onEdit?: () => void;
  ref?: Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  className?: string;
}

export function DashboardPanel({title, boxId, pluginId, children, onClose, onEdit, ref, style, className, ...rest}: DashboardPanelProps) {
  return (
    <div ref={ref} style={style} className={cn("dashboard-panel", className)} {...rest}>
      <div className="dashboard-panel-header">
        <span className="dashboard-panel-title">{title}</span>
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

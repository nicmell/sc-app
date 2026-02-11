import {forwardRef, type ReactNode} from "react";
import "./DashboardPanel.scss";

interface DashboardPanelProps {
  title: string;
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const DashboardPanel = forwardRef<HTMLDivElement, DashboardPanelProps>(
  ({title, children, style, className, ...rest}, ref) => {
    return (
      <div ref={ref} style={style} className={`dashboard-panel ${className ?? ""}`} {...rest}>
        <div className="dashboard-panel-header">{title}</div>
        <div className="dashboard-panel-body">{children}</div>
      </div>
    );
  }
);

DashboardPanel.displayName = "DashboardPanel";

import {useState, useEffect, type ReactNode, type Ref} from "react";
import {useSelector} from "@/lib/stores/store";
import pluginsStore from "@/lib/stores/plugins";
import type {PluginInfo} from "@/types/stores";
import {pluginUrl} from "@/lib/storage/pluginStorage";
import {Modal} from "@/components/Modal";
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
  const plugins = useSelector(pluginsStore.selectors.items);
  const [modalOpen, setModalOpen] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (plugin: PluginInfo) => {
    setSelectedPlugin(plugin);
    setModalOpen(false);
  };

  useEffect(() => {
    if (!selectedPlugin) return;
    let cancelled = false;
    setHtml(null);
    setError(null);

    fetch(pluginUrl(selectedPlugin.name, selectedPlugin.entry))
      .then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.text();
      })
      .then(text => { if (!cancelled) setHtml(text); })
      .catch(err => { if (!cancelled) setError(String(err)); });

    return () => { cancelled = true; };
  }, [selectedPlugin]);

  return (
    <div ref={ref} style={style} className={`dashboard-panel ${className ?? ""}`} {...rest}>
      <div className="dashboard-panel-header">
        <span className="dashboard-panel-title">{title}</span>
        {selectedPlugin && (
          <button
            className="dashboard-panel-header-btn"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setModalOpen(true)}
          >
            &#8943;
          </button>
        )}
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
      <div className="dashboard-panel-body">
        {!selectedPlugin && !modalOpen && (
          <div className="dashboard-panel-empty">
            No plugin selected
            <button className="dashboard-panel-select-btn" onClick={() => setModalOpen(true)}>
              Select plugin
            </button>
          </div>
        )}
        {selectedPlugin && error && (
          <div className="dashboard-panel-error">{error}</div>
        )}
        {selectedPlugin && html != null && (
          <div className="dashboard-panel-html" dangerouslySetInnerHTML={{__html: html}} />
        )}
      </div>

      {children}

      <Modal open={modalOpen} title="Select plugin" onClose={() => setModalOpen(false)}>
        {plugins.length === 0 ? (
          <div className="dashboard-panel-empty">No plugins available</div>
        ) : (
          <ul className="dashboard-panel-plugin-list">
            {plugins.map(p => (
              <li key={p.name}>
                <button onClick={() => handleSelect(p)}>
                    <span className="dashboard-panel-plugin-name">{p.name}</span>
                    <span className="dashboard-panel-plugin-meta">{p.author} &middot; v{p.version}</span>
                  </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

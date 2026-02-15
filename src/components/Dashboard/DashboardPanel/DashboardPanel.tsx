import {useState, type ReactNode, type Ref} from "react";
import {useSelector} from "@/lib/stores/store.ts";
import pluginsStore from "@/lib/stores/plugins";
import {layoutApi} from "@/lib/stores/api.ts";
import type {PluginInfo} from "@/types/stores";
import {Modal} from "@/components/Modal";
import {PluginLoader} from "@/components/Dashboard/PluginLoader/PluginLoader.tsx";
import "./DashboardPanel.scss";

interface DashboardPanelProps {
  title: string;
  boxId: string;
  pluginId?: string;
  children?: ReactNode;
  onClose?: () => void;
  ref?: Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  className?: string;
}

export function DashboardPanel({title, boxId, pluginId, children, onClose, ref, style, className, ...rest}: DashboardPanelProps) {
  const plugins = useSelector(pluginsStore.selectors.items);
  const [modalOpen, setModalOpen] = useState(false);
  const selectedPlugin = plugins.find(p => p.id === pluginId) ?? null;
  const pluginMissing = !!pluginId && !selectedPlugin;

  const handleSelect = (plugin: PluginInfo) => {
    layoutApi.setBoxPlugin({id: boxId, plugin: plugin.id});
    setModalOpen(false);
  };

  return (
    <div ref={ref} style={style} className={`dashboard-panel ${className ?? ""}`} {...rest}>
      <div className="dashboard-panel-header">
        <span className="dashboard-panel-title">{title}</span>
        {(selectedPlugin || pluginMissing) && (
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
        {pluginMissing && (
          <div className="dashboard-panel-empty">
            Plugin not found
            <button className="dashboard-panel-select-btn" onClick={() => setModalOpen(true)}>
              Select plugin
            </button>
          </div>
        )}
        {!selectedPlugin && !pluginMissing && !modalOpen && (
          <div className="dashboard-panel-empty">
            No plugin selected
            <button className="dashboard-panel-select-btn" onClick={() => setModalOpen(true)}>
              Select plugin
            </button>
          </div>
        )}
        {selectedPlugin && <PluginLoader plugin={selectedPlugin} />}
      </div>

      {children}

      <Modal open={modalOpen} title="Select plugin" onClose={() => setModalOpen(false)}>
        {plugins.length === 0 ? (
          <div className="dashboard-panel-empty">No plugins available</div>
        ) : (
          <ul className="dashboard-panel-plugin-list">
            {plugins.map(p => (
              <li key={p.id}>
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

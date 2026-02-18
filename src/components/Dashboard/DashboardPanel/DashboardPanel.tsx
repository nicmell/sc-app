import {useState, type ReactNode, type Ref} from "react";
import {useSelector} from "@/lib/stores/store.ts";
import pluginsStore from "@/lib/stores/plugins";
import {layoutApi} from "@/lib/stores/api.ts";
import type {PluginInfo} from "@/types/stores";
import {Modal} from "@/components/ui/Modal";
import {PluginList} from "@/components/PluginList";
import {PluginLoader} from "@/components/Dashboard/PluginLoader/PluginLoader.tsx";
import {Button} from "@/components/ui/Button";
import {IconButton} from "@/components/ui/IconButton";
import cn from "classnames";
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
    <div ref={ref} style={style} className={cn("dashboard-panel", className)} {...rest}>
      <div className="dashboard-panel-header">
        <span className="dashboard-panel-title">{title}</span>
        {(selectedPlugin || pluginMissing) && (
          <IconButton
            size="sm"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setModalOpen(true)}
            aria-label="Change plugin"
          >
            &#8943;
          </IconButton>
        )}
        {onClose && (
          <IconButton
            size="sm"
            onMouseDown={e => e.stopPropagation()}
            onClick={onClose}
            aria-label="Close panel"
          >
            &times;
          </IconButton>
        )}
      </div>
      <div className="dashboard-panel-body">
        {pluginMissing && (
          <div className="dashboard-panel-empty">
            Plugin not found
            <Button size="sm" onClick={() => setModalOpen(true)}>
              Select plugin
            </Button>
          </div>
        )}
        {!selectedPlugin && !pluginMissing && !modalOpen && (
          <div className="dashboard-panel-empty">
            No plugin selected
            <Button size="sm" onClick={() => setModalOpen(true)}>
              Select plugin
            </Button>
          </div>
        )}
        {selectedPlugin && <PluginLoader pluginId={selectedPlugin.id} />}
      </div>

      {children}

      <Modal open={modalOpen} title="Select plugin" onClose={() => setModalOpen(false)}>
        <PluginList onSelect={handleSelect} />
      </Modal>
    </div>
  );
}

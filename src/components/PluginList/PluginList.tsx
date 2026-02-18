import {useRef, useState} from "react";
import {useSelector} from "@/lib/stores/store";
import pluginsStore from "@/lib/stores/plugins";
import type {PluginInfo} from "@/types/stores";
import {pluginManager} from "@/lib/plugins/PluginManager";
import {Modal} from "@/components/ui/Modal";
import {Button} from "@/components/ui/Button";
import {IconButton} from "@/components/ui/IconButton";
import "./PluginList.scss";

interface PluginListProps {
  onSelect?: (plugin: PluginInfo) => void;
  onRemove?: (plugin: PluginInfo) => void;
  showDetails?: boolean;
}

export function PluginList({onSelect, onRemove, showDetails}: PluginListProps) {
  const plugins = useSelector(pluginsStore.selectors.items);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pluginError, setPluginError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState(false);

  const handleAddPlugin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPluginError(null);
    try {
      await pluginManager.addPlugin(file);
    } catch (err) {
      setPluginError(err instanceof Error ? err.message : String(err));
    }
    e.target.value = "";
  };

  return (
    <div className="plugin-list-root">
      {plugins.length > 0 && (
        <ul className="plugin-list">
          {plugins.map(p => (
            <li key={p.id} className="plugin-list-item">
              {onSelect ? (
                <button className="plugin-list-select-btn" onClick={() => onSelect(p)}>
                  <span className="plugin-list-name">{p.name}</span>
                  <span className="plugin-list-meta">{p.author} &middot; v{p.version}</span>
                </button>
              ) : (
                <div className="plugin-list-info">
                  <span className="plugin-list-name">{p.name}</span>
                  <span className="plugin-list-meta">{p.author} &middot; v{p.version}</span>
                  {showDetails && p.error && (
                    <span className="plugin-list-error">
                      Error {p.error.code}: {p.error.message}
                    </span>
                  )}
                </div>
              )}
              {onRemove && (
                <IconButton size="sm" onClick={() => onRemove(p)} aria-label="Remove plugin">
                  &times;
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}

      {pluginError && (
        <div className="plugin-list-add-error">
          Failed to add plugin.{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); setErrorDetail(true); }}>
            See details
          </a>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        hidden
        onChange={handleAddPlugin}
      />
      <Button
        variant="dashed"
        fullWidth
        onClick={() => fileInputRef.current?.click()}
      >
        Add plugin
      </Button>

      <Modal open={errorDetail} title="Plugin error" className="plugin-list-error-modal" onClose={() => setErrorDetail(false)}>
        <pre className="plugin-list-error-detail">{pluginError}</pre>
      </Modal>
    </div>
  );
}

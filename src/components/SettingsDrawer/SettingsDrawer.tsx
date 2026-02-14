import {useRef, useState} from "react";
import {useSelector} from "@/lib/stores/store";
import {layoutApi, themeApi, pluginsApi} from "@/lib/stores/api";
import layoutStore from "@/lib/stores/layout";
import themeStore from "@/lib/stores/theme";
import pluginsStore from "@/lib/stores/plugins";
import type {Mode, PluginInfo} from "@/types/stores";
import {installPlugin, removePlugin} from "@/lib/storage/pluginStorage";
import "./SettingsDrawer.scss";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({open, onClose}: SettingsDrawerProps) {
  const mode = useSelector(themeStore.selectors.mode);
  const primaryColor = useSelector(themeStore.selectors.primaryColor);
  const {numRows, numColumns} = useSelector(layoutStore.selectors.options);
  const plugins = useSelector(pluginsStore.selectors.items);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pluginError, setPluginError] = useState<string | null>(null);

  const handleAddPlugin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPluginError(null);
    try {
      const info = await installPlugin(file);
      pluginsApi.addPlugin(info);
    } catch (err) {
      setPluginError(err instanceof Error ? err.message : String(err));
    }
    e.target.value = "";
  };

  const handleRemovePlugin = async (plugin: PluginInfo) => {
    await removePlugin(plugin.name, plugin.version);
    pluginsApi.removePlugin(plugin.name);
  };

  return (
    <>
      {open && <div className="settings-overlay" onClick={onClose} />}
      <div className={`settings-drawer ${open ? "open" : ""}`}>
        <div className="settings-drawer-header">
          <h2>Settings</h2>
          <button className="settings-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-drawer-body">
          <section className="settings-section">
            <h3>Theme</h3>
            <label className="settings-field">
              <span>Mode</span>
              <select
                value={mode}
                onChange={(e) => themeApi.setMode(e.target.value as Mode)}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Primary Color</span>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => themeApi.setPrimaryColor(e.target.value)}
              />
            </label>
          </section>

          <section className="settings-section">
            <h3>Layout</h3>
            <label className="settings-field">
              <span>Rows</span>
              <input
                type="number"
                min={1}
                max={24}
                value={numRows}
                onChange={(e) => layoutApi.setOptions({numRows: Number(e.target.value)})}
              />
            </label>
            <label className="settings-field">
              <span>Columns</span>
              <input
                type="number"
                min={1}
                max={24}
                value={numColumns}
                onChange={(e) => layoutApi.setOptions({numColumns: Number(e.target.value)})}
              />
            </label>
          </section>

          <section className="settings-section">
            <h3>Plugins</h3>
            {plugins.length > 0 && (
              <ul className="plugin-list">
                {plugins.map(p => (
                  <li key={p.name} className="plugin-item">
                    <div className="plugin-info">
                      <span className="plugin-name">{p.name}</span>
                      <span className="plugin-meta">{p.author} &middot; v{p.version}</span>
                    </div>
                    <button
                      className="plugin-delete-btn"
                      onClick={() => handleRemovePlugin(p)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pluginError && <div className="plugin-error">{pluginError}</div>}
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              hidden
              onChange={handleAddPlugin}
            />
            <button
              className="add-plugin-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Add plugin
            </button>
          </section>
        </div>
      </div>
    </>
  );
}

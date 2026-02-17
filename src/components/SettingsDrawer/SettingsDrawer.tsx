import {useRef, useState} from "react";
import {useSelector} from "@/lib/stores/store";
import {layoutApi, themeApi} from "@/lib/stores/api";
import layoutStore from "@/lib/stores/layout";
import themeStore from "@/lib/stores/theme";
import pluginsStore from "@/lib/stores/plugins";
import type {Mode, PluginInfo} from "@/types/stores";
import {pluginManager} from "@/lib/plugins/PluginManager";
import {Modal} from "@/components/Modal";
import cn from "classnames";
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
  const layoutItems = useSelector(layoutStore.selectors.items);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pluginError, setPluginError] = useState<string | null>(null);
  const [confirmPlugin, setConfirmPlugin] = useState<PluginInfo | null>(null);
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

  const handleRemovePlugin = (plugin: PluginInfo) => {
    const inUse = layoutItems.some(box => box.plugin === plugin.id);
    if (inUse) {
      setConfirmPlugin(plugin);
    } else {
      pluginManager.removePlugin(plugin);
    }
  };

  const confirmRemove = async () => {
    if (confirmPlugin) {
      await pluginManager.removePlugin(confirmPlugin);
      setConfirmPlugin(null);
    }
  };

  return (
    <>
      {open && <div className="settings-overlay" onClick={onClose} />}
      <div className={cn("settings-drawer", {open})}>
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
                  <li key={p.id} className="plugin-item">
                    <div className="plugin-info">
                      <span className="plugin-name">{p.name}</span>
                      <span className="plugin-meta">{p.author} &middot; v{p.version}</span>
                      {p.error && (
                        <span className="plugin-error">
                          Error {p.error.code}: {p.error.message}
                        </span>
                      )}
                      {p.violations && p.violations.length > 0 && (
                        <details className="plugin-violations">
                          <summary>
                            {p.violations.length} sanitization{" "}
                            {p.violations.length === 1 ? "violation" : "violations"}
                          </summary>
                          <ul>
                            {p.violations.map((v, i) => (
                              <li key={i}>{v}</li>
                            ))}
                          </ul>
                        </details>
                      )}
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
            {pluginError && (
              <div className="plugin-error">
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
            <button
              className="add-plugin-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Add plugin
            </button>
          </section>
        </div>
      </div>

      <Modal open={errorDetail} title="Plugin error" className="plugin-error-modal" onClose={() => setErrorDetail(false)}>
        <pre className="plugin-error-detail">{pluginError}</pre>
      </Modal>

      <Modal open={!!confirmPlugin} title="Remove plugin" onClose={() => setConfirmPlugin(null)}>
        <p>
          Plugin <strong>{confirmPlugin?.name}</strong> is currently used by one or more panels.
          Removing it will unmount those panels.
        </p>
        <div style={{display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem"}}>
          <button onClick={() => setConfirmPlugin(null)}>Cancel</button>
          <button className="plugin-delete-btn" onClick={confirmRemove}>Remove</button>
        </div>
      </Modal>
    </>
  );
}

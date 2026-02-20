import {useState} from "react";
import {useSelector} from "@/lib/stores/store";
import {layoutApi, themeApi} from "@/lib/stores/api";
import layoutStore from "@/lib/stores/layout";
import themeStore from "@/lib/stores/theme";
import type {Mode, PluginInfo} from "@/types/stores";
import {pluginManager} from "@/lib/plugins/PluginManager";
import {oscService} from "@/lib/osc";
import {Modal} from "@/components/ui/Modal";
import {PluginList} from "@/components/PluginList";
import {Button} from "@/components/ui/Button";
import {IconButton} from "@/components/ui/IconButton";
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
  const layoutItems = useSelector(layoutStore.selectors.items);
  const [confirmPlugin, setConfirmPlugin] = useState<PluginInfo | null>(null);

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
          <IconButton size="lg" onClick={onClose} aria-label="Close">×</IconButton>
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
                <option value="adaptive">Adaptive</option>
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
            <PluginList showDetails onRemove={handleRemovePlugin} />
          </section>

          <div className="settings-drawer-footer">
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              className="settings-disconnect-btn"
              onClick={() => oscService.disconnect()}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </div>

      <Modal open={!!confirmPlugin} title="Remove plugin" onClose={() => setConfirmPlugin(null)}>
        <p>
          Plugin <strong>{confirmPlugin?.name}</strong> is currently used by one or more panels.
          Removing it will unmount those panels.
        </p>
        <div style={{display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem"}}>
          <button onClick={() => setConfirmPlugin(null)}>Cancel</button>
          <button className="settings-confirm-remove-btn" onClick={confirmRemove}>Remove</button>
        </div>
      </Modal>
    </>
  );
}

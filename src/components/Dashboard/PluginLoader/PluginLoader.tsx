import {useRef, useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {useSelector} from "@/lib/stores/store.ts";
import themeStore from "@/lib/stores/theme";
import pluginsStore from "@/lib/stores/plugins";
import {pluginManager} from "@/lib/plugins/PluginManager";

const palettes: Record<string, Record<string, string>> = {
  dark: {
    "--color-bg": "#2f2f2f",
    "--color-text": "#f6f6f6",
    "--color-surface": "#0f0f0f98",
    "--color-surface-active": "#0f0f0f69",
    "--color-border": "#555",
    "--color-panel-header": "#3a3a3a",
  },
  light: {
    "--color-bg": "#f6f6f6",
    "--color-text": "#0f0f0f",
    "--color-surface": "#ffffff",
    "--color-surface-active": "#e8e8e8",
    "--color-border": "#ccc",
    "--color-panel-header": "#e8e8e8",
  },
};

function useShadowRoot() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setRoot(host.shadowRoot ?? host.attachShadow({mode: "open"}));
  }, []);

  return {hostRef, root};
}

interface PluginLoaderProps {
  pluginId: string;
}

export function PluginLoader({pluginId}: PluginLoaderProps) {
  const plugin = useSelector(pluginsStore.selectors.getById(pluginId));
  const mode = useSelector(themeStore.selectors.mode);
  const primaryColor = useSelector(themeStore.selectors.primaryColor);
  const {hostRef, root} = useShadowRoot();
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!plugin || plugin.loaded !== undefined || !root) return;
    const el = document.createElement("sc-group");
    containerRef.current = el;
    pluginManager.loadPlugin(plugin, el);
  }, [plugin?.id, plugin?.loaded, root]);

  useEffect(() => {
    if (!root || !plugin?.loaded || !containerRef.current) return;
    root.appendChild(containerRef.current);
  }, [plugin?.loaded, root]);

  if (!plugin) return null;

  const palette = palettes[mode] ?? palettes.dark;
  const vars = Object.entries(palette).map(([k, v]) => `${k}:${v}`).join(";");
  const themeCss = `:host{--color-primary:${primaryColor};${vars}}`;

  return (
    <div ref={hostRef}>
      {root && createPortal(
        <>
          <style>{themeCss}</style>
          {plugin.error ? (
            <div style={{color: '#e57373', fontSize: '0.85rem', padding: '0.5rem 0'}}>
              Error {plugin.error.code}: {plugin.error.message}
            </div>
          ) : !plugin.loaded && (
            <div style={{fontSize: '0.85rem', padding: '0.5rem 0', opacity: 0.6}}>
              Loading...
            </div>
          )}
        </>,
        root as unknown as Element,
      )}
    </div>
  );
}

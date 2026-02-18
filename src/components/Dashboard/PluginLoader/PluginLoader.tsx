import {useRef, useEffect} from "react";
import {useSelector} from "@/lib/stores/store.ts";
import pluginsStore from "@/lib/stores/plugins";
import {pluginManager} from "@/lib/plugins/PluginManager";

interface PluginLoaderProps {
  pluginId: string;
}

export function PluginLoader({pluginId}: PluginLoaderProps) {
  const plugin = useSelector(pluginsStore.selectors.getById(pluginId));
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!plugin || plugin.loaded !== undefined) return;
    containerRef.current = document.createElement("sc-group");
    pluginManager.loadPlugin(plugin, containerRef.current);
  }, [plugin?.id, plugin?.loaded]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !plugin?.loaded || !containerRef.current) return;
    const root = host.shadowRoot ?? host.attachShadow({mode: "open"});
    root.appendChild(containerRef.current);
  }, [plugin?.loaded]);

  if (!plugin) return null;

  if (plugin.error) {
    return (
      <div style={{color: '#e57373', fontSize: '0.85rem', padding: '0.5rem 0'}}>
        Error {plugin.error.code}: {plugin.error.message}
      </div>
    );
  }

  if (!plugin.loaded) {
    return (
      <div style={{fontSize: '0.85rem', padding: '0.5rem 0', opacity: 0.6}}>
        Loading...
      </div>
    );
  }

  return <div ref={hostRef} />;
}

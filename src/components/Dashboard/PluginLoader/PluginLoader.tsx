import {type ReactNode, useRef, useEffect} from "react";
import {useSelector} from "@/lib/stores/store.ts";
import pluginsStore from "@/lib/stores/plugins";
import {pluginManager} from "@/lib/plugins/PluginManager";

interface PluginLoaderProps {
  pluginId: string;
  fallback?: ReactNode;
}

export function PluginLoader({pluginId, fallback}: PluginLoaderProps) {
  const plugin = useSelector(pluginsStore.selectors.getById(pluginId));
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement>(null);

  const pluginExists = !!plugin;

  useEffect(() => {
    const host = hostRef.current;
    const container = containerRef.current
    if (!pluginExists || !host || container) return;

    const root = host.shadowRoot ?? host.attachShadow({mode: "open"});
    containerRef.current = document.createElement("sc-group");
    pluginManager.loadPlugin(pluginId, containerRef.current);
    root.appendChild(containerRef.current);

  }, [pluginId, pluginExists]);

  if (!pluginExists) return fallback;

  return (
    <div ref={hostRef}>
      {plugin.error ? (
        <div style={{color: '#e57373', fontSize: '0.85rem', padding: '0.5rem 0'}}>
          Error {plugin.error.code}: {plugin.error.message}
        </div>
      ) : !plugin.loaded && (
        <div style={{fontSize: '0.85rem', padding: '0.5rem 0', opacity: 0.6}}>
          Loading...
        </div>
      )}
    </div>
  );
}

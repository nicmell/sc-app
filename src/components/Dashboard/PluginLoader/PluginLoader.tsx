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

  const pluginExists = !!plugin;

  useEffect(() => {
    const host = hostRef.current;
    if (!pluginExists || !host) return;

    const root = host.shadowRoot ?? host.attachShadow({mode: "open"});
    const container = document.createElement("sc-group");
    root.appendChild(container);
    pluginManager.loadPlugin(pluginId, container);

    return () => {
      container.remove();
    };
  }, [pluginId, pluginExists]);

  if (!plugin) return fallback ?? null;

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

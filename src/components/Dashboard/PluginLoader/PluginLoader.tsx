import {PropsWithChildren, useEffect, useRef} from "react";
import {layoutApi} from "@/lib/stores/api";
import {pluginManager} from "@/lib/plugins/PluginManager";
import type {BoxItem, PluginInfo} from "@/types/stores";

interface PluginLoaderProps extends PropsWithChildren {
  box: BoxItem;
  plugin: PluginInfo;
}

export function PluginLoader({box, plugin}: PluginLoaderProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const root = host?.shadowRoot ?? host?.attachShadow({mode: "open"});
    if (!root || root.contains(containerRef.current)) return;

    containerRef.current = document.createElement("sc-group");
    root.appendChild(containerRef.current);

    const container = containerRef.current;
    pluginManager.loadPlugin(plugin.id).then(html => {
      container.innerHTML = html;
      layoutApi.loadPlugin({id: box.i, loaded: true});
    }).catch(e => {
      const error = e instanceof Error ? e.message : String(e);
      layoutApi.loadPlugin({id: box.i, loaded: false, error});
    });

  }, [box.i, plugin.id]);

  return (
    <div ref={hostRef}>
      {box.error ? (
        <div style={{color: '#e57373', fontSize: '0.85rem', padding: '0.5rem 0'}}>
          {box.error}
        </div>
      ) : !box.loaded && (
        <div style={{fontSize: '0.85rem', padding: '0.5rem 0', opacity: 0.6}}>
          Loading...
        </div>
      )}
    </div>
  );
}

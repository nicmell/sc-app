import {useRef, useEffect} from "react";
import type {PluginInfo} from "@/types/stores";
import {pluginManager} from "@/lib/plugins/PluginManager";

interface PluginLoaderProps {
  plugin: PluginInfo;
}

export function PluginLoader({plugin}: PluginLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const shadow = container.shadowRoot ?? container.attachShadow({mode: 'open'});
    const html = pluginManager.getHtml(plugin.name);

    if (html) {
      shadow.innerHTML = html as unknown as string;
    } else if (plugin.error) {
      shadow.innerHTML = '';
    }

    return () => {
      const s = containerRef.current?.shadowRoot;
      if (s) s.innerHTML = '';
    };
  }, [plugin.name, plugin.error]);

  if (plugin.error) {
    return (
      <div style={{color: '#e57373', fontSize: '0.85rem', padding: '0.5rem 0'}}>
        Error {plugin.error.code}: {plugin.error.message}
      </div>
    );
  }

  return <div ref={containerRef} />;
}

import {useRef, useEffect, useCallback, useState} from "react";
import type {PluginInfo} from "@/types/stores";
import {pluginManager, type SanitizeViolation} from "@/lib/plugins/PluginManager";

interface PluginLoaderProps {
  plugin: PluginInfo;
}

export function PluginLoader({plugin}: PluginLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [violations, setViolations] = useState<SanitizeViolation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadPlugin = useCallback(async (p: PluginInfo) => {
    const container = containerRef.current;
    if (!container) return;

    const shadow = container.shadowRoot ?? container.attachShadow({mode: 'open'});

    try {
      const result = await pluginManager.load(p);
      shadow.innerHTML = result.html as unknown as string;
      setViolations(result.violations);
      setError(null);
    } catch (e) {
      shadow.innerHTML = '';
      setViolations([]);
      setError(e instanceof Error ? e.message : 'Failed to load plugin');
    }
  }, []);

  useEffect(() => {
    loadPlugin(plugin);
    return () => {
      const shadow = containerRef.current?.shadowRoot;
      if (shadow) shadow.innerHTML = '';
    };
  }, [plugin, loadPlugin]);

  return (
    <>
      {error && (
        <div style={{color: '#e57373', fontSize: '0.85rem', padding: '0.5rem 0'}}>
          Error: {error}
        </div>
      )}
      {violations.length > 0 && (
        <details style={{fontSize: '0.8rem', marginBottom: '0.5rem'}}>
          <summary style={{cursor: 'pointer', color: '#ffb74d'}}>
            {violations.length} sanitization {violations.length === 1 ? 'violation' : 'violations'}
          </summary>
          <ul style={{margin: '0.25rem 0', paddingLeft: '1.25rem', opacity: 0.8}}>
            {violations.map((v, i) => (
              <li key={i}>{v.detail}</li>
            ))}
          </ul>
        </details>
      )}
      <div ref={containerRef} />
    </>
  );
}

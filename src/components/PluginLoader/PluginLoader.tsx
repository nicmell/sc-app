import {useRef, useEffect, useState, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {useSelector} from "@/lib/stores/store";
import themeStore from "@/lib/stores/theme";
import type {PluginInfo} from "@/types/stores";
import {pluginManager} from "@/lib/plugins/PluginManager";

const darkPalette: Record<string, string> = {
  "--color-bg": "#2f2f2f",
  "--color-text": "#f6f6f6",
  "--color-surface": "#0f0f0f98",
  "--color-surface-active": "#0f0f0f69",
  "--color-border": "#555",
  "--color-panel-header": "#3a3a3a",
};

const lightPalette: Record<string, string> = {
  "--color-bg": "#f6f6f6",
  "--color-text": "#0f0f0f",
  "--color-surface": "#ffffff",
  "--color-surface-active": "#e8e8e8",
  "--color-border": "#ccc",
  "--color-panel-header": "#e8e8e8",
};

function buildThemeCss(mode: string, primaryColor: string): string {
  const palette = mode === "dark" ? darkPalette : lightPalette;
  const vars = Object.entries(palette)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return `:host{--color-primary:${primaryColor};${vars}}`;
}

interface ShadowRootProps {
  mode?: ShadowRootMode;
  delegatesFocus?: boolean;
  children: ReactNode;
}

function ShadowRoot({mode = "open", delegatesFocus = false, children}: ShadowRootProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shadowRoot, setShadowRoot] = useState<globalThis.ShadowRoot | null>(null);
  const themeMode = useSelector(themeStore.selectors.mode);
  const primaryColor = useSelector(themeStore.selectors.primaryColor);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({mode, delegatesFocus});
    setShadowRoot(root);
  }, [mode, delegatesFocus]);

  return (
    <div ref={hostRef}>
      {shadowRoot && createPortal(
        <>
          <style>{buildThemeCss(themeMode, primaryColor)}</style>
          {children}
        </>,
        shadowRoot as unknown as Element,
      )}
    </div>
  );
}

interface PluginLoaderProps {
  plugin: PluginInfo;
}

export function PluginLoader({plugin}: PluginLoaderProps) {
  const html = pluginManager.getHtml(plugin.id);

  if (plugin.error) {
    return (
      <div style={{color: '#e57373', fontSize: '0.85rem', padding: '0.5rem 0'}}>
        Error {plugin.error.code}: {plugin.error.message}
      </div>
    );
  }

  if (!html) return null;

  return (
    <ShadowRoot>
      <div dangerouslySetInnerHTML={{__html: html as unknown as string}} />
    </ShadowRoot>
  );
}

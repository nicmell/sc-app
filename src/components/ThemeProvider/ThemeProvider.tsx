import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useSelector } from "@/lib/stores/store";
import theme from "@/lib/stores/theme";

const darkPalette = {
  "--color-bg": "#2f2f2f",
  "--color-text": "#f6f6f6",
  "--color-surface": "#0f0f0f98",
  "--color-surface-active": "#0f0f0f69",
  "--color-border": "#555",
  "--color-panel-header": "#3a3a3a",
  "--color-log-bg": "#1a1a1a",
  "--color-log-text": "#00ff00",
};

const lightPalette = {
  "--color-bg": "#f6f6f6",
  "--color-text": "#0f0f0f",
  "--color-surface": "#ffffff",
  "--color-surface-active": "#e8e8e8",
  "--color-border": "#ccc",
  "--color-panel-header": "#e8e8e8",
  "--color-log-bg": "#1a1a1a",
  "--color-log-text": "#00ff00",
};

const mq = window.matchMedia("(prefers-color-scheme: dark)");

function useSystemDark() {
  return useSyncExternalStore(
    (cb) => { mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => mq.matches,
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSelector(theme.selectors.mode);
  const primaryColor = useSelector(theme.selectors.primaryColor);
  const systemDark = useSystemDark();

  const effectiveMode = mode === "adaptive" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    const palette = effectiveMode === "dark" ? darkPalette : lightPalette;
    const root = document.documentElement;

    root.style.setProperty("--color-primary", primaryColor);
    for (const [key, value] of Object.entries(palette)) {
      root.style.setProperty(key, value);
    }
  }, [effectiveMode, primaryColor]);

  return <>{children}</>;
}

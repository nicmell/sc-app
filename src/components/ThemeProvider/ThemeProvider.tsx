import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Mode = "dark" | "light";

interface ThemeContextValue {
  mode: Mode;
  primaryColor: string;
  setMode: (mode: Mode) => void;
  setPrimaryColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("dark");
  const [primaryColor, setPrimaryColor] = useState("#396cd8");

  useEffect(() => {
    const palette = mode === "dark" ? darkPalette : lightPalette;
    const root = document.documentElement;

    root.style.setProperty("--color-primary", primaryColor);
    for (const [key, value] of Object.entries(palette)) {
      root.style.setProperty(key, value);
    }
  }, [mode, primaryColor]);

  return (
    <ThemeContext.Provider value={{ mode, primaryColor, setMode, setPrimaryColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

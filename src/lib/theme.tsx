import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; set: (t: Theme) => void }>({
  theme: "dark",
  toggle: () => {},
  set: () => {},
});

const STORAGE_KEY = "mc-theme";

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as Theme | null;
    const initial: Theme = stored === "light" || stored === "dark" ? stored : "dark";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const set = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  };

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => set(theme === "dark" ? "light" : "dark"), set }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);

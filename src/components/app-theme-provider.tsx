"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { APP_THEME_STORAGE_KEY } from "@/constants/theme-storage";

export type AppTheme = "dark" | "light" | "system";

type AppThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function resolveAppliedTheme(theme: AppTheme): "dark" | "light" {
  if (theme === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyThemeClass(applied: "dark" | "light"): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(applied);
}

interface AppThemeProviderProps {
  children: ReactNode;
  /** Matches prior next-themes default. */
  defaultTheme?: AppTheme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function AppThemeProvider({
  children,
  defaultTheme = "dark",
  enableSystem = true,
  disableTransitionOnChange = false,
}: AppThemeProviderProps) {
  const [theme, setThemeState] = useState<AppTheme>(defaultTheme);
  const hasHydratedThemeRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = window.localStorage.getItem(
          APP_THEME_STORAGE_KEY,
        ) as AppTheme | null;
        if (stored === "light" || stored === "dark") {
          setThemeState(stored);
          hasHydratedThemeRef.current = true;
          return;
        }
        if (stored === "system" && enableSystem) {
          setThemeState("system");
          hasHydratedThemeRef.current = true;
          return;
        }
      } catch {
        /* ignore */
      }
      setThemeState(defaultTheme);
      hasHydratedThemeRef.current = true;
    });
  }, [defaultTheme, enableSystem]);

  useEffect(() => {
    const applied = resolveAppliedTheme(theme);

    if (disableTransitionOnChange) {
      const root = document.documentElement;
      const previous = root.style.transition;
      root.style.transition = "none";
      applyThemeClass(applied);
      requestAnimationFrame(() => {
        root.style.transition = previous;
      });
      return;
    }

    applyThemeClass(applied);
  }, [disableTransitionOnChange, theme]);

  useEffect(() => {
    if (!hasHydratedThemeRef.current) return;
    try {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    if (!enableSystem || theme !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeClass(resolveAppliedTheme("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [enableSystem, theme]);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return ctx;
}

function subscribePreferredDark(onStoreChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getPreferredDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** SSR default until client resolves stored preference or system. */
function getPreferredDarkServerSnapshot(): boolean {
  return true;
}

/** Resolved light/dark for UI that cannot use `system` during SSR (e.g. Sonner). */
export function useResolvedTheme(): "dark" | "light" {
  const { theme } = useAppTheme();
  const prefersDark = useSyncExternalStore(
    subscribePreferredDark,
    getPreferredDarkSnapshot,
    getPreferredDarkServerSnapshot,
  );

  if (theme === "system") {
    return prefersDark ? "dark" : "light";
  }
  return theme;
}

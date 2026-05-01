"use client";

import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_THEME_STORAGE_KEY,
  dashboardSportThemeOptions,
  dashboardThemeAccentGlowClass,
  dashboardThemeSurfaceClass,
  parseDashboardSportTheme,
  type DashboardSportTheme,
} from "@/constants/dashboard-theme";

export function DashboardThemeShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [theme, setTheme] = useState<DashboardSportTheme>("general");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored = parseDashboardSportTheme(
          window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY),
        );
        setTheme(stored);
      } catch {
        setTheme("general");
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function persist(next: DashboardSportTheme): void {
    setTheme(next);
    try {
      window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }

  return (
    <div
      className={cn(
        "relative isolate min-h-screen overflow-x-hidden transition-[background] duration-500 ease-out",
        dashboardThemeSurfaceClass[theme],
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500",
          dashboardThemeAccentGlowClass[theme],
        )}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] dark:opacity-[0.06]">
        <div
          className="h-full w-full bg-[linear-gradient(rgba(0,0,0,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.14)_1px,transparent_1px)] bg-size-[48px_48px] dark:bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)]"
          aria-hidden
        />
      </div>

      <div className="sticky top-0 z-20 border-b border-border/40 bg-background/55 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Floor theme</span>
              <span className="hidden sm:inline"> — </span>
              <span className="block sm:inline">
                {dashboardSportThemeOptions.find((o) => o.id === theme)?.hint ?? ""}
              </span>
            </div>
          </div>
          <div
            className="flex flex-wrap gap-1.5 sm:justify-end"
            role="radiogroup"
            aria-label="Dashboard sport background"
          >
            {dashboardSportThemeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={theme === opt.id}
                disabled={!hydrated}
                onClick={() => persist(opt.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  theme === opt.id
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/70 bg-background/70 text-foreground hover:bg-accent hover:text-accent-foreground",
                  !hydrated && "opacity-60",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}

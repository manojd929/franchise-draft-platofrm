"use client";

import type { ReactNode } from "react";

import { useDashboardAppearance } from "@/features/dashboard/dashboard-appearance-provider";
import { DashboardFloorBackdropShell } from "@/features/dashboard/dashboard-floor-backdrop-layers";
import { cn } from "@/lib/utils";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const intValue = Number.parseInt(normalized, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

export function TournamentThemeShell({
  tournamentColorHex,
  children,
}: Readonly<{
  tournamentColorHex: string | null;
  children: ReactNode;
}>) {
  const { floorTheme } = useDashboardAppearance();
  const accentRgb = tournamentColorHex ? hexToRgb(tournamentColorHex) : null;
  const accentGlow = accentRgb
    ? `radial-gradient(ellipse 72% 42% at 14% -4%, rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.18), transparent 60%), radial-gradient(ellipse 64% 34% at 86% 0%, rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.11), transparent 62%)`
    : null;

  return (
    <DashboardFloorBackdropShell
      theme={floorTheme}
      className={cn(
        "min-h-screen",
        "transition-[background] duration-500 ease-out motion-reduce:transition-none",
      )}
    >
      {accentGlow ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-90 mix-blend-normal"
          style={{ backgroundImage: accentGlow }}
          aria-hidden
        />
      ) : null}
      <div className="relative z-10">{children}</div>
    </DashboardFloorBackdropShell>
  );
}

import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAME, ROUTES } from "@/constants/app";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.72_0.14_230/0.16),transparent_55%),radial-gradient(ellipse_at_bottom,oklch(0.8_0.1_330/0.08),transparent_42%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.25),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(236,72,153,0.12),_transparent_40%)]"
        aria-hidden
      />
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8 md:px-16 md:py-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary sm:text-sm sm:tracking-[0.25em]">
          {APP_NAME}
        </span>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link href={ROUTES.login} className={cn(buttonVariants({ variant: "ghost" }), "min-h-10")}>
            Sign in
          </Link>
          <Link href={ROUTES.dashboard} className={cn(buttonVariants(), "min-h-10")}>
            My tournaments
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pb-16 pt-6 sm:px-8 md:px-16 md:pb-24 md:pt-10">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:text-xs dark:text-sky-300/90">
          Live player auction
        </p>
        <h1 className="mt-4 max-w-4xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:mt-8 sm:text-5xl md:text-6xl lg:text-7xl dark:text-white">
          Run a calm auction for your club with teams, photos, and live rounds.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:mt-8 sm:text-lg md:text-xl dark:text-white/75">
          One organizer runs the computer. Owners pick players by name. Everyone sees the photos at
          the same time. Works on phones and TVs.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:mt-12 sm:flex-row sm:flex-wrap sm:gap-4">
          <Link
            href={ROUTES.tournamentNew}
            className={cn(
              buttonVariants({ size: "lg" }),
              "min-h-12 w-full bg-sky-600 text-white hover:bg-sky-500 sm:w-auto dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300",
            )}
          >
            New tournament
          </Link>
          <Link
            href={ROUTES.login}
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "min-h-12 w-full sm:w-auto")}
          >
            I already have an account
          </Link>
        </div>

        <dl className="mt-12 grid gap-4 sm:mt-20 sm:gap-6 md:grid-cols-3">
          {[
            {
              title: "Easy for the room",
              body: "Live roster board shows every franchise draft, the active round, who is on the clock, and the latest pick — built for projectors.",
            },
            {
              title: "Fair order",
              body: "Press one button to shuffle teams into a fresh fair order for every round.",
            },
            {
              title: "Photos together",
              body: "Filter by group and gender so everyone sees the same wall of faces.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm backdrop-blur-md sm:p-6 dark:border-white/10 dark:bg-white/5 dark:text-white dark:shadow-none"
            >
              <dt className="text-sm font-semibold text-primary dark:text-sky-200/95">{item.title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground dark:text-white/70">
                {item.body}
              </dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  );
}

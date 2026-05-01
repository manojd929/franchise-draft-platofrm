import Link from "next/link";
import { Suspense } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "@/features/auth/login-form";
import { ROUTES } from "@/constants/app";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background px-6 py-16 text-foreground">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-sky-500/[0.07] to-transparent dark:from-sky-500/[0.14]"
        aria-hidden
      />
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4 text-sm">
        <Link href={ROUTES.home} className="text-muted-foreground hover:text-foreground">
          ← Back to landing
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <Link href={ROUTES.dashboard} className="text-muted-foreground hover:text-foreground">
            Dashboard →
          </Link>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="mx-auto max-w-md text-center text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}

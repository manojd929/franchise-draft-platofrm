import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { CreateTournamentForm } from "@/features/tournaments/create-tournament-form";
import { ROUTES } from "@/constants/app";

export default function NewTournamentPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={ROUTES.dashboard} className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="mt-8 text-4xl font-semibold tracking-tight">Launch a tournament</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        We scaffold franchises, squad governance, and realtime draft infrastructure instantly.
      </p>
      <div className="mt-12">
        <CreateTournamentForm />
      </div>
    </div>
  );
}

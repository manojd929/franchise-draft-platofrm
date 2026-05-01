"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncProfileAction } from "@/features/tournaments/actions";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setMessage(null);
    if (!isSupabaseConfigured()) {
      setMessage("Configure Supabase environment variables to enable authentication.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(error.message);
        return;
      }

      const syncResult = await syncProfileAction();
      if (!syncResult.ok) {
        setMessage(syncResult.error);
        return;
      }

      /* Full navigation avoids stale client state after auth cookies are set (router.push alone can leave /login visible). */
      window.location.assign(nextPath);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Auth failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border/70 bg-card/85 p-8 text-card-foreground shadow-lg backdrop-blur-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operator access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Supabase email & password. SSO flows can extend this surface without restructuring routes.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      </div>
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <Button type="button" disabled={isSubmitting} className="w-full" onClick={() => void handleSubmit()}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Need an account?{" "}
        <Link href="/login?view=signup" className="text-primary underline-offset-4 hover:underline">
          Contact your league commissioner
        </Link>
      </p>
    </div>
  );
}

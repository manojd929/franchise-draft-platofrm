"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/constants/app";
import { sanitizeNextPath } from "@/lib/navigation/sanitize-next-path";
import { establishServerSessionAfterPasswordLogin } from "@/features/auth/establish-server-session-action";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get("next"), ROUTES.dashboard);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setMessage(null);
    if (!isSupabaseConfigured()) {
      setMessage("Sign-in is not set up on this site yet. Ask your league organizer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(error.message);
        return;
      }

      const session = data.session;
      if (!session?.access_token || !session.refresh_token) {
        setMessage("Sign-in did not return a session. Try again.");
        return;
      }

      const syncResult = await establishServerSessionAfterPasswordLogin({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (!syncResult.ok) {
        setMessage(syncResult.error);
        return;
      }

      /* Full navigation avoids stale client state after auth cookies are set (router.push alone can leave /login visible). */
      window.location.assign(nextPath);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not sign in. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border/70 bg-card/85 p-8 text-card-foreground shadow-lg backdrop-blur-xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          League organizers and franchise owners use the email and password the commissioner gave
          you. During the auction, franchise owners should open the{" "}
          <span className="font-medium text-foreground">Owner</span> screen after signing in. The same
          login works every week.
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
      <Button
        type="button"
        disabled={isSubmitting}
        className="min-h-12 w-full text-base"
        onClick={() => void handleSubmit()}
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        New franchise owner? Your commissioner creates your login from{" "}
        <span className="font-medium text-foreground">Teams</span>. Forgot password? Ask them to reset
        or re-invite you.
      </p>
    </div>
  );
}

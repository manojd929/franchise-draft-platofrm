"use server";

import { syncUserProfile } from "@/lib/auth/profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { passwordLoginSessionTokensSchema } from "@/validations/auth-session";

export type EstablishSessionActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * After `signInWithPassword`, the browser session exists but the Next server action
 * may not observe fresh auth cookies yet. Passing tokens lets the server run
 * `setSession`, persist cookies via the SSR client, then upsert UserProfile reliably.
 */
export async function establishServerSessionAfterPasswordLogin(
  input: unknown,
): Promise<EstablishSessionActionResult> {
  const parsed = passwordLoginSessionTokensSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Could not finalize sign-in. Try again." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.setSession({
      access_token: parsed.data.access_token,
      refresh_token: parsed.data.refresh_token,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    const user = data.user ?? data.session?.user;
    if (!user) {
      return { ok: false, error: "Sign-in incomplete. Try again." };
    }
    await syncUserProfile(user);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not finalize sign-in.",
    };
  }
}

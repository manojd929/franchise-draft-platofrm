"use server";

import { revalidatePath } from "next/cache";

import { syncUserProfile } from "@/lib/auth/profile";
import { requireSessionUser } from "@/lib/auth/session";
import { createLeagueOwnerAccount } from "@/services/league-account-service";
import {
  assertTournamentOwnership,
  createPlayer,
  createTeam,
  createTournament,
  reconcileSquadRulesForTournament,
  saveSquadRules,
  softDeletePlayer,
  softDeleteTournament,
  TournamentServiceError,
  updatePlayer,
  updateTeam,
  updateTournament,
} from "@/services/tournament-service";
import { createLeagueOwnerSchema } from "@/validations/league-account";
import {
  createPlayerSchema,
  createTeamSchema,
  createTournamentSchema,
  deletePlayerSchema,
  deleteTournamentSchema,
  draftActionSlugSchema,
  squadRulesSchema,
  updatePlayerSchema,
  updateTeamSchema,
  updateTournamentSchema,
} from "@/validations/tournament";

export type TournamentActionResult =
  | { ok: true; slug?: string; email?: string }
  | { ok: false; error: string };

function handle(err: unknown): TournamentActionResult {
  if (err instanceof TournamentServiceError) {
    return { ok: false, error: err.message };
  }
  return { ok: false, error: "Unexpected error. Try again." };
}

export async function syncProfileAction(): Promise<TournamentActionResult> {
  try {
    const user = await requireSessionUser();
    await syncUserProfile(user);
    return { ok: true };
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
}

export async function updateTournamentAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = updateTournamentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid tournament details." };
    const user = await requireSessionUser();
    await updateTournament(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath("/dashboard");
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function createTournamentAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = createTournamentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid tournament details." };
    const user = await requireSessionUser();
    const { slug } = await createTournament(user.id, parsed.data);
    revalidatePath("/dashboard");
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function createTeamAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = createTeamSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid team details." };
    const user = await requireSessionUser();
    await createTeam(user.id, parsed.data);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}`, "layout");
    return { ok: true, slug: parsed.data.tournamentSlug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function updateTeamAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = updateTeamSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid team details." };
    const user = await requireSessionUser();
    await updateTeam(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/teams`);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function deleteTournamentAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = deleteTournamentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid tournament." };
    const user = await requireSessionUser();
    await softDeleteTournament(user.id, parsed.data.tournamentSlug);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function deletePlayerAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = deletePlayerSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid player." };
    const user = await requireSessionUser();
    await softDeletePlayer(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/players`);
    revalidatePath(`/tournament/${slug}/teams`);
    revalidatePath(`/tournament/${slug}/rules`);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function createPlayerAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = createPlayerSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid player details." };
    const user = await requireSessionUser();
    await createPlayer(user.id, parsed.data);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}`, "layout");
    return { ok: true, slug: parsed.data.tournamentSlug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function updatePlayerAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = updatePlayerSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid player details." };
    const user = await requireSessionUser();
    await updatePlayer(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/players`);
    revalidatePath(`/tournament/${slug}/teams`);
    revalidatePath(`/tournament/${slug}/rules`);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function syncSquadRulesToRosterAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid tournament." };
    const user = await requireSessionUser();
    const tournamentId = await assertTournamentOwnership(
      parsed.data.tournamentSlug,
      user.id,
    );
    await reconcileSquadRulesForTournament(tournamentId);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/rules`);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function saveSquadRulesAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = squadRulesSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid squad rules." };
    const user = await requireSessionUser();
    await saveSquadRules(user.id, parsed.data);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}`, "layout");
    return { ok: true, slug: parsed.data.tournamentSlug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function createLeagueOwnerAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = createLeagueOwnerSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Use a valid email and password (at least 8 characters)." };
    }
    const user = await requireSessionUser();
    const { email } = await createLeagueOwnerAccount(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/teams`);
    return { ok: true, email };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

import { z } from "zod";

import { DraftPhase, Gender, PlayerCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  computePerTeamCategoryCaps,
  SQUAD_RULE_CATEGORY_ORDER,
} from "@/lib/squad-rules/compute-per-team-caps";
import {
  formatSquadValidationErrors,
  validateSquadRulesAgainstRoster,
} from "@/lib/squad-rules/validate-squad-rules-against-roster";
import { DEFAULT_PICKS_PER_TEAM } from "@/constants/tournament-defaults";
import { tournamentSlugFromName } from "@/utils/tournament-slug";

import type {
  CreatePlayerInput,
  CreateTeamInput,
  CreateTournamentInput,
  DeletePlayerInput,
  SquadRulesInput,
  UpdatePlayerInput,
  UpdateTeamInput,
  UpdateTournamentInput,
} from "@/validations/tournament";

export class TournamentServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TournamentServiceError";
  }
}

const DEFAULT_SQUAD_RULES = [
  { category: "MEN_ADVANCED" as const, maxCount: 2 },
  { category: "MEN_INTERMEDIATE" as const, maxCount: 4 },
  { category: "MEN_BEGINNER" as const, maxCount: 3 },
  { category: "WOMEN" as const, maxCount: 1 },
];

export async function syncOwnerPlayersForTournament(
  tournamentId: string,
): Promise<void> {
  const teams = await prisma.team.findMany({
    where: { tournamentId, deletedAt: null },
    select: { ownerUserId: true },
  });
  const ownerIds = [
    ...new Set(
      teams.map((t) => t.ownerUserId).filter((id): id is string => Boolean(id)),
    ),
  ];

  const profiles =
    ownerIds.length > 0
      ? await prisma.userProfile.findMany({
          where: { id: { in: ownerIds }, deletedAt: null },
          select: { id: true, email: true, displayName: true },
        })
      : [];

  const linkedPlayers = await prisma.player.findMany({
    where: {
      tournamentId,
      deletedAt: null,
      linkedOwnerUserId: { not: null },
    },
    select: { id: true, linkedOwnerUserId: true, name: true },
  });

  function desiredOwnerName(profile: {
    displayName: string | null;
    email: string;
  }): string {
    const fromDisplay = profile.displayName?.trim();
    if (fromDisplay) return fromDisplay;
    const local = profile.email.split("@")[0]?.trim();
    if (local) return local;
    return "Team owner";
  }

  for (const ownerId of ownerIds) {
    const profile = profiles.find((p) => p.id === ownerId);
    if (!profile) continue;

    const existing = linkedPlayers.find((p) => p.linkedOwnerUserId === ownerId);
    const name = desiredOwnerName(profile);

    if (!existing) {
      await prisma.player.create({
        data: {
          tournamentId,
          name,
          photoUrl: null,
          category: PlayerCategory.MEN_ADVANCED,
          gender: Gender.MALE,
          notes: "Team owner — set category like any player from the Players page.",
          linkedOwnerUserId: ownerId,
        },
      });
    } else {
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          name,
        },
      });
    }
  }

  const staleIds = linkedPlayers
    .filter(
      (p) =>
        p.linkedOwnerUserId !== null &&
        !ownerIds.includes(p.linkedOwnerUserId),
    )
    .map((p) => p.id);

  if (staleIds.length > 0) {
    await prisma.player.updateMany({
      where: { id: { in: staleIds } },
      data: {
        deletedAt: new Date(),
        linkedOwnerUserId: null,
      },
    });
  }
}

export async function createTournament(
  userId: string,
  input: CreateTournamentInput,
): Promise<{ slug: string }> {
  const slug = tournamentSlugFromName(input.name);
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        logoUrl: input.logoUrl?.trim() ? input.logoUrl.trim() : null,
        colorHex: input.colorHex?.trim() ? input.colorHex.trim() : null,
        createdById: userId,
        picksPerTeam: input.picksPerTeam ?? DEFAULT_PICKS_PER_TEAM,
        draftPhase: DraftPhase.SETUP,
      },
    });
    await tx.squadRule.createMany({
      data: DEFAULT_SQUAD_RULES.map((rule) => ({
        tournamentId: tournament.id,
        category: rule.category,
        maxCount: rule.maxCount,
      })),
    });
  });
  return { slug };
}

export async function updateTournament(
  userId: string,
  input: UpdateTournamentInput,
): Promise<void> {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );
  const data: {
    name?: string;
    logoUrl?: string | null;
    colorHex?: string | null;
  } = {};
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.logoUrl !== undefined) {
    data.logoUrl = input.logoUrl.trim() ? input.logoUrl.trim() : null;
  }
  if (input.colorHex !== undefined) {
    data.colorHex = input.colorHex.trim() ? input.colorHex.trim() : null;
  }
  await prisma.tournament.update({
    where: { id: tournamentId },
    data,
  });
}

export async function listTournamentsForUser(userId: string) {
  return prisma.tournament.findMany({
    where: {
      deletedAt: null,
      createdById: userId,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      draftPhase: true,
      updatedAt: true,
      _count: { select: { teams: true, players: true } },
    },
  });
}

export async function assertTournamentOwnership(slug: string, userId: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, createdById: true },
  });
  if (!tournament) throw new TournamentServiceError("Tournament not found.");
  if (tournament.createdById !== userId) {
    throw new TournamentServiceError("You do not have access to this tournament.");
  }
  return tournament.id;
}

async function resolveTeamOwnerUserId(
  raw: string,
  commissionerUserId: string,
): Promise<string | null> {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = z.string().uuid().safeParse(trimmed);
  if (!parsed.success) {
    throw new TournamentServiceError(
      "Owner ID must be a Supabase Auth user UUID (Dashboard → Authentication → Users).",
    );
  }
  if (parsed.data === commissionerUserId) {
    throw new TournamentServiceError(
      "The commissioner cannot be a franchise owner. Create or invite a separate owner login.",
    );
  }
  const profile = await prisma.userProfile.findFirst({
    where: { id: parsed.data, deletedAt: null },
    select: { id: true },
  });
  if (!profile) {
    throw new TournamentServiceError(
      "No profile exists for that UUID yet. Ask the owner to sign in once, then assign them.",
    );
  }
  return parsed.data;
}

export async function createTeam(userId: string, input: CreateTeamInput) {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId },
    select: { draftPhase: true, createdById: true },
  });
  if (!tournament) throw new TournamentServiceError("Tournament not found.");
  if (
    tournament.draftPhase !== DraftPhase.SETUP &&
    tournament.draftPhase !== DraftPhase.READY
  ) {
    throw new TournamentServiceError(
      "Cannot modify teams after the draft configuration is sealed.",
    );
  }
  const maxOrder = await prisma.team.aggregate({
    where: { tournamentId, deletedAt: null },
    _max: { displayOrder: true },
  });
  let ownerUserId: string | null = null;
  if (input.ownerUserId?.trim()) {
    ownerUserId = await resolveTeamOwnerUserId(
      input.ownerUserId,
      tournament.createdById,
    );
  }
  await prisma.team.create({
    data: {
      tournamentId,
      name: input.name,
      shortName: input.shortName || null,
      logoUrl: input.logoUrl || null,
      colorHex: input.colorHex || null,
      ownerUserId,
      displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
    },
  });
  await syncOwnerPlayersForTournament(tournamentId);
}

export async function updateTeam(userId: string, input: UpdateTeamInput): Promise<void> {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId },
    select: { draftPhase: true, createdById: true },
  });
  if (!tournament) throw new TournamentServiceError("Tournament not found.");
  if (
    tournament.draftPhase !== DraftPhase.SETUP &&
    tournament.draftPhase !== DraftPhase.READY
  ) {
    throw new TournamentServiceError(
      "Cannot modify teams after the draft configuration is sealed.",
    );
  }
  const existing = await prisma.team.findFirst({
    where: {
      id: input.teamId,
      tournamentId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!existing) {
    throw new TournamentServiceError("Team not found.");
  }
  const ownerUserId = await resolveTeamOwnerUserId(
    input.ownerUserId,
    tournament.createdById,
  );
  await prisma.team.update({
    where: { id: input.teamId },
    data: {
      name: input.name,
      shortName: input.shortName?.trim() ? input.shortName.trim() : null,
      logoUrl: input.logoUrl?.trim() ? input.logoUrl.trim() : null,
      colorHex: input.colorHex?.trim() ? input.colorHex.trim() : null,
      ownerUserId,
    },
  });
  await syncOwnerPlayersForTournament(tournamentId);
}

export async function createPlayer(userId: string, input: CreatePlayerInput) {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );
  await prisma.player.create({
    data: {
      tournamentId,
      name: input.name,
      photoUrl: input.photoUrl || null,
      category: input.category,
      gender: input.gender,
      notes: input.notes || null,
    },
  });
}

export async function updatePlayer(userId: string, input: UpdatePlayerInput) {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );

  const existing = await prisma.player.findFirst({
    where: {
      id: input.playerId,
      tournamentId,
      deletedAt: null,
    },
    select: { category: true, linkedOwnerUserId: true },
  });

  if (!existing) {
    throw new TournamentServiceError("Player not found.");
  }

  const trimmedName = input.name.trim();

  await prisma.player.update({
    where: { id: input.playerId },
    data: {
      name: trimmedName,
      photoUrl: input.photoUrl?.trim() ? input.photoUrl.trim() : null,
      category: input.category,
      gender: input.gender,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    },
  });

  if (existing.linkedOwnerUserId) {
    await prisma.userProfile.updateMany({
      where: {
        id: existing.linkedOwnerUserId,
        deletedAt: null,
      },
      data: { displayName: trimmedName },
    });
  }

  if (existing.category !== input.category) {
    await reconcileSquadRulesForTournament(tournamentId);
  }
}

export async function softDeleteTournament(
  userId: string,
  tournamentSlug: string,
): Promise<void> {
  const tournamentId = await assertTournamentOwnership(tournamentSlug, userId);
  const pickCount = await prisma.pick.count({
    where: { tournamentId },
  });
  if (pickCount > 0) {
    throw new TournamentServiceError(
      "This tournament has draft picks on record. Remove picks via Admin undo flows before deleting, or archive manually.",
    );
  }
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { deletedAt: new Date() },
  });
}

export async function softDeletePlayer(
  userId: string,
  input: DeletePlayerInput,
): Promise<void> {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );

  const existing = await prisma.player.findFirst({
    where: {
      id: input.playerId,
      tournamentId,
      deletedAt: null,
    },
    select: { linkedOwnerUserId: true },
  });

  if (!existing) {
    throw new TournamentServiceError("Player not found.");
  }

  if (existing.linkedOwnerUserId !== null) {
    throw new TournamentServiceError(
      "Remove this person as franchise owner on the Teams page first, then delete their roster row.",
    );
  }

  const pickCount = await prisma.pick.count({
    where: { playerId: input.playerId },
  });
  if (pickCount > 0) {
    throw new TournamentServiceError(
      "This player appears on draft picks. Undo those picks in Admin before deleting.",
    );
  }

  await prisma.player.update({
    where: { id: input.playerId },
    data: { deletedAt: new Date() },
  });

  await reconcileSquadRulesForTournament(tournamentId);
}

export async function reconcileSquadRulesForTournament(
  tournamentId: string,
): Promise<void> {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, deletedAt: null },
    select: { picksPerTeam: true },
  });
  if (!tournament) {
    throw new TournamentServiceError("Tournament not found.");
  }

  const teamCount = await prisma.team.count({
    where: { tournamentId, deletedAt: null },
  });

  if (teamCount === 0) {
    await prisma.$transaction(async (tx) => {
      for (const category of SQUAD_RULE_CATEGORY_ORDER) {
        await tx.squadRule.updateMany({
          where: { tournamentId, category },
          data: { maxCount: 0 },
        });
      }
    });
    return;
  }

  const totalPlayers = await prisma.player.count({
    where: { tournamentId, deletedAt: null },
  });

  const grouped = await prisma.player.groupBy({
    by: ["category"],
    where: { tournamentId, deletedAt: null },
    _count: { _all: true },
  });

  const playersPerCategory: Partial<Record<PlayerCategory, number>> = {};
  for (const row of grouped) {
    playersPerCategory[row.category] = row._count._all;
  }

  const caps = computePerTeamCategoryCaps({
    teamCount,
    playersPerCategory,
  });

  const draftRules = SQUAD_RULE_CATEGORY_ORDER.map((category) => ({
    category,
    maxCount: caps[category],
  }));

  const feasibility = validateSquadRulesAgainstRoster({
    teamCount,
    picksPerTeam: tournament.picksPerTeam,
    totalPlayers,
    playersPerCategory,
    rules: draftRules,
    requireDraftSlotsVsRoster: false,
  });

  if (!feasibility.ok) {
    throw new TournamentServiceError(
      formatSquadValidationErrors(feasibility.errors),
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const category of SQUAD_RULE_CATEGORY_ORDER) {
      await tx.squadRule.updateMany({
        where: { tournamentId, category },
        data: { maxCount: caps[category] },
      });
    }
  });
}

export async function saveSquadRules(userId: string, input: SquadRulesInput) {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );

  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, deletedAt: null },
    select: { picksPerTeam: true },
  });
  if (!tournament) {
    throw new TournamentServiceError("Tournament not found.");
  }

  const teamCount = await prisma.team.count({
    where: { tournamentId, deletedAt: null },
  });

  const totalPlayers = await prisma.player.count({
    where: { tournamentId, deletedAt: null },
  });

  const grouped = await prisma.player.groupBy({
    by: ["category"],
    where: { tournamentId, deletedAt: null },
    _count: { _all: true },
  });

  const playersPerCategory: Partial<Record<PlayerCategory, number>> = {};
  for (const row of grouped) {
    playersPerCategory[row.category] = row._count._all;
  }

  const feasibility = validateSquadRulesAgainstRoster({
    teamCount,
    picksPerTeam: tournament.picksPerTeam,
    totalPlayers,
    playersPerCategory,
    rules: input.rules,
  });

  if (!feasibility.ok) {
    throw new TournamentServiceError(
      formatSquadValidationErrors(feasibility.errors),
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const rule of input.rules) {
      await tx.squadRule.updateMany({
        where: {
          tournamentId,
          category: rule.category,
        },
        data: { maxCount: rule.maxCount },
      });
    }
  });
}

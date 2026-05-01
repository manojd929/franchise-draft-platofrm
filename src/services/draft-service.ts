import {
  DraftLogAction,
  DraftPhase,
  PickStatus,
  type PlayerCategory,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { DraftSnapshotDto } from "@/types/draft";
import { buildSnakeDraftTeamSequence, shuffleTeamIds } from "@/utils/draft-order";
import { syncOwnerPlayersForTournament } from "@/services/tournament-service";

export class DraftServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftServiceError";
  }
}

async function appendLog(params: {
  tournamentId: string;
  action: (typeof DraftLogAction)[keyof typeof DraftLogAction];
  message?: string;
  payload?: Record<string, unknown>;
  actorUserId?: string | null;
}) {
  await prisma.draftLog.create({
    data: {
      tournamentId: params.tournamentId,
      action: params.action,
      message: params.message,
      payload: params.payload as Prisma.InputJsonValue | undefined,
      actorUserId: params.actorUserId ?? undefined,
    },
  });
}

export async function assertTournamentAdmin(
  tournamentId: string,
  userId: string,
): Promise<void> {
  const t = await prisma.tournament.findFirst({
    where: { id: tournamentId, deletedAt: null },
    select: { createdById: true },
  });
  if (!t) throw new DraftServiceError("Tournament not found.");
  if (t.createdById !== userId) {
    throw new DraftServiceError("Only the tournament admin can perform this action.");
  }
}

async function getTournamentBySlug(slug: string) {
  return prisma.tournament.findFirst({
    where: { slug, deletedAt: null },
    include: {
      teams: {
        where: { deletedAt: null },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      },
      players: { where: { deletedAt: null }, orderBy: { name: "asc" } },
      squadRules: true,
      draftSlots: { orderBy: { slotIndex: "asc" } },
      picks: {
        where: { status: PickStatus.CONFIRMED },
        orderBy: { slotIndex: "asc" },
      },
    },
  });
}

function mapSnapshot(t: NonNullable<Awaited<ReturnType<typeof getTournamentBySlug>>>): DraftSnapshotDto {
  const playerAssignments = new Map<
    string,
    { teamId: string; confirmed: boolean }
  >();
  for (const pick of t.picks) {
    playerAssignments.set(pick.playerId, {
      teamId: pick.teamId,
      confirmed: pick.status === PickStatus.CONFIRMED,
    });
  }
  if (t.pendingPickPlayerId && t.pendingPickTeamId) {
    if (!playerAssignments.has(t.pendingPickPlayerId)) {
      playerAssignments.set(t.pendingPickPlayerId, {
        teamId: t.pendingPickTeamId,
        confirmed: false,
      });
    }
  }

  const lastPick = [...t.picks]
    .filter((p) => p.status === PickStatus.CONFIRMED)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  const lastTeam = lastPick
    ? t.teams.find((team) => team.id === lastPick.teamId)
    : undefined;
  const lastPlayer = lastPick
    ? t.players.find((pl) => pl.id === lastPick.playerId)
    : undefined;

  return {
    tournamentId: t.id,
    slug: t.slug,
    name: t.name,
    draftPhase: t.draftPhase,
    currentSlotIndex: t.currentSlotIndex,
    picksPerTeam: t.picksPerTeam,
    draftOrderLocked: t.draftOrderLocked,
    overrideValidation: t.overrideValidation,
    pickTimerSeconds: t.pickTimerSeconds,
    pendingPickPlayerId: t.pendingPickPlayerId,
    pendingPickTeamId: t.pendingPickTeamId,
    teams: t.teams.map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      logoUrl: team.logoUrl,
      colorHex: team.colorHex,
      ownerUserId: team.ownerUserId,
    })),
    players: t.players.map((player) => {
      const assignment = playerAssignments.get(player.id);
      return {
        id: player.id,
        name: player.name,
        photoUrl: player.photoUrl,
        category: player.category,
        gender: player.gender,
        notes: player.notes,
        isUnavailable: player.isUnavailable,
        isLocked: player.isLocked,
        runsFranchiseLogin: player.linkedOwnerUserId !== null,
        assignedTeamId: assignment?.teamId ?? null,
        hasConfirmedPick: assignment?.confirmed ?? false,
      };
    }),
    draftSlots: t.draftSlots.map((slot) => ({
      slotIndex: slot.slotIndex,
      teamId: slot.teamId,
    })),
    squadRules: t.squadRules.map((rule) => ({
      category: rule.category,
      maxCount: rule.maxCount,
    })),
    picksCount: t.picks.filter((p) => p.status === PickStatus.CONFIRMED).length,
    draftSlotsTotal: t.draftSlots.length,
    activity: [],
    lastConfirmedPick:
      lastPick && lastTeam && lastPlayer
        ? {
            playerName: lastPlayer.name,
            teamName: lastTeam.name,
            category: lastPlayer.category,
          }
        : null,
  };
}

export async function fetchDraftSnapshotBySlug(
  slug: string,
): Promise<DraftSnapshotDto | null> {
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) return null;
  const logs = await prisma.draftLog.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      action: true,
      message: true,
      createdAt: true,
    },
  });
  const snap = mapSnapshot(tournament);
  snap.activity = logs.map((log) => ({
    id: log.id,
    action: log.action,
    message: log.message,
    createdAt: log.createdAt.toISOString(),
  }));
  return snap;
}

function assertPhase(
  phase: (typeof DraftPhase)[keyof typeof DraftPhase],
  allowed: (typeof DraftPhase)[keyof typeof DraftPhase][],
) {
  if (!allowed.includes(phase)) {
    throw new DraftServiceError("Draft is not in the correct state for this action.");
  }
}

function getCurrentTurnTeamId(
  tournament: {
    currentSlotIndex: number;
    draftSlots: { slotIndex: number; teamId: string }[];
  },
): string | null {
  const slot = tournament.draftSlots.find(
    (s) => s.slotIndex === tournament.currentSlotIndex,
  );
  return slot?.teamId ?? null;
}

async function countTeamCategoryPicks(
  tournamentId: string,
  teamId: string,
): Promise<Record<PlayerCategory, number>> {
  const picks = await prisma.pick.findMany({
    where: {
      tournamentId,
      teamId,
      status: PickStatus.CONFIRMED,
    },
    select: {
      player: { select: { category: true } },
    },
  });
  const counts: Record<PlayerCategory, number> = {
    MEN_BEGINNER: 0,
    MEN_INTERMEDIATE: 0,
    MEN_ADVANCED: 0,
    WOMEN: 0,
  };
  for (const pick of picks) {
    counts[pick.player.category] += 1;
  }
  return counts;
}

async function validatePickAllowed(params: {
  tournamentId: string;
  teamId: string;
  playerId: string;
  overrideValidation: boolean;
}) {
  const player = await prisma.player.findFirst({
    where: {
      id: params.playerId,
      tournamentId: params.tournamentId,
      deletedAt: null,
    },
  });
  if (!player) throw new DraftServiceError("Player not found.");
  if (player.isUnavailable) throw new DraftServiceError("Player is unavailable.");
  if (player.isLocked) throw new DraftServiceError("Player is locked.");

  const existing = await prisma.pick.findFirst({
    where: {
      tournamentId: params.tournamentId,
      playerId: params.playerId,
      status: PickStatus.CONFIRMED,
    },
  });
  if (existing) throw new DraftServiceError("Player already drafted.");

  if (
    player.linkedOwnerUserId !== null &&
    !params.overrideValidation
  ) {
    throw new DraftServiceError(
      "Roster rows tied to another franchise owner's login cannot be drafted in the auction.",
    );
  }

  if (params.overrideValidation) return;

  const rules = await prisma.squadRule.findMany({
    where: { tournamentId: params.tournamentId },
  });
  const counts = await countTeamCategoryPicks(params.tournamentId, params.teamId);
  const category = player.category;
  const rule = rules.find((r) => r.category === category);
  const max = rule?.maxCount ?? 0;
  if (counts[category] >= max) {
    throw new DraftServiceError(
      "Squad rule violation: category quota reached for this team.",
    );
  }
}

export async function randomizeDraftOrder(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: {
        teams: { where: { deletedAt: null } },
        draftSlots: true,
      },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only the tournament admin can randomize order.");
    }
    assertPhase(tournament.draftPhase, [
      DraftPhase.SETUP,
      DraftPhase.READY,
    ]);
    if (tournament.draftOrderLocked) {
      throw new DraftServiceError("Draft order is locked.");
    }
    if (tournament.teams.length === 0) {
      throw new DraftServiceError("Add teams before generating draft order.");
    }

    const shuffled = shuffleTeamIds(tournament.teams.map((team) => team.id));
    const sequence = buildSnakeDraftTeamSequence(
      shuffled,
      tournament.picksPerTeam,
    );

    await tx.draftOrderSlot.deleteMany({
      where: { tournamentId: tournament.id },
    });
    await tx.draftOrderSlot.createMany({
      data: sequence.map((teamId, index) => ({
        tournamentId: tournament.id,
        slotIndex: index,
        teamId,
      })),
    });

    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        currentSlotIndex: 0,
        draftPhase: DraftPhase.READY,
      },
    });

    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.ORDER_RANDOMIZED,
        message: "Draft order randomized (snake).",
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function startDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournamentPreview = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
    select: { id: true },
  });
  if (!tournamentPreview) throw new DraftServiceError("Tournament not found.");
  await syncOwnerPlayersForTournament(tournamentPreview.id);

  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only the tournament admin can start the draft.");
    }
    assertPhase(tournament.draftPhase, [DraftPhase.READY, DraftPhase.SETUP]);
    if (tournament.draftSlots.length === 0) {
      throw new DraftServiceError("Generate draft order before starting.");
    }
    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        draftPhase: DraftPhase.LIVE,
        draftStartedAt: tournament.draftStartedAt ?? new Date(),
        currentSlotIndex: Math.min(
          tournament.currentSlotIndex,
          tournament.draftSlots.length - 1,
        ),
      },
    });
    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.DRAFT_STARTED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function pauseDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  assertPhase(tournament.draftPhase, [DraftPhase.LIVE]);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { draftPhase: DraftPhase.PAUSED },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_PAUSED,
    actorUserId: params.actorUserId,
  });
}

export async function resumeDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  assertPhase(tournament.draftPhase, [DraftPhase.PAUSED]);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { draftPhase: DraftPhase.LIVE },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_RESUMED,
    actorUserId: params.actorUserId,
  });
}

export async function freezeDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  assertPhase(tournament.draftPhase, [
    DraftPhase.LIVE,
    DraftPhase.PAUSED,
  ]);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { draftPhase: DraftPhase.FROZEN },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_FROZEN,
    actorUserId: params.actorUserId,
  });
}

export async function unlockDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  assertPhase(tournament.draftPhase, [DraftPhase.FROZEN, DraftPhase.LOCKED]);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { draftPhase: DraftPhase.LIVE },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_UNLOCKED,
    actorUserId: params.actorUserId,
  });
}

export async function lockDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  assertPhase(tournament.draftPhase, [
    DraftPhase.LIVE,
    DraftPhase.PAUSED,
    DraftPhase.FROZEN,
  ]);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { draftPhase: DraftPhase.LOCKED },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_LOCKED,
    actorUserId: params.actorUserId,
  });
}

export async function endDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: {
      draftPhase: DraftPhase.COMPLETED,
      draftEndedAt: new Date(),
    },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_ENDED,
    actorUserId: params.actorUserId,
  });
}

export async function nextTurn(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can advance turns.");
    }
    assertPhase(tournament.draftPhase, [DraftPhase.LIVE]);
    if (tournament.pendingPickPlayerId) {
      throw new DraftServiceError("Confirm or clear the pending pick first.");
    }
    const nextIndex = tournament.currentSlotIndex + 1;
    if (nextIndex >= tournament.draftSlots.length) {
      await tx.tournament.update({
        where: { id: tournament.id },
        data: {
          draftPhase: DraftPhase.COMPLETED,
          draftEndedAt: new Date(),
        },
      });
    } else {
      await tx.tournament.update({
        where: { id: tournament.id },
        data: { currentSlotIndex: nextIndex },
      });
    }
    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.TURN_ADVANCED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function skipTurn(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can skip turns.");
    }
    assertPhase(tournament.draftPhase, [DraftPhase.LIVE]);
    if (tournament.pendingPickPlayerId) {
      throw new DraftServiceError("Confirm or clear the pending pick before skipping.");
    }
    const nextIndex = tournament.currentSlotIndex + 1;
    if (nextIndex >= tournament.draftSlots.length) {
      await tx.tournament.update({
        where: { id: tournament.id },
        data: {
          draftPhase: DraftPhase.COMPLETED,
          draftEndedAt: new Date(),
        },
      });
    } else {
      await tx.tournament.update({
        where: { id: tournament.id },
        data: { currentSlotIndex: nextIndex },
      });
    }
    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.TURN_SKIPPED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function previousTurn(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can rewind turns.");
    }
    if (tournament.currentSlotIndex <= 0) return;
    await tx.tournament.update({
      where: { id: tournament.id },
      data: { currentSlotIndex: tournament.currentSlotIndex - 1 },
    });
    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.TURN_REVERTED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function requestPick(params: {
  tournamentSlug: string;
  actorUserId: string;
  playerId: string;
  idempotencyKey: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    assertPhase(tournament.draftPhase, [DraftPhase.LIVE]);

    const currentTeamId = getCurrentTurnTeamId(tournament);
    if (!currentTeamId) throw new DraftServiceError("Invalid draft slot.");

    const isAdmin = tournament.createdById === params.actorUserId;
    const team = tournament.draftSlots.length
      ? await tx.team.findFirst({
          where: { id: currentTeamId },
        })
      : null;
    const isOwner = team?.ownerUserId === params.actorUserId;
    if (!isAdmin && !isOwner) {
      throw new DraftServiceError("Only the active franchise owner (or admin) can nominate a pick.");
    }

    if (
      tournament.pendingIdempotencyKey === params.idempotencyKey &&
      tournament.pendingPickPlayerId === params.playerId &&
      tournament.pendingPickTeamId === currentTeamId
    ) {
      return;
    }

    await validatePickAllowed({
      tournamentId: tournament.id,
      teamId: currentTeamId,
      playerId: params.playerId,
      overrideValidation: tournament.overrideValidation,
    });

    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        pendingPickPlayerId: params.playerId,
        pendingPickTeamId: currentTeamId,
        pendingIdempotencyKey: params.idempotencyKey,
      },
    });

    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.PICK_REQUESTED,
        actorUserId: params.actorUserId,
        payload: { playerId: params.playerId } as Prisma.InputJsonValue,
      },
    });
  });
}

export async function confirmPick(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can confirm picks.");
    }
    assertPhase(tournament.draftPhase, [DraftPhase.LIVE]);
    if (
      !tournament.pendingPickPlayerId ||
      !tournament.pendingPickTeamId
    ) {
      throw new DraftServiceError("No pending pick to confirm.");
    }

    const currentTeamId = getCurrentTurnTeamId(tournament);
    if (
      currentTeamId &&
      tournament.pendingPickTeamId !== currentTeamId &&
      !tournament.overrideValidation
    ) {
      throw new DraftServiceError("Pending pick does not match current turn.");
    }

    const slotIndex = tournament.currentSlotIndex;

    await validatePickAllowed({
      tournamentId: tournament.id,
      teamId: tournament.pendingPickTeamId,
      playerId: tournament.pendingPickPlayerId,
      overrideValidation: tournament.overrideValidation,
    });

    await tx.pick.create({
      data: {
        tournamentId: tournament.id,
        playerId: tournament.pendingPickPlayerId,
        teamId: tournament.pendingPickTeamId,
        slotIndex,
        status: PickStatus.CONFIRMED,
        idempotencyKey: tournament.pendingIdempotencyKey,
        confirmedByUserId: params.actorUserId,
      },
    });

    const nextIndex = tournament.currentSlotIndex + 1;
    const completed = nextIndex >= tournament.draftSlots.length;

    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        pendingPickPlayerId: null,
        pendingPickTeamId: null,
        pendingIdempotencyKey: null,
        currentSlotIndex: completed
          ? tournament.currentSlotIndex
          : nextIndex,
        draftPhase: completed ? DraftPhase.COMPLETED : DraftPhase.LIVE,
        draftEndedAt: completed ? new Date() : tournament.draftEndedAt,
      },
    });

    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.PICK_CONFIRMED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function undoLastPick(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can undo picks.");
    }

    if (tournament.pendingPickPlayerId) {
      await tx.tournament.update({
        where: { id: tournament.id },
        data: {
          pendingPickPlayerId: null,
          pendingPickTeamId: null,
          pendingIdempotencyKey: null,
        },
      });
      await tx.draftLog.create({
        data: {
          tournamentId: tournament.id,
          action: DraftLogAction.PICK_UNDONE,
          message: "Cleared pending nomination.",
          actorUserId: params.actorUserId,
        },
      });
      return;
    }

    const lastPick = await tx.pick.findFirst({
      where: {
        tournamentId: tournament.id,
        status: PickStatus.CONFIRMED,
      },
      orderBy: { slotIndex: "desc" },
    });
    if (!lastPick) return;

    await tx.pick.delete({ where: { id: lastPick.id } });
    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        currentSlotIndex: lastPick.slotIndex,
        draftPhase: DraftPhase.LIVE,
        draftEndedAt: null,
      },
    });
    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.PICK_UNDONE,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function toggleOverrideValidation(params: {
  tournamentSlug: string;
  actorUserId: string;
  enabled: boolean;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { overrideValidation: params.enabled },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.OVERRIDE_VALIDATION,
    message: params.enabled ? "Validation override ON" : "Validation override OFF",
    actorUserId: params.actorUserId,
  });
}

export async function forceSyncLog(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.SYNC_FORCED,
    actorUserId: params.actorUserId,
  });
}

export async function assignManualPick(params: {
  tournamentSlug: string;
  actorUserId: string;
  playerId: string;
  teamId: string;
  idempotencyKey: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can manually assign.");
    }
    assertPhase(tournament.draftPhase, [
      DraftPhase.LIVE,
      DraftPhase.PAUSED,
      DraftPhase.FROZEN,
    ]);

    const existingKey = await tx.pick.findFirst({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existingKey) return;

    await validatePickAllowed({
      tournamentId: tournament.id,
      teamId: params.teamId,
      playerId: params.playerId,
      overrideValidation: tournament.overrideValidation,
    });

    const slotIndex =
      tournament.draftSlots.length > 0
        ? Math.min(
            tournament.currentSlotIndex,
            tournament.draftSlots.length - 1,
          )
        : 0;

    await tx.pick.create({
      data: {
        tournamentId: tournament.id,
        playerId: params.playerId,
        teamId: params.teamId,
        slotIndex,
        status: PickStatus.CONFIRMED,
        idempotencyKey: params.idempotencyKey,
        confirmedByUserId: params.actorUserId,
      },
    });

    const nextIndex = tournament.currentSlotIndex + 1;
    const completed =
      tournament.draftSlots.length > 0 &&
      nextIndex >= tournament.draftSlots.length;

    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        pendingPickPlayerId: null,
        pendingPickTeamId: null,
        pendingIdempotencyKey: null,
        currentSlotIndex: completed
          ? tournament.currentSlotIndex
          : nextIndex,
        draftPhase: completed ? DraftPhase.COMPLETED : tournament.draftPhase,
        draftEndedAt: completed ? new Date() : tournament.draftEndedAt,
      },
    });

    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.PLAYER_ASSIGNED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function markPlayerUnavailable(params: {
  tournamentSlug: string;
  actorUserId: string;
  playerId: string;
  unavailable: boolean;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  await prisma.player.updateMany({
    where: {
      id: params.playerId,
      tournamentId: tournament.id,
    },
    data: { isUnavailable: params.unavailable },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.PLAYER_UNAVAILABLE,
    actorUserId: params.actorUserId,
  });
}

export async function markPlayerLocked(params: {
  tournamentSlug: string;
  actorUserId: string;
  playerId: string;
  locked: boolean;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  await prisma.player.updateMany({
    where: {
      id: params.playerId,
      tournamentId: tournament.id,
    },
    data: { isLocked: params.locked },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.PLAYER_LOCKED,
    actorUserId: params.actorUserId,
  });
}

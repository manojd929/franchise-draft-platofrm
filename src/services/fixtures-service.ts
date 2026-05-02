import {
  FixtureMatchType,
  FixtureSide,
  FixtureStatus,
  PickStatus,
  TournamentFormat,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertTournamentOwnership, TournamentServiceError } from "@/services/tournament-service";

function fixturesDelegatesAvailable(): boolean {
  const prismaWithDelegates = prisma as unknown as {
    fixtureTie?: { findMany: (...args: unknown[]) => Promise<unknown> };
    fixtureMatch?: { findMany: (...args: unknown[]) => Promise<unknown> };
  };
  return (
    typeof prismaWithDelegates.fixtureTie?.findMany === "function" &&
    typeof prismaWithDelegates.fixtureMatch?.findMany === "function"
  );
}

async function syncDoublesFixtureParticipantsForTournament(
  tournamentId: string,
): Promise<void> {
  if (!fixturesDelegatesAvailable()) {
    return;
  }

  const ties = await prisma.fixtureTie.findMany({
    where: { tournamentId },
    orderBy: [{ roundNumber: "asc" }, { sequence: "asc" }],
    include: {
      teamOne: { select: { id: true, name: true } },
      teamTwo: { select: { id: true, name: true } },
      matches: {
        where: { matchType: FixtureMatchType.DOUBLES },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        include: {
          participants: {
            select: { id: true, side: true, teamId: true, playerId: true },
          },
        },
      },
    },
  });

  if (ties.length === 0) {
    return;
  }

  const teamIds = [
    ...new Set(
      ties.flatMap((tie) => [tie.teamOne.id, tie.teamTwo.id]),
    ),
  ];

  const picks = await prisma.pick.findMany({
    where: {
      tournamentId,
      teamId: { in: teamIds },
      status: PickStatus.CONFIRMED,
      player: {
        deletedAt: null,
      },
    },
    orderBy: [{ slotIndex: "asc" }, { createdAt: "asc" }],
    select: {
      teamId: true,
      player: { select: { id: true, name: true } },
    },
  });

  const playersByTeam = new Map<string, Array<{ id: string; name: string }>>();
  for (const pick of picks) {
    const existing = playersByTeam.get(pick.teamId) ?? [];
    if (!existing.some((player) => player.id === pick.player.id)) {
      existing.push(pick.player);
    }
    playersByTeam.set(pick.teamId, existing);
  }

  await prisma.$transaction(async (tx) => {
    for (const tie of ties) {
      const teamOnePlayers = playersByTeam.get(tie.teamOne.id) ?? [];
      const teamTwoPlayers = playersByTeam.get(tie.teamTwo.id) ?? [];

      for (const [matchIndex, match] of tie.matches.entries()) {
        const hasValidParticipants =
          match.participants.length === 4 &&
          match.participants.filter((participant) => participant.side === FixtureSide.SIDE_ONE).length === 2 &&
          match.participants.filter((participant) => participant.side === FixtureSide.SIDE_TWO).length === 2;

        if (hasValidParticipants) {
          continue;
        }

        await tx.fixtureMatchParticipant.deleteMany({
          where: { matchId: match.id },
        });

        if (teamOnePlayers.length < 2 || teamTwoPlayers.length < 2) {
          continue;
        }

        const sideOne = [
          teamOnePlayers[(matchIndex * 2) % teamOnePlayers.length]!,
          teamOnePlayers[(matchIndex * 2 + 1) % teamOnePlayers.length]!,
        ];
        const sideTwo = [
          teamTwoPlayers[(matchIndex * 2) % teamTwoPlayers.length]!,
          teamTwoPlayers[(matchIndex * 2 + 1) % teamTwoPlayers.length]!,
        ];

        await tx.fixtureMatchParticipant.createMany({
          data: [
            {
              matchId: match.id,
              playerId: sideOne[0].id,
              side: FixtureSide.SIDE_ONE,
              teamId: tie.teamOne.id,
            },
            {
              matchId: match.id,
              playerId: sideOne[1].id,
              side: FixtureSide.SIDE_ONE,
              teamId: tie.teamOne.id,
            },
            {
              matchId: match.id,
              playerId: sideTwo[0].id,
              side: FixtureSide.SIDE_TWO,
              teamId: tie.teamTwo.id,
            },
            {
              matchId: match.id,
              playerId: sideTwo[1].id,
              side: FixtureSide.SIDE_TWO,
              teamId: tie.teamTwo.id,
            },
          ],
        });
      }
    }
  });
}

export async function getFixturesSummary(tournamentSlug: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: tournamentSlug, deletedAt: null },
    select: { id: true, draftPhase: true, createdById: true },
  });
  if (!tournament) return null;
  if (!fixturesDelegatesAvailable()) {
    return { tournament, ties: [], matches: [], fixturesReady: false };
  }

  await syncDoublesFixtureParticipantsForTournament(tournament.id);

  const [ties, matches] = await Promise.all([
    prisma.fixtureTie.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ roundNumber: "asc" }, { sequence: "asc" }],
      include: {
        teamOne: { select: { id: true, name: true } },
        teamTwo: { select: { id: true, name: true } },
        matches: { select: { id: true, status: true } },
      },
    }),
    prisma.fixtureMatch.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
      include: {
        participants: {
          include: {
            player: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return { tournament, ties, matches, fixturesReady: true };
}

export async function generateRoundRobinTies(params: {
  actorUserId: string;
  tournamentSlug: string;
  matchesPerTie: number;
  categoryLabel?: string;
}) {
  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, deletedAt: null },
    select: { id: true, draftPhase: true },
  });
  if (!tournament) throw new TournamentServiceError("Tournament not found.");
  if (tournament.draftPhase !== "COMPLETED") {
    throw new TournamentServiceError("Complete the draft before generating doubles fixtures.");
  }

  const teams = await prisma.team.findMany({
    where: { tournamentId, deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (teams.length < 2) throw new TournamentServiceError("At least two teams are required.");
  if (!fixturesDelegatesAvailable()) {
    throw new TournamentServiceError("Fixtures schema is not ready yet. Run database migration first.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.fixtureMatch.deleteMany({ where: { tournamentId } });
    await tx.fixtureTie.deleteMany({ where: { tournamentId } });

    let sequence = 0;
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        const tie = await tx.fixtureTie.create({
          data: {
            tournamentId,
            teamOneId: teams[i].id,
            teamTwoId: teams[j].id,
            roundNumber: i + 1,
            sequence,
            categoryLabel: params.categoryLabel,
          },
        });
        for (let k = 0; k < params.matchesPerTie; k += 1) {
          await tx.fixtureMatch.create({
            data: {
              tournamentId,
              tieId: tie.id,
              matchType: FixtureMatchType.DOUBLES,
              sequence: k,
              status: FixtureStatus.SCHEDULED,
              categoryLabel: params.categoryLabel,
            },
          });
        }
        sequence += 1;
      }
    }
  });

  await syncDoublesFixtureParticipantsForTournament(tournamentId);
}

export async function createSinglesMatch(params: {
  actorUserId: string;
  tournamentSlug: string;
  playerOneId: string;
  playerTwoId: string;
  categoryLabel?: string;
}) {
  if (params.playerOneId === params.playerTwoId) {
    throw new TournamentServiceError("Select two different players.");
  }
  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, deletedAt: null },
    select: { id: true, format: true },
  });
  if (!tournament) throw new TournamentServiceError("Tournament not found.");
  if (tournament.format === TournamentFormat.DOUBLES_ONLY) {
    throw new TournamentServiceError("This tournament is doubles-only. Singles fixtures are disabled.");
  }
  const players = await prisma.player.findMany({
    where: { id: { in: [params.playerOneId, params.playerTwoId] }, tournamentId, deletedAt: null },
    select: { id: true },
  });
  if (players.length !== 2) throw new TournamentServiceError("Players not found in this tournament.");
  if (!fixturesDelegatesAvailable()) {
    throw new TournamentServiceError("Fixtures schema is not ready yet. Run database migration first.");
  }

  const match = await prisma.fixtureMatch.create({
    data: {
      tournamentId,
      matchType: FixtureMatchType.SINGLES,
      status: FixtureStatus.SCHEDULED,
      categoryLabel: params.categoryLabel,
      participants: {
        create: [
          { playerId: params.playerOneId, side: FixtureSide.SIDE_ONE },
          { playerId: params.playerTwoId, side: FixtureSide.SIDE_TWO },
        ],
      },
    },
  });
  return match.id;
}

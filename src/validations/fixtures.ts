import { z } from "zod";

export const fixturesSlugSchema = z.object({
  tournamentSlug: z.string().min(1),
});

export const generateRoundRobinTiesSchema = z.object({
  tournamentSlug: z.string().min(1),
  matchesPerTie: z.coerce.number().int().min(1).max(15).default(5),
  categoryLabel: z.string().max(120).optional(),
});

export const createSinglesMatchSchema = z.object({
  tournamentSlug: z.string().min(1),
  playerOneId: z.string().uuid(),
  playerTwoId: z.string().uuid(),
  categoryLabel: z.string().max(120).optional(),
});

export const createFixtureTieSchema = z.object({
  tournamentSlug: z.string().min(1),
  teamOneId: z.string().uuid(),
  teamTwoId: z.string().uuid(),
  roundNumber: z.coerce.number().int().min(1).max(999).optional(),
  matchesPerTie: z.coerce.number().int().min(1).max(15).default(1),
  categoryLabel: z.string().max(120).optional(),
});

export const createTieMatchSchema = z.object({
  tournamentSlug: z.string().min(1),
  tieId: z.string().uuid(),
});

const playerIdArraySchema = z.array(z.string().uuid()).max(2);

export const assignTieMatchParticipantsSchema = z.object({
  tournamentSlug: z.string().min(1),
  matchId: z.string().uuid(),
  sideOnePlayerIds: playerIdArraySchema,
  sideTwoPlayerIds: playerIdArraySchema,
});

export const deleteFixtureTieSchema = z.object({
  tournamentSlug: z.string().min(1),
  tieId: z.string().uuid(),
});

export const deleteFixtureMatchSchema = z.object({
  tournamentSlug: z.string().min(1),
  matchId: z.string().uuid(),
});

export const updateFixtureScoreSchema = z.object({
  tournamentSlug: z.string().min(1),
  matchId: z.string().uuid(),
  sideOneScore: z.coerce.number().int().min(0),
  sideTwoScore: z.coerce.number().int().min(0),
});

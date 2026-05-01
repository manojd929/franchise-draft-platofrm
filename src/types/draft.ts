import type {
  DraftPhase,
  Gender,
  PlayerCategory,
} from "@/generated/prisma/enums";

export interface DraftTeamDto {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  colorHex: string | null;
  ownerUserId: string | null;
}

export interface DraftPlayerDto {
  id: string;
  name: string;
  photoUrl: string | null;
  category: PlayerCategory;
  gender: Gender;
  notes: string | null;
  isUnavailable: boolean;
  isLocked: boolean;
  /** True when roster row backs a commissioner-provisioned franchise-owner login (`Player.linkedOwnerUserId`). Never draftable in normal flows. */
  runsFranchiseLogin: boolean;
  assignedTeamId: string | null;
  hasConfirmedPick: boolean;
}

export interface DraftOrderSlotDto {
  slotIndex: number;
  teamId: string;
}

export interface SquadRuleDto {
  category: PlayerCategory;
  maxCount: number;
}

export interface DraftLogEntryDto {
  id: string;
  action: string;
  message: string | null;
  createdAt: string;
}

export interface DraftSnapshotDto {
  tournamentId: string;
  slug: string;
  name: string;
  draftPhase: DraftPhase;
  currentSlotIndex: number;
  picksPerTeam: number;
  draftOrderLocked: boolean;
  overrideValidation: boolean;
  pickTimerSeconds: number | null;
  pendingPickPlayerId: string | null;
  pendingPickTeamId: string | null;
  teams: DraftTeamDto[];
  players: DraftPlayerDto[];
  draftSlots: DraftOrderSlotDto[];
  squadRules: SquadRuleDto[];
  picksCount: number;
  draftSlotsTotal: number;
  activity: DraftLogEntryDto[];
  lastConfirmedPick: {
    playerName: string;
    teamName: string;
    category: PlayerCategory;
  } | null;
}

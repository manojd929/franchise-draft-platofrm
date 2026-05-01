"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ActivityFeedTime } from "@/components/draft/activity-feed-time";
import { DraftOrderRevealOverlay } from "@/components/draft/draft-order-reveal-overlay";
import { PlayerCard } from "@/components/draft/player-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DRAFT_PHASE_LABEL } from "@/constants/draft-phase-labels";
import { GENDER_LABEL, PLAYER_CATEGORY_LABEL } from "@/constants/player-labels";
import { requestPickAction } from "@/features/draft/actions";
import { DraftPhase, type Gender } from "@/generated/prisma/enums";
import { useDraftLiveSync } from "@/hooks/use-draft-live-sync";
import { cn } from "@/lib/utils";
import { useDraftBoardUiStore } from "@/store/draft-board-store";
import type { DraftSnapshotDto } from "@/types/draft";

interface DraftRoomClientProps {
  slug: string;
  initialSnapshot: DraftSnapshotDto;
  viewerUserId: string | null;
  enableOwnerPick: boolean;
  /**
   * Franchise-owner phone route: never show nominate controls unless this login owns the on-clock team;
   * hide full snake order; clarify copy so other franchises' turns are read-only.
   */
  franchiseOwnerPhoneMode?: boolean;
  /** When set, rendering uses this snapshot (e.g. admin embed with single upstream sync). */
  controlledSnapshot?: DraftSnapshotDto;
  /** Subscribe to polling/realtime updates (disable when parent owns sync). */
  syncEnabled?: boolean;
}

export function DraftRoomClient({
  slug,
  initialSnapshot,
  viewerUserId,
  enableOwnerPick,
  franchiseOwnerPhoneMode = false,
  controlledSnapshot,
  syncEnabled = true,
}: DraftRoomClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const liveBoardSync = syncEnabled && !controlledSnapshot;
  useDraftLiveSync(
    slug,
    liveBoardSync ? snapshot.tournamentId : undefined,
    setSnapshot,
    3500,
    liveBoardSync,
  );

  const effectiveSnapshot = controlledSnapshot ?? snapshot;

  const search = useDraftBoardUiStore((s) => s.search);
  const categoryFilter = useDraftBoardUiStore((s) => s.categoryFilter);
  const genderFilter = useDraftBoardUiStore((s) => s.genderFilter);
  const sortMode = useDraftBoardUiStore((s) => s.sortMode);
  const setSearch = useDraftBoardUiStore((s) => s.setSearch);
  const setCategoryFilter = useDraftBoardUiStore((s) => s.setCategoryFilter);
  const setGenderFilter = useDraftBoardUiStore((s) => s.setGenderFilter);
  const setSortMode = useDraftBoardUiStore((s) => s.setSortMode);

  const teamsById = useMemo(() => {
    const map: Record<string, (typeof effectiveSnapshot.teams)[0]> = {};
    effectiveSnapshot.teams.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [effectiveSnapshot]);

  const currentTurnTeamId = useMemo(() => {
    const slot = effectiveSnapshot.draftSlots.find(
      (s) => s.slotIndex === effectiveSnapshot.currentSlotIndex,
    );
    return slot?.teamId ?? null;
  }, [effectiveSnapshot.currentSlotIndex, effectiveSnapshot.draftSlots]);

  const currentTeam = currentTurnTeamId ? teamsById[currentTurnTeamId] : null;

  const viewerFranchiseTeams = useMemo(() => {
    if (!viewerUserId) return [];
    return effectiveSnapshot.teams.filter((t) => t.ownerUserId === viewerUserId);
  }, [effectiveSnapshot.teams, viewerUserId]);

  const viewerOwnsClock =
    Boolean(enableOwnerPick) &&
    Boolean(viewerUserId) &&
    Boolean(currentTurnTeamId) &&
    teamsById[currentTurnTeamId ?? ""]?.ownerUserId === viewerUserId;

  const handleNominate = useCallback(
    async (playerId: string) => {
      const result = await requestPickAction({
        tournamentSlug: slug,
        playerId,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Your pick was sent. The admin will confirm it.");
    },
    [slug],
  );

  const filteredPlayers = useMemo(() => {
    let list = effectiveSnapshot.players;
    if (categoryFilter !== "ALL") {
      list = list.filter((p) => p.category === categoryFilter);
    }
    if (genderFilter !== "ALL") {
      list = list.filter((p) => p.gender === genderFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortMode === "name_asc") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "category") {
      sorted.sort((a, b) => a.category.localeCompare(b.category));
    } else {
      sorted.sort((a, b) => {
        const av =
          Number(a.hasConfirmedPick) +
          Number(Boolean(a.assignedTeamId && !a.hasConfirmedPick));
        const bv =
          Number(b.hasConfirmedPick) +
          Number(Boolean(b.assignedTeamId && !b.hasConfirmedPick));
        if (av !== bv) {
          return av - bv;
        }
        return Number(a.runsFranchiseLogin) - Number(b.runsFranchiseLogin);
      });
    }
    return sorted;
  }, [categoryFilter, genderFilter, search, effectiveSnapshot.players, sortMode]);

  const draftLive = effectiveSnapshot.draftPhase === DraftPhase.LIVE;

  const hideFranchiseOwnerNominate =
    franchiseOwnerPhoneMode && (!draftLive || !viewerOwnsClock);

  const nominateActionsAllowed =
    !franchiseOwnerPhoneMode || viewerOwnsClock;

  const genderKeys = Object.keys(GENDER_LABEL) as Gender[];

  return (
    <>
      <DraftOrderRevealOverlay
        slug={slug}
        draftPhase={effectiveSnapshot.draftPhase}
        draftSlots={effectiveSnapshot.draftSlots}
        teams={effectiveSnapshot.teams}
      />
      <div className="flex min-h-0 flex-col gap-4 lg:min-h-[calc(100vh-8rem)] lg:flex-row">
      <aside className="w-full shrink-0 space-y-3 sm:space-y-4 lg:sticky lg:top-24 lg:w-72 lg:self-start xl:w-80">
        <div className="rounded-xl border border-border/80 bg-card/40 p-3 backdrop-blur-md sm:p-4">
          <p className="text-xs font-medium text-muted-foreground">Now</p>
          <h2 className="mt-1 font-semibold leading-tight">{effectiveSnapshot.name}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">
              {DRAFT_PHASE_LABEL[effectiveSnapshot.draftPhase]}
            </Badge>
            <Badge variant="secondary">
              Pick {Math.min(effectiveSnapshot.currentSlotIndex + 1, Math.max(effectiveSnapshot.draftSlotsTotal, 1))}{" "}
              / {effectiveSnapshot.draftSlotsTotal || "-"}
            </Badge>
          </div>
          <Separator className="my-3 sm:my-4" />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Who picks now</p>
            <div
              className={cn(
                "rounded-lg border px-3 py-3 text-sm font-semibold transition-all",
                draftLive && currentTeam
                  ? "border-primary/60 bg-primary/10 shadow-[0_0_30px_-14px_rgba(56,189,248,0.9)]"
                  : "border-border bg-muted/30",
              )}
            >
              {currentTeam?.name ?? "-"}
            </div>
            {franchiseOwnerPhoneMode ? (
              <>
                {viewerFranchiseTeams.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Your franchise</span>
                    {viewerFranchiseTeams.length > 1 ? "s" : ""}:{" "}
                    {viewerFranchiseTeams.map((t) => t.name).join(", ")}
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    No franchise is assigned to this login yet. Ask the commissioner to set you as
                    owner on Teams.
                  </p>
                )}
                {draftLive && currentTeam ? (
                  viewerOwnsClock ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Your franchise is on the clock — tap a player below.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{currentTeam.name}</span> is
                      picking now. You cannot submit a pick for other franchises; browse only until
                      it is your team&apos;s turn.
                    </p>
                  )
                ) : draftLive ? (
                  <p className="text-xs text-muted-foreground">
                    Waiting for the next pick slot. You only submit picks when your franchise is
                    highlighted.
                  </p>
                ) : null}
              </>
            ) : viewerOwnsClock ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">It is your turn to pick.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Only the team owner (or admin) can tap a player on this turn.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/30 p-3 backdrop-blur-md sm:p-4">
          <p className="text-xs font-medium text-muted-foreground">Pick order (snake)</p>
          {franchiseOwnerPhoneMode ? (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Full turn order is hidden on this screen so you only act for your franchise. The room
              display shows everyone&apos;s order.
            </p>
          ) : (
            <ScrollArea className="mt-3 h-44 pr-3 sm:h-64">
              <ol className="space-y-2 text-sm">
                {effectiveSnapshot.draftSlots.map((slot) => {
                  const team = teamsById[slot.teamId];
                  const active = slot.slotIndex === effectiveSnapshot.currentSlotIndex;
                  return (
                    <li
                      key={slot.slotIndex}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-2 py-1.5",
                        active
                          ? "border-primary/70 bg-primary/10"
                          : "border-transparent bg-muted/20",
                      )}
                    >
                      <span className="text-xs text-muted-foreground">
                        #{slot.slotIndex + 1}
                      </span>
                      <span className="truncate font-medium">{team?.name ?? slot.teamId}</span>
                    </li>
                  );
                })}
              </ol>
            </ScrollArea>
          )}
        </div>

        <div className="rounded-xl border border-border/80 bg-card/30 p-3 backdrop-blur-md sm:p-4">
          <p className="text-xs font-medium text-muted-foreground">What happened</p>
          <ScrollArea className="mt-3 h-36 pr-3 sm:h-48">
            <ul className="space-y-2 text-xs text-muted-foreground">
              {effectiveSnapshot.activity.slice(0, 25).map((entry) => (
                <li key={entry.id} className="rounded-md bg-muted/30 px-2 py-1">
                  <span className="font-semibold text-foreground">{entry.action}</span>
                  {entry.message ? ` · ${entry.message}` : null}
                  <ActivityFeedTime iso={entry.createdAt} />
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      </aside>

      <section className="min-w-0 flex-1 space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/20 p-3 backdrop-blur-md sm:p-4 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 md:max-w-md">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="player-search">
              Find by name
            </label>
            <Input
              id="player-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Type part of a name"
              className="bg-background/60"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              value={categoryFilter}
              onValueChange={(value) =>
                setCategoryFilter(value as typeof categoryFilter)
              }
            >
              <SelectTrigger className="w-full bg-background/60">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All groups</SelectItem>
                {(Object.keys(PLAYER_CATEGORY_LABEL) as Array<keyof typeof PLAYER_CATEGORY_LABEL>).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {PLAYER_CATEGORY_LABEL[key]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Select
              value={genderFilter}
              onValueChange={(value) =>
                setGenderFilter(value as Gender | "ALL")
              }
            >
              <SelectTrigger className="w-full bg-background/60">
                <SelectValue placeholder="Women / men" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {genderKeys.map((key) => (
                  <SelectItem key={key} value={key}>
                    {GENDER_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sortMode}
              onValueChange={(value) => setSortMode(value as typeof sortMode)}
            >
              <SelectTrigger className="w-full bg-background/60 sm:col-span-2 lg:col-span-1">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="availability">Free players first</SelectItem>
                <SelectItem value="name_asc">Name A → Z</SelectItem>
                <SelectItem value="category">Group</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {franchiseOwnerPhoneMode && draftLive && !viewerOwnsClock ? (
          <div
            className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
            role="status"
          >
            Browse mode:{' '}
            <span className="font-medium text-foreground">{currentTeam?.name ?? 'Another franchise'}</span>{' '}
            is picking. Submit buttons appear only when your franchise is on the clock.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredPlayers.map((player) => {
            const team = player.assignedTeamId
              ? teamsById[player.assignedTeamId]
              : undefined;
            const canNominateThisCard =
              nominateActionsAllowed &&
              draftLive &&
              viewerOwnsClock &&
              !player.hasConfirmedPick &&
              !player.isUnavailable &&
              !player.isLocked &&
              !player.runsFranchiseLogin &&
              !player.assignedTeamId;

            return (
              <PlayerCard
                key={player.id}
                player={player}
                team={team}
                emphasize={Boolean(canNominateThisCard)}
                hideNominateControl={hideFranchiseOwnerNominate}
                onNominate={
                  canNominateThisCard
                    ? () => void handleNominate(player.id)
                    : undefined
                }
                nominateDisabled={!canNominateThisCard}
              />
            );
          })}
        </div>
      </section>
    </div>
    </>
  );
}

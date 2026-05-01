"use client";

import { motion } from "framer-motion";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DraftPlayerDto, DraftTeamDto } from "@/types/draft";
import { GENDER_LABEL, PLAYER_CATEGORY_LABEL } from "@/constants/player-labels";

interface PlayerCardProps {
  player: DraftPlayerDto;
  team?: DraftTeamDto | null;
  emphasize: boolean;
  onNominate?: () => void;
  nominateDisabled?: boolean;
  /** When true, never render nominate control (defense-in-depth for franchise-owner phone UI). */
  hideNominateControl?: boolean;
}

const badgeWrap =
  "h-auto min-h-7 max-w-full whitespace-normal px-2.5 py-1 text-xs leading-snug sm:text-sm";

export function PlayerCard({
  player,
  team,
  emphasize,
  onNominate,
  nominateDisabled,
  hideNominateControl,
}: PlayerCardProps) {
  const picked = Boolean(player.hasConfirmedPick && player.assignedTeamId);
  const pending =
    !player.hasConfirmedPick &&
    Boolean(player.assignedTeamId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="h-full"
    >
      <Card
        data-state={picked ? "picked" : pending ? "pending" : "available"}
        className={cn(
          "relative flex h-full flex-col overflow-hidden border bg-card/80 p-3 shadow-sm backdrop-blur-sm transition-all duration-300 sm:p-4",
          picked &&
            "pointer-events-none scale-[0.99] opacity-65 grayscale border-muted",
          pending &&
            "border-amber-400/70 ring-2 ring-amber-400/40 shadow-[0_0_40px_-12px_rgba(251,191,36,0.55)]",
          !picked &&
            !pending &&
            emphasize &&
            "cursor-pointer border-primary/40 shadow-[0_0_28px_-10px_rgba(56,189,248,0.55)] hover:border-primary hover:shadow-[0_0_34px_-8px_rgba(56,189,248,0.65)]",
          !picked &&
            !pending &&
            player.runsFranchiseLogin &&
            "opacity-75 border-muted-foreground/30 bg-muted/30",
        )}
      >
        {(picked || pending) && (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/85 via-background/25 to-transparent"
            aria-hidden
          />
        )}
        <div className="relative flex flex-1 flex-col gap-3">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border">
            {player.photoUrl ? (
              <Image
                src={player.photoUrl}
                alt={player.name}
                fill
                sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                unoptimized
                className="object-contain object-center"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-4xl font-semibold text-muted-foreground sm:text-5xl"
                aria-hidden
              >
                {player.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="break-words text-center text-base font-semibold leading-snug tracking-tight sm:text-lg">
              {player.name}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
              <Badge variant="secondary" className={cn(badgeWrap, "text-center")}>
                {PLAYER_CATEGORY_LABEL[player.category]}
              </Badge>
              <Badge variant="outline" className={cn(badgeWrap, "text-center")}>
                {GENDER_LABEL[player.gender]}
              </Badge>
              {player.isUnavailable ? (
                <Badge variant="destructive" className={cn(badgeWrap, "text-center")}>
                  Not here
                </Badge>
              ) : null}
              {player.isLocked ? (
                <Badge variant="outline" className={cn(badgeWrap, "text-center")}>
                  Locked
                </Badge>
              ) : null}
              {player.runsFranchiseLogin ? (
                <Badge variant="outline" className={cn(badgeWrap, "text-center")}>
                  Runs a franchise
                </Badge>
              ) : null}
            </div>
          </div>

          {player.notes ? (
            <p className="break-words text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
              {player.notes}
            </p>
          ) : null}

          {picked && team ? (
            <div className="mt-auto flex flex-col gap-1 rounded-lg bg-muted/70 px-3 py-3 text-center sm:text-left">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
                Taken by
              </span>
              <span className="break-words text-base font-semibold leading-snug sm:text-lg">
                {team.name}
              </span>
            </div>
          ) : null}
          {pending && team ? (
            <div className="mt-auto rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-3 text-center text-sm font-medium leading-snug text-amber-950 sm:text-base dark:text-amber-100">
              Waiting for organizer · {team.shortName ?? team.name}
            </div>
          ) : null}
          {onNominate && !picked && !hideNominateControl ? (
            <button
              type="button"
              disabled={nominateDisabled}
              onClick={onNominate}
              className={cn(
                "mt-auto min-h-12 rounded-lg bg-primary px-4 py-3 text-center text-base font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-14 sm:text-lg",
              )}
            >
              Pick this player
            </button>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}

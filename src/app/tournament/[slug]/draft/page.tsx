import { notFound, redirect } from "next/navigation";

import { DraftRoomClient } from "@/components/draft/draft-room-client";
import { getSessionUser } from "@/lib/auth/session";
import { getTournamentBySlug } from "@/lib/data/tournament-access";
import { fetchDraftSnapshotBySlug } from "@/services/draft-service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function DraftFloorPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/tournament/${slug}/draft`);
  }

  const [tournament, snapshot] = await Promise.all([
    getTournamentBySlug(slug),
    fetchDraftSnapshotBySlug(slug),
  ]);
  if (!tournament || !snapshot) {
    notFound();
  }

  const franchiseOwnerPhoneMode = user.id !== tournament.createdById;

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
          Auction board
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Filter by group or sort the list. When it is your team&apos;s turn, tap{" "}
          <span className="font-medium text-foreground">Pick this player</span>. The organizer
          confirms each choice on the Admin screen.
        </p>
      </header>
      <DraftRoomClient
        slug={slug}
        initialSnapshot={snapshot}
        viewerUserId={user.id}
        enableOwnerPick
        franchiseOwnerPhoneMode={franchiseOwnerPhoneMode}
      />
    </div>
  );
}

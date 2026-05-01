import { notFound, redirect } from "next/navigation";

import { DraftRoomClient } from "@/components/draft/draft-room-client";
import { getSessionUser } from "@/lib/auth/session";
import { fetchDraftSnapshotBySlug } from "@/services/draft-service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OwnerViewPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/tournament/${slug}/owner`);
  }

  const snapshot = await fetchDraftSnapshotBySlug(slug);
  if (!snapshot) {
    notFound();
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
          Your turn on the phone
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Sign in with the email and password your commissioner gave you, then stay on this screen
          during the auction. When your franchise is highlighted, tap a player and wait for the
          organizer to confirm.
        </p>
      </header>
      <DraftRoomClient
        slug={slug}
        initialSnapshot={snapshot}
        viewerUserId={user.id}
        enableOwnerPick
        franchiseOwnerPhoneMode
      />
    </div>
  );
}

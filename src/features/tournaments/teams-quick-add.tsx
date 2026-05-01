"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTeamAction } from "@/features/tournaments/actions";
import {
  OwnerPicker,
  type AssignablePerson,
} from "@/features/tournaments/owner-picker";
import { ImageUploadOrUrlField } from "@/features/uploads/image-upload-or-url-field";

interface TeamsQuickAddProps {
  tournamentSlug: string;
  assignablePeople: AssignablePerson[];
  uploadsEnabled: boolean;
}

export function TeamsQuickAdd({
  tournamentSlug,
  assignablePeople,
  uploadsEnabled,
}: TeamsQuickAddProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await createTeamAction({
        tournamentSlug,
        name: String(formData.get("name") ?? ""),
        shortName: String(formData.get("shortName") ?? "").trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        colorHex: String(formData.get("colorHex") ?? "").trim() || undefined,
        ownerUserId: ownerUserId.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      setOwnerUserId("");
      setLogoUrl("");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="grid gap-4 rounded-xl border border-border/70 bg-card/40 p-6 backdrop-blur-md"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.75fr)_auto] md:grid-rows-[auto_auto] md:gap-x-4 md:gap-y-2">
        <div className="space-y-2 md:contents">
          <Label htmlFor="team-name" className="md:col-start-1 md:row-start-1">
            Franchise name
          </Label>
          <Input
            id="team-name"
            name="name"
            required
            minLength={2}
            placeholder="Court Crushers"
            className="md:col-start-1 md:row-start-2"
          />
        </div>
        <div className="space-y-2 md:contents">
          <Label htmlFor="short" className="md:col-start-2 md:row-start-1">
            Ticker
          </Label>
          <Input
            id="short"
            name="shortName"
            maxLength={8}
            placeholder="CCR"
            className="md:col-start-2 md:row-start-2"
          />
        </div>
        <div className="space-y-2 md:contents">
          <Label htmlFor="quick-owner" className="md:col-start-3 md:row-start-1">
            Franchise owner
          </Label>
          <div className="min-w-0 md:col-start-3 md:row-start-2">
            <OwnerPicker
              id="quick-owner"
              label="Franchise owner"
              hideLabel
              value={ownerUserId}
              onChange={setOwnerUserId}
              people={assignablePeople}
              className="w-full"
            />
          </div>
        </div>
        <div className="flex md:col-start-4 md:row-start-2 md:self-end md:justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-8 w-full min-w-[10rem] md:w-auto"
          >
            {isSubmitting ? "Saving…" : "Add franchise"}
          </Button>
        </div>
      </div>

      <details className="rounded-lg border border-border/50 bg-background/40 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-foreground outline-none">
          Logo & color (optional)
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ImageUploadOrUrlField
            tournamentSlug={tournamentSlug}
            purpose="team-logo"
            label="Franchise logo"
            urlInputId="logoUrl"
            urlValue={logoUrl}
            onUrlChange={setLogoUrl}
            uploadsEnabled={uploadsEnabled}
          />
          <div className="space-y-2">
            <Label htmlFor="colorHex">Accent HEX</Label>
            <Input id="colorHex" name="colorHex" placeholder="#38bdf8" />
          </div>
        </div>
      </details>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

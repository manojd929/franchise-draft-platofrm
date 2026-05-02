import { describe, expect, it } from "vitest";

import { DraftPhase } from "@/generated/prisma/enums";

import { getDraftProgressDisplay } from "./draft-progress";

describe("getDraftProgressDisplay", () => {
  it("shows a fully completed board when the auction is completed", () => {
    const progress = getDraftProgressDisplay({
      draftPhase: DraftPhase.COMPLETED,
      currentSlotIndex: 18,
      draftSlotsTotal: 20,
      picksCount: 18,
    });

    expect(progress.displayPickCount).toBe(20);
    expect(progress.currentPickOrdinal).toBe(20);
    expect(progress.progressPercent).toBe(100);
  });

  it("keeps live progress aligned to the current slot when counts lag behind", () => {
    const progress = getDraftProgressDisplay({
      draftPhase: DraftPhase.LIVE,
      currentSlotIndex: 18,
      draftSlotsTotal: 20,
      picksCount: 17,
    });

    expect(progress.displayPickCount).toBe(19);
    expect(progress.currentPickOrdinal).toBe(19);
    expect(progress.progressPercent).toBe(95);
  });
});

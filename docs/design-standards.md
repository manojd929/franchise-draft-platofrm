# Design Standards

## Mutation Feedback

All user-triggered mutations must show inline visual feedback until the request resolves.

- For server-form submissions in the App Router, use [`PendingSubmitButton`](/Users/manojd929/github/franchise-draft-platform/src/components/ui/pending-submit-button.tsx:1).
- For client-side mutations driven by `useTransition`, local state, or explicit async handlers, use [`Button`](/Users/manojd929/github/franchise-draft-platform/src/components/ui/button.tsx:1) with `pending` and `pendingLabel`.
- Pending labels must describe the action in progress, such as `Generating…`, `Creating tie…`, `Saving pairings…`, `Saving score…`, `Starting…`, `Resetting…`, or `Cancelling…`.
- Do not leave destructive or state-changing controls visually idle while a request is in flight.
- Pending controls should also disable repeated submission by relying on the shared button primitives.

## Contrast and Theme Safety

Every critical page must remain legible in both light and dark mode.

- Never rely on low-contrast muted text for primary instructions, form labels, or authentication flows.
- Inputs, labels, helper text, cards, and page chrome must be checked in dark mode before shipping.
- Authentication screens are high-risk surfaces and should prefer stronger contrast than decorative marketing copy.
- When in doubt, bias toward readable foreground contrast over subtle styling.

## Tournament Backdrops

Tournament pages should inherit a shared themed backdrop instead of each route inventing its own flat page background.

- Use the shared tournament shell at [`src/features/tournament-shell/tournament-theme-shell.tsx`](/Users/manojd929/github/franchise-draft-platform/src/features/tournament-shell/tournament-theme-shell.tsx:1) from the tournament layout, not ad hoc page-level backgrounds.
- The structural backdrop style comes from the commissioner floor theme selected in Settings.
- The tournament brand color should be used as a subtle accent glow, not as the only background treatment.
- The tournament header accent bar can stay, but it is not enough on its own to count as themed page chrome.
- When adding new tournament routes, rely on the layout-level backdrop first and add page-specific effects only when there is a strong product reason.

## QA Expectation

Before shipping UI work:

- Verify the affected flow in light mode.
- Verify the affected flow in dark mode.
- Trigger the mutation and confirm the button shows a pending state until the response resolves.
- Verify tournament pages still read clearly against the shared backdrop and tournament accent glow.

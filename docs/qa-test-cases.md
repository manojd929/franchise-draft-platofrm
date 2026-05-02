# DraftForge QA Test Cases (Detailed)

## 1. Scope
This QA plan validates the full doubles tournament lifecycle for production readiness:
- Authentication and access control
- Tournament creation and setup
- Team and owner management
- Player management
- Draft flow
- Fixtures generation and tournament run
- Leaderboard correctness
- Owner read-only access to results
- UX and responsive behavior

## 2. Personas
- Admin (commissioner)
- Owner (franchise owner)
- Guest (unauthenticated)

## 3. Environment
- URL: `http://localhost:3000`
- Browser: in-app browser + desktop browser + mobile viewport
- Database: existing dev DB (no reset)

## 4. Test Data
- Tournament: `Sunday Badminton League - QA`
- Teams:
  - `QA Smash Bros`
  - `QA Net Ninjas`
  - `QA Shuttle Squad`
  - `QA Drop Shot Kings`
- Owners:
  - `ravi.qa@example.com`
  - `karthik.qa@example.com`
  - `ankit.qa@example.com`
  - `rohit.qa@example.com`
- Players: ~80 QA-prefixed Indian names

## 5. Detailed Test Cases

### A. Authentication and Access

#### A1. Admin login
- Steps:
1. Open `/login`.
2. Enter valid admin email/password.
3. Click `Sign in`.
- Expected:
1. Redirect to dashboard.
2. Tournaments list visible.

#### A2. Owner login
- Steps:
1. Open `/login`.
2. Enter valid owner email/password.
3. Click `Sign in`.
- Expected:
1. Redirect to dashboard.
2. Assigned tournament visible.

#### A3. Guest blocked from protected routes
- Steps:
1. Logout.
2. Open `/tournament/{slug}/teams` directly.
- Expected:
1. Redirect to `/login?next=...`.

#### A4. Owner cannot open admin run pages
- Steps:
1. Login as owner.
2. Open `/tournament/{slug}/admin`.
3. Open `/tournament/{slug}/run`.
- Expected:
1. Admin page blocked (redirect/message).
2. Run page shows admin-only message.

### B. Tournament Creation and Setup

#### B1. Create tournament
- Steps:
1. Login as admin.
2. Go to dashboard.
3. Click create/new tournament.
4. Enter name and picks-per-team.
5. Submit.
- Expected:
1. Tournament created.
2. Unique slug generated.
3. Tournament appears in dashboard list.

#### B2. Validate duplicate/invalid tournament inputs
- Steps:
1. Try empty tournament name.
2. Try extremely long/invalid values.
- Expected:
1. Clear validation messages.
2. No broken state or crash.

#### B3. Soft-delete tournament behavior
- Steps:
1. Delete tournament from dashboard (if available).
2. Refresh dashboard.
- Expected:
1. Tournament removed from active list.
2. No hard-delete side effects in linked data.

### C. Team Creation and Management

#### C1. Create team rows
- Steps:
1. Open `/tournament/{slug}/teams` as admin.
2. Add 4 teams.
- Expected:
1. All teams persist and appear after refresh.

#### C2. Team validations
- Steps:
1. Submit empty team name.
2. Try duplicate team names.
- Expected:
1. Validation errors shown.
2. Invalid rows not created.

#### C3. Owner cannot edit teams
- Steps:
1. Login as owner.
2. Open teams page.
- Expected:
1. Read-only experience.
2. No create/edit/delete actions.

### D. Owner Assignment and Removal

#### D1. Assign owner to team
- Steps:
1. Login as admin.
2. Open teams page.
3. Edit team owner for each team.
4. Select corresponding owner login.
5. Save.
- Expected:
1. Owner shown against team row.
2. Owner mapping persists after refresh.

#### D2. Owner assignment guardrails
- Steps:
1. Try assigning commissioner/admin as owner.
2. Try assigning same owner to invalid team combinations (if rule blocks).
- Expected:
1. Guardrail validation prevents invalid assignment.
2. Clear error message displayed.

#### D3. Remove owner from team
- Steps:
1. As admin, remove owner from a team.
2. Refresh page.
- Expected:
1. Team shows no owner assigned.
2. Owner access impact matches business rules.

#### D4. Remove owner login from tournament
- Steps:
1. Use owner removal flow (if available).
2. Confirm action.
- Expected:
1. Team ownership and linked owner references cleaned per rules.
2. No orphaned broken references.

### E. Player Creation and Management

#### E1. Create players manually
- Steps:
1. Open `/tournament/{slug}/players` as admin.
2. Add player name, category, optional metadata.
- Expected:
1. Player appears in list.
2. Data persists after refresh.

#### E2. Bulk add players
- Steps:
1. Use quick-add/bulk input.
2. Submit ~20 names.
- Expected:
1. All valid rows inserted.
2. Duplicate/invalid rows handled safely.

#### E3. Player validations
- Steps:
1. Submit empty name.
2. Submit invalid category or malformed values.
- Expected:
1. Validation messages shown.
2. No invalid row created.

#### E4. Owner cannot mutate players
- Steps:
1. Login owner and open players page.
- Expected:
1. Read-only access.
2. No create/edit/delete controls.

### F. Draft Flow

#### F1. Shuffle order
- Steps:
1. Open admin draft controls.
2. Trigger shuffle once.
- Expected:
1. Order updates.
2. Persisted across refresh.

#### F2. Start draft and snake order
- Steps:
1. Move draft to live.
2. Perform sequential picks across teams.
- Expected:
1. Snake order pattern honored.
2. Current turn indicator updates correctly.

#### F3. Owner nominate, admin confirm
- Steps:
1. Owner nominates player on turn.
2. Admin confirms pick.
- Expected:
1. Owner cannot confirm.
2. Pick added only after admin confirmation.

#### F3a. Owner-backed player is blocked from draft pool
- Steps:
1. Create or sync a player row with franchise-owner login attached.
2. Open commissioner auction board and owner phone board.
3. Try to nominate or confirm that owner-backed player through auction flow.
- Expected:
1. Owner-backed player does not appear as a normal draftable nominee.
2. The row remains attached to that franchise roster instead of being draftable again.

#### F4. Complete draft
- Steps:
1. Continue until all required slots are filled.
- Expected:
1. Draft enters `COMPLETED`.
2. Fixtures unlock.
3. Tournament navigation group becomes visible for both admin and owner.

### G. Fixtures and Match Operations

#### G1. Generate round robin ties
- Steps:
1. Open fixtures as admin after draft completion.
2. Generate ties with `matchesPerTie = 5`.
- Expected:
1. 6 ties for 4 teams.
2. 5 matches per tie.

#### G1a. Owner-backed player participates in fixtures
- Steps:
1. Ensure at least one team has an owner-backed player row on its roster.
2. Complete the auction.
3. Generate fixtures.
- Expected:
1. Owner-backed player is eligible for automatic doubles pairings.
2. The owner is not silently excluded from fixture participant rotation.

#### G2. Owner fixtures visibility
- Steps:
1. Login as owner.
2. Open fixtures page.
- Expected:
1. Owner sees ties and all match results.
2. Owner cannot generate/regenerate fixtures.

#### G2a. Tournament navigation stays hidden before auction completion
- Steps:
1. Login as admin before ending the auction.
2. Login as owner before ending the auction.
- Expected:
1. Neither admin nor owner sees the Tournament nav group yet.
2. Fixtures, leaderboard, and run surfaces are not shown in the tournament nav until auction completion.

#### G3. Update match status/scores (admin)
- Steps:
1. Open run page as admin.
2. Set match status to completed.
3. Enter side scores and save.
- Expected:
1. Winner side set correctly.
2. Match state persists.

#### G4. Edit completed match
- Steps:
1. Modify score of completed match.
2. Save update.
- Expected:
1. Standings recalculate.
2. No double counting.

### H. Leaderboard and Results

#### H1. Standings formula correctness
- Steps:
1. Complete sample matches with known outcomes.
2. Open standings/leaderboard.
- Expected:
1. Win = 1 point, Loss = 0.
2. W/L/Scored/Conceded/Diff all correct.

#### H2. Owner read-only leaderboard access (mandatory)
- Steps:
1. Login as owner.
2. Open `/tournament/{slug}/fixtures`.
- Expected:
1. Owner can view full leaderboard.
2. Owner can view results of all matches.
3. No owner edit controls shown.

#### H3. Admin-owner leaderboard parity
- Steps:
1. Compare standings shown for admin vs owner.
- Expected:
1. Same ranking and numbers shown.

### I. UX and Responsive

#### I1. Mobile owner usability
- Steps:
1. Open owner pages on mobile viewport.
- Expected:
1. No layout break.
2. Tables scroll correctly.

#### I2. Empty/loading states
- Steps:
1. Open fixtures before generation.
2. Open pages with no records.
- Expected:
1. Clear and actionable empty-state copy.
2. No dead-end screens.

#### I3. Action clarity
- Steps:
1. Review labels for critical operations.
- Expected:
1. Draft/run/fixture actions are unambiguous.

## 6. Severity Classification
- P0: Security/access-control breach, data corruption, app-blocking flow failure
- P1: Core flow broken but workaround exists
- P2: UX or minor functional issue

## 7. Exit Criteria
- Zero open P0
- No unresolved P1 in core lifecycle (auth, draft, fixtures, scoring, leaderboard)
- Owner read-only leaderboard access verified
- Mobile owner checks pass

# Test Plan — Campus Alumni Mentorship & Career Insights Hub

## Automated tests

```bash
npm run test       # Vitest: zod validators + mapDatabaseError (pure logic, no DB needed)
npx tsc --noEmit   # Full type-check across the app
npx eslint .       # Lint (react-hooks rules included)
```

These intentionally avoid needing a live MySQL/Qdrant connection so they
run in CI without infrastructure. End-to-end behavior (anything that
touches the database) is covered by the manual checklist below — running
real `CALL`s, triggers, and transactions is more convincing evidence of
correctness here than mocking the MySQL driver.

## Manual end-to-end checklist

Run `npm run db:init && npm run seed` first, then `npm run dev`.

### Auth & RBAC
- [ ] Register as a student → redirected to `/dashboard/student`, `is_verified = FALSE`.
- [ ] Register as alumni with a bio under 15 chars → client + server both reject it.
- [ ] Register with an email that already exists → `409 ER_DUP_ENTRY`, friendly message.
- [ ] Log in with wrong password → `401`, generic "Invalid email or password" (no user enumeration).
- [ ] Visit `/dashboard/admin` while logged in as a student → redirected to `/dashboard/student`.
- [ ] Log out → session cookie cleared, protected pages redirect to `/login`.

### Admin verification & audit trail
- [ ] As `admin@pes.edu`, open the Verification Queue → see any unverified seeded/registered users.
- [ ] Click **Verify** on a pending alumnus → `is_verified_by_admin` and `users.is_verified` both flip to true.
- [ ] Confirm a new row appears in the Audit Trail panel with `action_type = USER_VERIFIED` and the correct admin's name (proves `@acting_admin_id` + the trigger work together).
- [ ] Confirm `sp_get_hub_stats()` KPIs (Verified Alumni, Pending Verifications) update accordingly.

### Mentorship request lifecycle (transactions + capacity)
- [ ] As a student, request a verified mentor with capacity > 0 → request appears as `pending` for both parties.
- [ ] Try to request the same mentor again while the first request is still pending → `409 DUPLICATE_REQUEST`.
- [ ] As the alumnus, **Accept** the request → mentee_capacity decrements by 1; request becomes `accepted`.
- [ ] Repeat accepting requests until capacity hits 0, then attempt one more accept → `409 NO_CAPACITY` (verifies the `FOR UPDATE` lock + `chk_alumni_mentee_capacity` CHECK constraint both hold).
- [ ] **Reject** a different pending request → capacity unchanged, status becomes `rejected`.
- [ ] **Cancel** an accepted request → capacity restored by 1.
- [ ] Schedule a session on an accepted request → row appears in `sessions`, visible to both parties via `Active_Mentorships_View`.
- [ ] Mark the session **Completed** → request status flips to `completed`, capacity restored exactly once (re-clicking "mark completed" must not double-increment — guarded by the `WHERE status = 'accepted'` update + affectedRows check).
- [ ] As the student, submit feedback (1-5 stars) on the completed session → appears on the request card.
- [ ] Submit feedback a second time for the same session → rejected (`feedback.session_id` is `UNIQUE`).

### Career insights
- [ ] As an alumnus, publish an insight with 2 skill tags.
- [ ] As a student, search insights for a keyword from the title/content → result ranked via `MATCH ... AGAINST` (`relevance` in the API response).
- [ ] Open an insight twice → `view_count` increments each time.
- [ ] As the publishing alumnus, delete your own insight → removed; attempting to delete someone else's → `403`.

### Semantic (vector) search — requires `GEMINI_API_KEY` + a running Qdrant
- [ ] Without the env vars set: student's "Find a Mentor" search returns a 503 and the UI falls back to the plain directory (confirms graceful degradation).
- [ ] With the env vars set and `npm run seed` re-run: search a natural-language query (e.g. *"someone who can help me with cloud infrastructure and interview prep"*) → top-3 mentors returned, ranked by `match_score`, matching semantically even when no literal keyword overlaps the bio.
- [ ] Edit an alumnus's bio via the Alumni dashboard profile editor → response reports `vectorSynced: true`; re-running the same search reflects the updated bio.

### Security spot-checks
- [ ] Inspect `document.cookie` in devtools → the session cookie is **not** listed (HttpOnly).
- [ ] Call a protected API route (e.g. `/api/admin/stats`) via `curl` with no cookie → `401`.
- [ ] Call `/api/mentorship-requests/:id` PATCH as a student trying to `accept` their own request → `403` (only the alumnus can accept/reject).

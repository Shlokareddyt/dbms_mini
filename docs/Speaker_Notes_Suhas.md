# Presenter Speaker Notes — Suhas Srinath Iyengar (`PES1UG24AM291`)

**Deck File:** [AlumniHub_DBMS_Phase1_Suhas.pptx](file:///c:/Users/Suhas%20Sreenath/Desktop/dbms/docs/AlumniHub_DBMS_Phase1_Suhas.pptx)  
**Target Duration:** 5–7 minutes (10 slides)

---

### Slide 1 — Title Slide
> "Good morning/afternoon. I'm **Suhas Srinath Iyengar (PES1UG24AM291)**, presenting my part of our DBMS Level 3 project: the **Campus Alumni Mentorship & Career Insights Hub**. In Phase 1, I focused on the MySQL 8.0 relational schema, advanced SQL features, secure Next.js database pooling, and role-based authentication."

### Slide 2 — Problem Statement & Option 2 Justification
> "Our project goes beyond basic CRUD because campus mentorship needs strict capacity enforcement, verified roles, audit trails, and intelligent mentor matching. Following **Option 2**, we pair **MySQL 8.0** for ACID-critical relational data (users, requests, capacity, sessions, logs) with **Qdrant** for unstructured semantic vector search across alumni bios."

### Slide 3 — 12-Table Normalized Relational Schema (`alumni_hub`)
> "In `sql/01_schema.sql`, we designed 12 normalized tables in 3NF. `users` stores shared login credentials and role, specialized 1:1 into `students` and `alumni` via UNIQUE foreign keys. Skills and tags use composite-PK junction tables (`student_skills`, `alumni_expertise`, `insight_tags`), and mentorship flows cleanly from `mentorship_requests` to 1:1 `sessions` and `feedback`."

### Slide 4 — Database-Level Validation & `ALTER TABLE` Extensions
> "To guarantee data integrity even outside the application layer, `sql/02_advanced_features.sql` adds `ALTER TABLE` `CHECK` constraints—most importantly `chk_alumni_mentee_capacity` (`mentee_capacity >= 0`) so concurrent bookings can never overbook a mentor. We also added 7 B-Tree and `FULLTEXT` indexes for query performance."

### Slide 5 — Advanced SQL: Views & Stored Procedures
> "We implemented two SQL Views—`Active_Mentorships_View` joins 6 tables (`mentorship_requests`, `students`, `alumni`, `users`, `sessions`, `feedback`) so dashboards query one clean view instead of repeating joins in TypeScript. For analytics, `CALL sp_get_hub_stats()` returns platform KPIs, top 8 skills using `JOIN`, `GROUP BY`, `HAVING`, and `ORDER BY`, plus industry capacity totals."

### Slide 6 — Advanced SQL: Verification Trigger & Registration Transaction
> "Whenever `users.is_verified` changes, `trg_log_user_verification` automatically inserts an audit record into `admin_actions_log`, capturing the acting admin via MySQL session variable `@acting_admin_id`. Meanwhile, `/api/auth/register` wraps inserts across `users`, `students`/`alumni`, and skill junctions inside an explicit ACID transaction (`BEGIN` / `COMMIT` / `ROLLBACK`) so failed constraints never leave orphan user accounts."

### Slide 7 — Database–Application Integration (`src/lib/db.ts`)
> "We intentionally used `mysql2/promise` with parameterized `?` queries instead of an ORM so every SQL feature is transparent for evaluation and protected from SQL injection. Credentials stay in gitignored `.env.local`, and `mapDatabaseError()` converts MySQL error codes like `1062` (duplicate email) and `3819` (`CHECK` constraint violation) into HTTP `409`/`400` JSON errors shown as clean UI error toasts."

### Slide 8 — Authentication & Role-Based Access Control (`src/lib/auth.ts`)
> "Passwords are salted and hashed with `bcryptjs` (cost 10) and never stored or returned in plain text. Successful login issues an `HS256` JWT inside an `HttpOnly`, `SameSite=Lax` cookie via `jose`. Both Server Components and API routes enforce `requireAuth(allowedRoles)` across `student`, `alumni`, and `admin` roles."

### Slide 9 — Live Phase 1 Verification
> "Everything in Phase 1 is verified against our running MySQL 8.0 instance: `npm run db:init` sets up all 12 tables and advanced SQL objects idempotently, `npm run seed` populates 15 skills and demo accounts, `tsc --noEmit` passes with zero errors, and the UI is live at `localhost:3000` and pushed to `Shlokareddyt/dbms_mini`."

### Slide 10 — Summary & Phase 2/3 Roadmap
> "That completes my Phase 1 deliverables—relational schema, advanced SQL features, DB pooling/error handling, and RBAC auth. Next, in Phase 2 we connect transactional session requests, the verification trigger UI, and stored procedure analytics, followed by Phase 3 integrating Gemini embeddings and Qdrant for top-3 semantic mentor matching. Thank you!"

---

### Likely Viva Questions & Crisp Answers
1. **Why not store embeddings in MySQL?**  
   MySQL lacks native HNSW vector indexing for fast approximate nearest-neighbor cosine search; Qdrant indexes high-dimensional vectors natively while MySQL enforces ACID relational integrity.
2. **How does the MySQL trigger know which admin verified a user?**  
   Before running `UPDATE users SET is_verified = ?`, the admin API sets `SET @acting_admin_id = ?` on that same connection, and the trigger reads `@acting_admin_id` when inserting into `admin_actions_log`.
3. **What happens if a duplicate email is submitted on `/register`?**  
   MySQL throws `ER_DUP_ENTRY` (1062), `withTransaction()` rolls back, `mapDatabaseError()` returns HTTP `409 Conflict`, and `ToastProvider` displays `"An account with this email address already exists."`


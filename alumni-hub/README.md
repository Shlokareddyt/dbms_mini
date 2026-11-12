# Campus Alumni Mentorship & Career Insights Hub

Full-stack **Next.js (App Router) + MySQL 8.0 + Qdrant Vector Search** platform built for the DBMS Level 3 Experiential Learning Project.

> **Full project documentation** (ER diagram, data dictionary, API route
> map, security notes, test plan) lives in the [repository root
> README](../README.md). This file covers only app-level setup. See
> [`TESTING.md`](./TESTING.md) for the test plan.

## Repository Structure

- `../sql/01_schema.sql` — 12-table normalized MySQL 8.0 relational schema (`alumni_hub`)
- `../sql/02_advanced_features.sql` — `ALTER TABLE` constraints, indexes, `Active_Mentorships_View`, `Alumni_Directory_View`, `trg_log_user_verification` trigger, and `sp_get_hub_stats` stored procedure
- `../sql/03_seed.sql` — Skill catalog seed data
- `alumni-hub/` — Next.js App Router frontend & API Route Handlers

## Setup Instructions

1. **Initialize MySQL 8.0 Database**
   Run the SQL scripts in order inside MySQL Workbench or MySQL 8.0 CLI:
   ```sql
   SOURCE ../sql/01_schema.sql;
   SOURCE ../sql/02_advanced_features.sql;
   ```

2. **Configure Environment Variables**
   Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```
   Never commit `.env.local` to Git.

3. **Install Dependencies, Initialize & Seed**
   ```bash
   npm install
   npm run db:init
   npm run seed
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` and verify MySQL connectivity at `http://localhost:3000/api/health`.

5. **Run Tests**
   ```bash
   npm run test
   ```

Optional — to enable Phase 3 semantic mentor search, also set
`GEMINI_API_KEY` and `QDRANT_URL` in `.env.local` before running `npm run
seed` (see the root README §6 for details).

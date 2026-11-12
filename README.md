# Campus Alumni Mentorship & Career Insights Hub

**PES University — DBMS Experiential Learning (Level 3 Project)**  
Full-stack mentorship and career insights platform combining **MySQL 8.0** (normalized relational schema, ACID transactions, views, triggers, stored procedures, and constraints) with **Qdrant Vector Search** (semantic alumni mentor matching).

## Repository Structure

```text
.
├── sql/
│   ├── 01_schema.sql             # 12-table normalized MySQL 8.0 DDL (alumni_hub)
│   ├── 02_advanced_features.sql  # ALTER constraints, indexes, views, trigger, stored procedure
│   └── 03_seed.sql               # Starter skills catalog
└── alumni-hub/                   # Next.js (App Router, TypeScript, Tailwind CSS)
    ├── src/lib/db.ts             # mysql2/promise pool, transactions, constraint error mapping
    ├── src/lib/auth.ts           # bcryptjs password hashing, jose JWT cookies, RBAC guards
    ├── src/app/api/              # Next.js API Route Handlers (/health, /skills, /auth/*)
    └── scripts/                  # Idempotent DB initializer (db:init) & demo seeder (seed)
```

## Setup & Execution

1. **Configure Environment Variables**
   ```bash
   cd alumni-hub
   cp .env.example .env.local
   ```
   Update `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE=alumni_hub`, and `JWT_SECRET` inside `alumni-hub/.env.local`.

2. **Install Dependencies & Initialize MySQL 8.0**
   ```bash
   npm install
   npm run db:init
   npm run seed
   ```

3. **Run the Application**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

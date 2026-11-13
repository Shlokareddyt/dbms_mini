# Full Project Presentation & Viva Defense Guide

**Project:** Campus Alumni Mentorship & Career Insights Hub  
**Student:** Suhas Srinath Iyengar (`PES1UG24AM291`)  
**Institution:** PES University — DBMS Experiential Learning (Level 3 Project)  
**Slides File:** [AlumniHub_DBMS_FullProject_Presentation.pptx](file:///c:/Users/Suhas%20Sreenath/Desktop/dbms/docs/AlumniHub_DBMS_FullProject_Presentation.pptx) (14 Slides, 16:9 Widescreen)  
**Repository:** https://github.com/Shlokareddyt/dbms_mini

---

## Slide-by-Slide Script & Academic Explanations

### Slide 1: Title & Overview
- **Spoken Script:**  
  "Good morning/afternoon respected evaluators. I am Suhas Srinath Iyengar (PES1UG24AM291). Today I will be presenting our DBMS Level 3 project: the **Campus Alumni Mentorship & Career Insights Hub**. Our system goes well beyond basic CRUD operations by combining a 12-table 3NF normalized MySQL 8.0 relational database with Option 2: a vector similarity search engine powered by Gemini embeddings and Qdrant."

### Slide 2: Problem Statement & Paradigm Justification (Option 2)
- **Rubric Link:** Requirement 3 (Option 2: SQL + Vector DB) & Requirement 18 (Justification of DB technologies).
- **Spoken Script:**  
  "Our project addresses three major real-world challenges in college career mentoring: mentor overbooking from concurrent requests, lack of administrative audit trails, and rigid keyword search. We selected **Option 2 (SQL + Vector Database)**. MySQL 8.0 provides ACID transaction guarantees, row-level locking, and declarative constraints for slot capacity and bookings. Qdrant provides approximate nearest neighbor (ANN) vector retrieval using Cosine distance over 768-dimensional Gemini embeddings, allowing students to search with natural-language career goals."

### Slide 3: 12-Table Normalized Relational Architecture
- **Rubric Link:** Requirement 4 (ER Diagram & Relational Schema in 3NF).
- **Spoken Script:**  
  "Our relational schema consists of 12 tables in 3NF across four logical domains:
  1. *Identity & Profile Specialization (1:1):* `users` holds authentication credentials and role, specialized into `students` and `alumni` via UNIQUE foreign keys with `ON DELETE CASCADE`.
  2. *Skills Taxonomy (M:N):* `skills` catalog connects to students and alumni via `student_skills` and `alumni_expertise` composite-primary-key junction tables.
  3. *Mentorship Lifecycle (1:N -> 1:1 -> 1:1):* `mentorship_requests` tracks student-alumnus applications, linking 1:1 to scheduled `sessions` and 1:1 to session `feedback`.
  4. *Governance & Insights:* `career_insights` tagged with skills via `insight_tags`, and an administrative audit trail in `admin_actions_log`."

### Slide 4: Database-Level Constraints & ALTER DDL
- **Rubric Link:** Requirement 5 (ALTER statements) & Requirement 12 (Database-level input validation).
- **Spoken Script:**  
  "We wrote explicit `ALTER TABLE` statements to enforce business invariants inside MySQL rather than relying solely on JavaScript validation:
  - `chk_alumni_mentee_capacity`: guarantees `mentee_capacity >= 0`, making negative overbooking physically impossible at the storage engine level.
  - `chk_session_duration_positive`: ensures meeting durations are positive.
  - `chk_insight_view_count`: enforces non-negative analytics counters.
  We also created 7 targeted B-Tree indexes for fast foreign-key joins, and a `FULLTEXT` index on `career_insights(title, content)` to demonstrate SQL `MATCH ... AGAINST` keyword search."

### Slide 5: Advanced SQL #1 — ACID Transactions & Concurrency Control
- **Rubric Link:** Requirement 7 (Advanced Feature: Transactions).
- **Spoken Script:**  
  "Our first advanced SQL concept is ACID Transactions. When a student books a mentorship session, the API executes an explicit transaction:
  1. It performs `SELECT mentee_capacity FROM alumni WHERE alumni_id = ? FOR UPDATE`, placing an exclusive row-level lock that serializes concurrent requests and eliminates race conditions.
  2. It validates that capacity > 0.
  3. It inserts the request into `mentorship_requests`.
  4. It decrements `mentee_capacity = mentee_capacity - 1`.
  5. It calls `COMMIT`. Any constraint violation or exception triggers `ROLLBACK`, leaving zero orphan records."

### Slide 6: Advanced SQL #2 — SQL Views
- **Rubric Link:** Requirement 7 (Advanced Feature: Views).
- **Spoken Script:**  
  "Our second advanced SQL concept is Views. Instead of writing complex 6-table joins in every Next.js route, we created `Active_Mentorships_View`. It joins `mentorship_requests`, `students`, `alumni`, `users` twice, `sessions`, and `feedback`. Our dashboard APIs simply query `SELECT * FROM Active_Mentorships_View WHERE student_id = ?`. We also created `Alumni_Directory_View`, which uses `GROUP_CONCAT(DISTINCT sk.name)` to aggregate many-to-many skills directly inside MySQL."

### Slide 7: Advanced SQL #3 — Audit Triggers
- **Rubric Link:** Requirement 7 (Advanced Feature: Triggers).
- **Spoken Script:**  
  "Our third advanced SQL feature is the `trg_log_user_verification` trigger on `users`. An interesting technical challenge here was that MySQL triggers have no native HTTP request context—they only see `OLD` and `NEW` rows. We resolved this by having the Admin API set a MySQL session variable: `SET @acting_admin_id = ?` on that connection right before updating `users`. The trigger reads `@acting_admin_id` and automatically logs a non-repudiable record into `admin_actions_log`."

### Slide 8: Advanced SQL #4 — Stored Procedures
- **Rubric Link:** Requirement 7 (Advanced Feature: Stored Procedures) & Requirement 6 (JOIN, GROUP BY, HAVING, ORDER BY).
- **Spoken Script:**  
  "Our fourth advanced SQL feature is `sp_get_hub_stats()`. In a single database round-trip, it computes three analytical result sets:
  1. High-level platform KPIs (verified mentors, active sessions, average rating).
  2. The top 8 skills by combining `student_skills` and `alumni_expertise` using `LEFT JOIN`, `GROUP BY`, `HAVING total_mentions > 0`, and `ORDER BY total_mentions DESC`.
  3. Industry mentorship capacity using `SUM(mentee_capacity)`."

### Slide 9: Option 2 — Vector Similarity Search
- **Rubric Link:** Requirement 3 & 8 (Vector Database / Semantic Search).
- **Spoken Script:**  
  "For Option 2, alumni mentor profiles are converted into a canonical text string and encoded into 768-dimensional dense vectors using Google's Gemini `embedContent` API with `outputDimensionality = 768`. Vectors are indexed in Qdrant using the Cosine distance metric. When a student enters a natural-language query like *'I want to learn about AI startups'*, Qdrant returns the top 3 mathematical matches, which we hydrate with live MySQL capacity numbers."

### Slide 10: Full-Stack Web Interface & Multi-Role RBAC
- **Rubric Link:** Requirement 9 (Next.js Web Interface) & Requirement 11 (Authentication & 2+ Roles).
- **Spoken Script:**  
  "The web application is built on Next.js 16 with TypeScript and Tailwind CSS. We implemented three distinct role-based dashboards:
  - **Student:** Semantic mentor search, request submission, active session tracking, and 1–5 star feedback rating.
  - **Alumni:** Slot capacity management, request acceptance/rejection, session scheduling, and career insight publishing.
  - **Admin:** User verification queue, trigger audit log feed, and stored procedure analytics charts."

### Slide 11: End-to-End System Architecture
- **Rubric Link:** Requirement 10 & 14 (System Architecture & Integration).
- **Spoken Script:**  
  "This architecture diagram illustrates the flow across our entire stack: client-side Zod validation -> Next.js Route Handlers -> `mysql2/promise` connection pool and Qdrant client -> MySQL 8.0 storage engine and Qdrant vector collection."

### Slide 12: Quality, Verification & Live Proof
- **Rubric Link:** Requirement 12 & 15 (Testing & Git Repository).
- **Spoken Script:**  
  "We maintain high engineering rigor: 18 automated unit tests written in Vitest test our Zod validators and MySQL error code mappings with 100% pass rate. TypeScript type checking passes with zero errors. All database initialization and seeding is automated via `npm run db:init` and `npm run seed`."

### Slide 13: Rubric Compliance Matrix
- **Rubric Link:** Summary against syllabus guidelines.
- **Spoken Script:**  
  "This matrix confirms that our project satisfies 100% of the PES University Level 3 requirements. We implemented six advanced database features where four were required, integrated Option 2 vector search, and enforced complete database and web security."

### Slide 14: Conclusion & Viva Defense
- **Spoken Script:**  
  "In conclusion, our project demonstrates that relational databases and vector search engines are complementary technologies. I am ready for the live demonstration and happy to answer your questions."

---

## High-Probability Viva Questions & Crisp Answers

#### Q1: Why did you use `SELECT ... FOR UPDATE` instead of a simple UPDATE statement?
**Answer:**  
"A simple `UPDATE alumni SET mentee_capacity = mentee_capacity - 1 WHERE alumni_id = ?` allows two simultaneous requests to read `capacity = 1` before either writes, resulting in two students booking the same last slot. `SELECT ... FOR UPDATE` applies an exclusive row-level lock on the alumnus's row during the read phase, serializing concurrent transactions and preventing race conditions."

#### Q2: Why use a secondary Vector Database (Qdrant) instead of storing vectors in MySQL?
**Answer:**  
"Standard MySQL 8.0 does not support native vector data types or HNSW (Hierarchical Navigable Small World) indexing. Storing high-dimensional embeddings in MySQL requires an $O(N)$ full table scan calculating cosine similarity on every row, which does not scale. Qdrant provides specialized indexing for sub-millisecond approximate nearest neighbor retrieval while MySQL handles ACID transactional data."

#### Q3: How does the MySQL trigger know which administrator verified a user?
**Answer:**  
"MySQL triggers run inside the database engine and cannot access HTTP headers or cookies. Before executing `UPDATE users SET is_verified = ?`, our Next.js API executes `SET @acting_admin_id = ?` on that same connection. The `trg_log_user_verification` trigger reads `@acting_admin_id` to insert the correct administrator ID into `admin_actions_log`."

#### Q4: What happens if an alumnus's capacity is zero and another request arrives?
**Answer:**  
"The transaction reads `mentee_capacity <= 0` under lock and throws an error. Furthermore, if an update were attempted, MySQL's `chk_alumni_mentee_capacity` constraint (`mentee_capacity >= 0`) causes MySQL to reject the write with error code `3819 (ER_CHECK_CONSTRAINT_VIOLATED)`. The transaction executes `ROLLBACK`, and our `mapDatabaseError` helper returns HTTP 409 to display an error toast to the student."

#### Q5: How do you prevent SQL injection without an ORM like Prisma?
**Answer:**  
"We use `mysql2/promise` with parameterized prepared statements (`pool.execute(sql, [param1, param2])`). Input values are sent to the database engine separately from the SQL statement in a binary protocol, making SQL injection impossible. We also keep `multipleStatements: false` on general application queries."

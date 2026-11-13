import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import mysql, { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { QdrantClient } from "@qdrant/js-client-rest";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

/**
 * Standalone (no "@/lib/*" alias) copy of the Phase 3 embedding call —
 * this script runs outside the Next.js app via `tsx`, so it duplicates
 * the small amount of logic in src/lib/embeddings.ts & src/lib/qdrant.ts
 * rather than depending on bundler-only path resolution.
 */
async function embedTextStandalone(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: 768,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Gemini embedding failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } };
  if (!data.embedding?.values) throw new Error("No embedding values returned.");
  return data.embedding.values;
}

async function seed() {
  const host = process.env.MYSQL_HOST || "localhost";
  const port = Number(process.env.MYSQL_PORT || "3306");
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE || "alumni_hub";

  if (!user || password === undefined) {
    throw new Error(
      "Missing MYSQL_USER or MYSQL_PASSWORD in .env.local. Copy .env.example to .env.local first."
    );
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
  });

  try {
    console.log("Seeding skills catalog...");
    const skillCatalog = [
      ["Machine Learning", "AI & Data"],
      ["Generative AI & LLMs", "AI & Data"],
      ["Data Engineering", "AI & Data"],
      ["System Design", "Software Engineering"],
      ["Full-Stack Web Development", "Software Engineering"],
      ["Distributed Systems", "Software Engineering"],
      ["Cloud Architecture (AWS/GCP)", "Cloud & DevOps"],
      ["Kubernetes & Docker", "Cloud & DevOps"],
      ["Cybersecurity", "Security"],
      ["Product Management", "Product & Strategy"],
      ["Venture Capital & Startups", "Entrepreneurship"],
      ["Technical Interview Prep", "Career Growth"],
      ["Resume & Portfolio Review", "Career Growth"],
      ["Embedded Systems & IoT", "Hardware & Systems"],
      ["Database Internals", "AI & Data"],
    ];

    for (const [name, category] of skillCatalog) {
      await conn.execute(
        `INSERT IGNORE INTO skills (name, category) VALUES (?, ?)`,
        [name, category]
      );
    }

    const [skillRows] = await conn.execute<RowDataPacket[]>(
      `SELECT skill_id, name FROM skills`
    );
    const skillMap = new Map<string, number>();
    for (const row of skillRows) {
      skillMap.set(row.name, row.skill_id);
    }

    async function ensureUser(
      name: string,
      email: string,
      plainPassword: string,
      role: "student" | "alumni" | "admin",
      isVerified: boolean
    ): Promise<number> {
      const [existing] = await conn.execute<RowDataPacket[]>(
        `SELECT user_id FROM users WHERE email = ?`,
        [email]
      );
      if (existing.length > 0) {
        return existing[0].user_id;
      }
      const hash = await bcrypt.hash(plainPassword, 10);
      const [res] = await conn.execute<ResultSetHeader>(
        `INSERT INTO users (name, email, password_hash, role, is_verified)
         VALUES (?, ?, ?, ?, ?)`,
        [name, email, hash, role, isVerified]
      );
      return res.insertId;
    }

    // 1. Seed Admin
    await ensureUser(
      "Campus Hub Admin",
      "admin@pes.edu",
      "Admin@1234",
      "admin",
      true
    );

    // 2. Seed Students
    const student1UserId = await ensureUser(
      "Aarav Sharma",
      "student@pes.edu",
      "Student@1234",
      "student",
      true
    );
    await conn.execute(
      `INSERT IGNORE INTO students (user_id, major, grad_year, bio, career_goals)
       VALUES (?, ?, ?, ?, ?)`,
      [
        student1UserId,
        "CSE (AI & Machine Learning)",
        2027,
        "Undergraduate passionate about building LLM products and distributed systems.",
        "Join an early-stage AI startup or backend engineering team after graduation.",
      ]
    );

    // 3. Seed Alumni Mentors
    const mentors = [
      {
        name: "Ananya Rao",
        email: "ananya.rao@alumni.pes.edu",
        company: "Sarvam AI",
        title: "Founding ML Engineer",
        industry: "AI Startups",
        gradYear: 2020,
        capacity: 3,
        bio: "Co-built production LLM inference pipelines and agentic RAG platforms at an AI startup. Happy to mentor students on AI startups, fine-tuning, and ML systems engineering.",
        skills: [
          "Generative AI & LLMs",
          "Machine Learning",
          "Venture Capital & Startups",
        ],
      },
      {
        name: "Rohan Deshmukh",
        email: "rohan.d@alumni.pes.edu",
        company: "Stripe",
        title: "Staff Backend Engineer",
        industry: "FinTech & Distributed Systems",
        gradYear: 2018,
        capacity: 2,
        bio: "Architecting high-throughput payment ledgers, PostgreSQL/MySQL sharding, and fault-tolerant microservices. Mentor on system design, database internals, and backend interviews.",
        skills: [
          "Distributed Systems",
          "System Design",
          "Database Internals",
          "Technical Interview Prep",
        ],
      },
      {
        name: "Meera Krishnan",
        email: "meera.k@alumni.pes.edu",
        company: "Google Cloud",
        title: "Senior Cloud Architect",
        industry: "Cloud Infrastructure",
        gradYear: 2019,
        capacity: 4,
        bio: "Specializing in Kubernetes multi-region deployments, cloud security, and full-stack DevOps pipelines. Open to reviewing resumes and guiding cloud capstone projects.",
        skills: [
          "Cloud Architecture (AWS/GCP)",
          "Kubernetes & Docker",
          "Full-Stack Web Development",
          "Resume & Portfolio Review",
        ],
      },
    ];

    for (const m of mentors) {
      const uid = await ensureUser(
        m.name,
        m.email,
        "Alumni@1234",
        "alumni",
        true
      );

      await conn.execute(
        `INSERT IGNORE INTO alumni (
          user_id, current_company, job_title, industry, grad_year, bio, mentee_capacity, is_verified_by_admin
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid,
          m.company,
          m.title,
          m.industry,
          m.gradYear,
          m.bio,
          m.capacity,
          true,
        ]
      );

      const [alRows] = await conn.execute<RowDataPacket[]>(
        `SELECT alumni_id FROM alumni WHERE user_id = ?`,
        [uid]
      );
      if (alRows[0]) {
        for (const skillName of m.skills) {
          const sid = skillMap.get(skillName);
          if (sid) {
            await conn.execute(
              `INSERT IGNORE INTO alumni_expertise (alumni_id, skill_id) VALUES (?, ?)`,
              [alRows[0].alumni_id, sid]
            );
          }
        }
      }
    }

    // 4. Phase 3 — best-effort Qdrant sync for seeded mentors. Skipped
    // entirely (not an error) when GEMINI_API_KEY / QDRANT_URL aren't set,
    // or when Qdrant is offline.
    const isGeminiConfigured =
      Boolean(process.env.GEMINI_API_KEY) &&
      process.env.GEMINI_API_KEY !== "your_gemini_api_key_here";

    if (isGeminiConfigured && process.env.QDRANT_URL) {
      try {
        console.log("Embedding & indexing seeded mentors into Qdrant...");
        const qdrant = new QdrantClient({
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_API_KEY || undefined,
          checkCompatibility: false,
        });
        const collection = process.env.QDRANT_COLLECTION || "alumni_profiles";
        const exists = await qdrant.collectionExists(collection);
        if (!exists.exists) {
          await qdrant.createCollection(collection, {
            vectors: { size: 768, distance: "Cosine" },
          });
        }

        for (const m of mentors) {
          const [alRows] = await conn.execute<RowDataPacket[]>(
            `SELECT alumni_id, user_id FROM alumni WHERE user_id = (SELECT user_id FROM users WHERE email = ?)`,
            [m.email]
          );
          const alumni = alRows[0];
          if (!alumni) continue;

          const text = `Mentor: ${m.name}. Role: ${m.title} at ${m.company}. Industry: ${m.industry}. Expertise: ${m.skills.join(", ")}. Bio: ${m.bio}`;
          try {
            const vector = await embedTextStandalone(text);
            await qdrant.upsert(collection, {
              wait: true,
              points: [
                {
                  id: alumni.alumni_id,
                  vector,
                  payload: {
                    alumni_id: alumni.alumni_id,
                    user_id: alumni.user_id,
                    name: m.name,
                    current_company: m.company,
                    job_title: m.title,
                    industry: m.industry,
                    skills: m.skills,
                    bio: m.bio,
                  },
                },
              ],
            });
            console.log(`  Indexed vector for ${m.name}.`);
          } catch (err) {
            console.warn(`  Skipped vector for ${m.name}:`, (err as Error).message);
          }
        }
      } catch (err) {
        console.warn(
          "  Skipping Qdrant sync (vector DB offline or unreachable):",
          (err as Error).message
        );
      }
    } else {
      console.log(
        "Skipping Qdrant sync (set a valid GEMINI_API_KEY and QDRANT_URL in .env.local to enable semantic search)."
      );
    }

    console.log("Seed completed successfully!");
    console.log("Demo accounts:");
    console.log("  Admin  : admin@pes.edu / Admin@1234");
    console.log("  Student: student@pes.edu / Student@1234");
    console.log("  Alumni : ananya.rao@alumni.pes.edu / Alumni@1234");
  } finally {
    await conn.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});


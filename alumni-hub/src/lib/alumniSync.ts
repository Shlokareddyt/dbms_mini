import { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { buildAlumniEmbeddingText, embedText, isEmbeddingConfigured } from "@/lib/embeddings";
import { isQdrantConfigured, upsertAlumniVector } from "@/lib/qdrant";

interface AlumniForEmbedRow extends RowDataPacket {
  alumni_id: number;
  user_id: number;
  name: string;
  current_company: string | null;
  job_title: string | null;
  industry: string | null;
  bio: string | null;
}

interface SkillNameRow extends RowDataPacket {
  name: string;
}

/**
 * Re-embeds one alumni mentor's profile (bio + role + skill tags) and
 * upserts the resulting vector into Qdrant. Safe to call liberally
 * (registration, profile edits) — it is a no-op when GEMINI_API_KEY or
 * QDRANT_URL are not configured, so Phase 1/2 keep working without
 * Phase 3 infrastructure running.
 *
 * Returns true if a vector was written, false if vector search is not
 * configured in this environment.
 */
export async function syncAlumniVector(alumniId: number): Promise<boolean> {
  if (!isEmbeddingConfigured() || !isQdrantConfigured()) {
    return false;
  }

  const rows = await query<AlumniForEmbedRow[]>(
    `SELECT a.alumni_id, a.user_id, u.name, a.current_company, a.job_title, a.industry, a.bio
     FROM alumni a
     INNER JOIN users u ON a.user_id = u.user_id
     WHERE a.alumni_id = ?
     LIMIT 1`,
    [alumniId]
  );
  const alumni = rows[0];
  if (!alumni) return false;

  const skillRows = await query<SkillNameRow[]>(
    `SELECT sk.name
     FROM alumni_expertise ae
     INNER JOIN skills sk ON ae.skill_id = sk.skill_id
     WHERE ae.alumni_id = ?`,
    [alumniId]
  );
  const skills = skillRows.map((r) => r.name);

  const text = buildAlumniEmbeddingText({
    name: alumni.name,
    jobTitle: alumni.job_title,
    currentCompany: alumni.current_company,
    industry: alumni.industry,
    bio: alumni.bio,
    skills,
  });

  const vector = await embedText(text, "RETRIEVAL_DOCUMENT");

  await upsertAlumniVector(alumniId, vector, {
    alumni_id: alumni.alumni_id,
    user_id: alumni.user_id,
    name: alumni.name,
    current_company: alumni.current_company,
    job_title: alumni.job_title,
    industry: alumni.industry,
    skills,
    bio: alumni.bio,
  });

  return true;
}

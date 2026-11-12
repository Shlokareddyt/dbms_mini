import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, withTransaction } from "@/lib/db";
import { updateAlumniProfileSchema } from "@/lib/validators";
import { syncAlumniVector } from "@/lib/alumniSync";
import { isEmbeddingConfigured } from "@/lib/embeddings";
import { isQdrantConfigured } from "@/lib/qdrant";

interface AlumniIdRow extends RowDataPacket {
  alumni_id: number;
}

/**
 * PATCH /api/alumni/me
 * Updates the signed-in alumnus's mentor profile. Any change here
 * re-triggers the Phase 3 bio → embedding → Qdrant upsert pipeline so
 * semantic search results never go stale relative to the relational
 * profile — this is the "Bio & Vector Sync" card the alumni dashboard
 * advertises.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(["alumni"]);
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    const parsed = updateAlumniProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed." },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const alumniId = await withTransaction<number>(async (conn) => {
      const [rows] = await conn.execute<AlumniIdRow[]>(
        `SELECT alumni_id FROM alumni WHERE user_id = ? FOR UPDATE`,
        [user.userId]
      );
      const alumni = rows[0];
      if (!alumni) throw new Error("ALUMNI_NOT_FOUND");

      const sets: string[] = [];
      const values: (string | number | boolean | Date | null)[] = [];
      for (const [col, val] of Object.entries({
        current_company: data.current_company,
        job_title: data.job_title,
        industry: data.industry,
        bio: data.bio,
        mentee_capacity: data.mentee_capacity,
      })) {
        if (val !== undefined) {
          sets.push(`${col} = ?`);
          values.push(val);
        }
      }
      if (sets.length > 0) {
        await conn.execute(`UPDATE alumni SET ${sets.join(", ")} WHERE alumni_id = ?`, [
          ...values,
          alumni.alumni_id,
        ]);
      }

      if (data.skill_ids) {
        await conn.execute(`DELETE FROM alumni_expertise WHERE alumni_id = ?`, [
          alumni.alumni_id,
        ]);
        for (const skillId of data.skill_ids) {
          await conn.execute(
            `INSERT IGNORE INTO alumni_expertise (alumni_id, skill_id) VALUES (?, ?)`,
            [alumni.alumni_id, skillId]
          );
        }
      }

      return alumni.alumni_id;
    });

    const vectorSynced = await syncAlumniVector(alumniId).catch((err) => {
      console.error("[alumniSync] profile update embed failed:", err);
      return false;
    });

    return NextResponse.json({
      message: "Mentor profile updated.",
      vectorSynced,
      vectorSearchConfigured: isEmbeddingConfigured() && isQdrantConfigured(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALUMNI_NOT_FOUND") {
      return NextResponse.json({ error: "Alumni profile not found." }, { status: 404 });
    }
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

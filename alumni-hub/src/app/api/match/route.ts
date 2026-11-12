import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, query } from "@/lib/db";
import { embedText, isEmbeddingConfigured, EmbeddingUnavailableError } from "@/lib/embeddings";
import { isQdrantConfigured, searchAlumniByVector } from "@/lib/qdrant";
import { semanticSearchSchema } from "@/lib/validators";

interface AlumniDetailRow extends RowDataPacket {
  alumni_id: number;
  name: string;
  email: string;
  current_company: string | null;
  job_title: string | null;
  industry: string | null;
  grad_year: number | null;
  bio: string | null;
  mentee_capacity: number;
  skills_list: string | null;
}

/**
 * POST /api/match
 * Student-only semantic mentor search:
 *   1. Embed the student's free-text query with Gemini (RETRIEVAL_QUERY).
 *   2. Cosine-similarity search the top-k closest alumni vectors in Qdrant.
 *   3. Join the hits back against MySQL (source of truth for live data
 *      like current mentee_capacity) and return them ranked by score.
 *
 * Returns 503 with `configured: false` when GEMINI_API_KEY/QDRANT_URL
 * are not set, so the UI can show a clear "Phase 3 not configured yet"
 * state instead of a generic error.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(["student"]);
    if (errorResponse || !user) return errorResponse!;

    if (!isEmbeddingConfigured() || !isQdrantConfigured()) {
      return NextResponse.json(
        {
          error:
            "Semantic mentor search is not configured. Set GEMINI_API_KEY and QDRANT_URL in alumni-hub/.env.local.",
          configured: false,
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    const parsed = semanticSearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed." },
        { status: 400 }
      );
    }
    const { query: searchQuery, top_k } = parsed.data;

    const queryVector = await embedText(searchQuery, "RETRIEVAL_QUERY");
    // Qdrant is the similarity engine; MySQL (via Alumni_Directory_View
    // below) remains the source of truth for who is currently admin-verified,
    // so verification is enforced there rather than via a Qdrant payload filter.
    const hits = await searchAlumniByVector(queryVector, top_k);

    if (hits.length === 0) {
      return NextResponse.json({ matches: [], configured: true });
    }

    const alumniIds = hits.map((h) => h.alumniId);
    const placeholders = alumniIds.map(() => "?").join(", ");
    const rows = await query<AlumniDetailRow[]>(
      `SELECT * FROM Alumni_Directory_View
       WHERE alumni_id IN (${placeholders}) AND is_verified_by_admin = TRUE`,
      alumniIds
    );
    const byId = new Map(rows.map((r) => [r.alumni_id, r]));

    const matches = hits
      .map((hit) => {
        const detail = byId.get(hit.alumniId);
        if (!detail) return null;
        return { ...detail, match_score: Number(hit.score.toFixed(4)) };
      })
      .filter((m): m is AlumniDetailRow & { match_score: number } => m !== null);

    return NextResponse.json({ matches, configured: true });
  } catch (error) {
    if (error instanceof EmbeddingUnavailableError) {
      return NextResponse.json(
        { error: error.message, configured: false },
        { status: 503 }
      );
    }
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

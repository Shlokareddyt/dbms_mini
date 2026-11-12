import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, query } from "@/lib/db";

/**
 * GET /api/alumni?industry=...&skill_id=...
 * Verified-only mentor directory, backed by Alumni_Directory_View
 * (sql/02_advanced_features.sql) which pre-joins skill tags via
 * GROUP_CONCAT so the client gets one row per mentor.
 */
export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const industry = searchParams.get("industry")?.trim();
    const skillId = searchParams.get("skill_id");

    const whereClauses = ["is_verified_by_admin = TRUE"];
    const params: (string | number)[] = [];

    if (industry) {
      whereClauses.push("industry = ?");
      params.push(industry);
    }
    if (skillId) {
      whereClauses.push(
        "alumni_id IN (SELECT alumni_id FROM alumni_expertise WHERE skill_id = ?)"
      );
      params.push(Number(skillId));
    }

    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM Alumni_Directory_View
       WHERE ${whereClauses.join(" AND ")}
       ORDER BY mentee_capacity DESC, name ASC
       LIMIT 100`,
      params
    );

    return NextResponse.json({ alumni: rows });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

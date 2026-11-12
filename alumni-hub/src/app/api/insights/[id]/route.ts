import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { execute, mapDatabaseError, query } from "@/lib/db";

interface OwnerRow extends RowDataPacket {
  alumni_user_id: number;
}

/** GET /api/insights/:id — fetch one insight and increment its view_count. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await params;
    const insightId = Number(id);
    if (!Number.isInteger(insightId) || insightId <= 0) {
      return NextResponse.json({ error: "Invalid insight id." }, { status: 400 });
    }

    await execute(`UPDATE career_insights SET view_count = view_count + 1 WHERE insight_id = ?`, [
      insightId,
    ]);

    const rows = await query<RowDataPacket[]>(
      `SELECT ci.*, au.name AS author_name
       FROM career_insights ci
       INNER JOIN alumni al ON ci.alumni_id = al.alumni_id
       INNER JOIN users au ON al.user_id = au.user_id
       WHERE ci.insight_id = ?`,
      [insightId]
    );
    if (!rows[0]) {
      return NextResponse.json({ error: "Insight not found." }, { status: 404 });
    }

    return NextResponse.json({ insight: rows[0] });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

/** DELETE /api/insights/:id — the publishing alumnus can retract their own insight. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(["alumni", "admin"]);
    if (errorResponse || !user) return errorResponse!;

    const { id } = await params;
    const insightId = Number(id);
    if (!Number.isInteger(insightId) || insightId <= 0) {
      return NextResponse.json({ error: "Invalid insight id." }, { status: 400 });
    }

    if (user.role === "alumni") {
      const rows = await query<OwnerRow[]>(
        `SELECT au.user_id AS alumni_user_id
         FROM career_insights ci
         INNER JOIN alumni al ON ci.alumni_id = al.alumni_id
         INNER JOIN users au ON al.user_id = au.user_id
         WHERE ci.insight_id = ?`,
        [insightId]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: "Insight not found." }, { status: 404 });
      }
      if (rows[0].alumni_user_id !== user.userId) {
        return NextResponse.json(
          { error: "You can only delete your own career insights." },
          { status: 403 }
        );
      }
    }

    await execute(`DELETE FROM career_insights WHERE insight_id = ?`, [insightId]);

    return NextResponse.json({ message: "Insight removed." });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

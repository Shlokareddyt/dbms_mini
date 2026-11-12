import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, query } from "@/lib/db";

/**
 * GET /api/admin/users?status=pending|verified|all
 * Backs the Admin "User Verification Queue" panel. Uses the
 * idx_users_role_verified composite index for the pending-queue filter.
 */
export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAuth(["admin"]);
    if (errorResponse) return errorResponse;

    const status = new URL(request.url).searchParams.get("status") || "pending";
    const whereSql =
      status === "pending"
        ? "WHERE u.is_verified = FALSE"
        : status === "verified"
        ? "WHERE u.is_verified = TRUE"
        : "";

    const rows = await query<RowDataPacket[]>(
      `SELECT
        u.user_id, u.name, u.email, u.role, u.is_verified, u.created_at,
        s.student_id, s.major, s.grad_year AS student_grad_year,
        a.alumni_id, a.current_company, a.job_title, a.industry,
        a.is_verified_by_admin
       FROM users u
       LEFT JOIN students s ON u.user_id = s.user_id
       LEFT JOIN alumni a ON u.user_id = a.user_id
       ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT 200`
    );

    return NextResponse.json({ users: rows });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

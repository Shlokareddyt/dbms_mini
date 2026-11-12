import { NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, query } from "@/lib/db";

/** GET /api/admin/logs — live feed of trigger-inserted admin_actions_log rows. */
export async function GET() {
  try {
    const { errorResponse } = await requireAuth(["admin"]);
    if (errorResponse) return errorResponse;

    const rows = await query<RowDataPacket[]>(
      `SELECT
        l.log_id, l.action_type, l.target_table, l.target_id, l.details, l.action_at,
        au.name AS admin_name
       FROM admin_actions_log l
       LEFT JOIN users au ON l.admin_id = au.user_id
       ORDER BY l.action_at DESC
       LIMIT 100`
    );

    return NextResponse.json({ logs: rows });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

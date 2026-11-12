import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, withTransaction } from "@/lib/db";
import { verifyUserSchema } from "@/lib/validators";

interface UserRow extends RowDataPacket {
  user_id: number;
  role: "student" | "alumni" | "admin";
}

interface AlumniIdRow extends RowDataPacket {
  alumni_id: number | null;
}

/**
 * PATCH /api/admin/users/:id/verify
 * Toggles `users.is_verified`. Sets the `@acting_admin_id` session
 * variable on the SAME connection right before the UPDATE, so
 * `trg_log_user_verification` (sql/02_advanced_features.sql) can read
 * it and write a correctly-attributed row into admin_actions_log —
 * session variables don't survive across pooled connections, which is
 * why this all has to happen inside one withTransaction().
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(["admin"]);
    if (errorResponse || !user) return errorResponse!;

    const { id } = await params;
    const targetUserId = Number(id);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    const parsed = verifyUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed." },
        { status: 400 }
      );
    }
    const { is_verified } = parsed.data;

    let alumniId: number | null = null;

    await withTransaction(async (conn) => {
      const [userRows] = await conn.execute<UserRow[]>(
        `SELECT user_id, role FROM users WHERE user_id = ? FOR UPDATE`,
        [targetUserId]
      );
      if (!userRows[0]) throw new Error("USER_NOT_FOUND");

      await conn.execute(`SET @acting_admin_id = ?`, [user.userId]);
      await conn.execute(`UPDATE users SET is_verified = ? WHERE user_id = ?`, [
        is_verified,
        targetUserId,
      ]);

      if (userRows[0].role === "alumni") {
        await conn.execute(
          `UPDATE alumni SET is_verified_by_admin = ? WHERE user_id = ?`,
          [is_verified, targetUserId]
        );
        const [alRows] = await conn.execute<AlumniIdRow[]>(
          `SELECT alumni_id FROM alumni WHERE user_id = ?`,
          [targetUserId]
        );
        alumniId = alRows[0]?.alumni_id ?? null;
      }
    });

    return NextResponse.json({
      message: is_verified ? "User verified." : "User verification revoked.",
      alumniId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

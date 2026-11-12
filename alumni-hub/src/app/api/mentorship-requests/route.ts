import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, query, withTransaction } from "@/lib/db";
import { createMentorshipRequestSchema } from "@/lib/validators";

interface StudentAlumniIdRow extends RowDataPacket {
  student_id: number | null;
  alumni_id: number | null;
}

interface AlumniCapacityRow extends RowDataPacket {
  alumni_id: number;
  mentee_capacity: number;
  is_verified_by_admin: number | boolean;
}

interface ExistingRequestRow extends RowDataPacket {
  request_id: number;
  status: string;
}

/**
 * GET /api/mentorship-requests
 * Role-scoped list, backed by Active_Mentorships_View — the single
 * multi-table JOIN view that powers both the student and alumni
 * "requests" panels without duplicating the join logic per role.
 */
export async function GET() {
  try {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse || !user) return errorResponse!;

    let rows: RowDataPacket[];
    if (user.role === "student") {
      rows = await query<RowDataPacket[]>(
        `SELECT * FROM Active_Mentorships_View WHERE student_user_id = ? ORDER BY requested_at DESC`,
        [user.userId]
      );
    } else if (user.role === "alumni") {
      rows = await query<RowDataPacket[]>(
        `SELECT * FROM Active_Mentorships_View WHERE alumni_user_id = ? ORDER BY requested_at DESC`,
        [user.userId]
      );
    } else {
      rows = await query<RowDataPacket[]>(
        `SELECT * FROM Active_Mentorships_View ORDER BY requested_at DESC LIMIT 200`
      );
    }

    return NextResponse.json({ requests: rows });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

/**
 * POST /api/mentorship-requests
 * Student-only. Wrapped in a transaction with SELECT ... FOR UPDATE on
 * the alumni row so two concurrent requests can't both pass a
 * capacity check that only one of them should pass (classic
 * read-then-write race the CHECK constraint alone can't prevent at the
 * "accept" step, since capacity isn't touched until acceptance — the
 * lock here instead protects the duplicate-request guard below).
 */
export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(["student"]);
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const parsed = createMentorshipRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed." },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const studentRows = await query<StudentAlumniIdRow[]>(
      `SELECT student_id, NULL AS alumni_id FROM students WHERE user_id = ? LIMIT 1`,
      [user.userId]
    );
    const studentId = studentRows[0]?.student_id;
    if (!studentId) {
      return NextResponse.json(
        { error: "Student profile not found for this account." },
        { status: 404 }
      );
    }

    const requestId = await withTransaction<number>(async (conn) => {
      const [alumniRows] = await conn.execute<AlumniCapacityRow[]>(
        `SELECT alumni_id, mentee_capacity, is_verified_by_admin
         FROM alumni WHERE alumni_id = ? FOR UPDATE`,
        [data.alumni_id]
      );
      const alumni = alumniRows[0];
      if (!alumni) {
        throw new Error("ALUMNI_NOT_FOUND");
      }
      if (!alumni.is_verified_by_admin) {
        throw new Error("ALUMNI_NOT_VERIFIED");
      }

      const [existingRows] = await conn.execute<ExistingRequestRow[]>(
        `SELECT request_id, status FROM mentorship_requests
         WHERE student_id = ? AND alumni_id = ? AND status IN ('pending', 'accepted')
         LIMIT 1`,
        [studentId, data.alumni_id]
      );
      if (existingRows[0]) {
        throw new Error("DUPLICATE_REQUEST");
      }

      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO mentorship_requests (student_id, alumni_id, status, match_score, message)
         VALUES (?, ?, 'pending', ?, ?)`,
        [studentId, data.alumni_id, data.match_score ?? null, data.message || null]
      );

      return result.insertId;
    });

    return NextResponse.json(
      { message: "Mentorship request sent.", request_id: requestId },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ALUMNI_NOT_FOUND") {
        return NextResponse.json({ error: "Selected mentor was not found." }, { status: 404 });
      }
      if (error.message === "ALUMNI_NOT_VERIFIED") {
        return NextResponse.json(
          { error: "This mentor has not yet been verified by an admin." },
          { status: 409 }
        );
      }
      if (error.message === "DUPLICATE_REQUEST") {
        return NextResponse.json(
          { error: "You already have a pending or accepted request with this mentor." },
          { status: 409 }
        );
      }
    }
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

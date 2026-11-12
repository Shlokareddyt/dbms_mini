import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, query, withTransaction } from "@/lib/db";
import { createSessionSchema } from "@/lib/validators";

interface RequestOwnerRow extends RowDataPacket {
  request_id: number;
  status: string;
  alumni_user_id: number;
}

/**
 * POST /api/sessions
 * Alumni-only: schedules a 1:1 session for a request they already
 * accepted. `sessions.request_id` is UNIQUE, so re-scheduling is a
 * conflict (409) rather than a silent duplicate — the UI should PATCH
 * the existing session instead.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(["alumni"]);
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed." },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const sessionId = await withTransaction<number>(async (conn) => {
      const [rows] = await conn.execute<RequestOwnerRow[]>(
        `SELECT mr.request_id, mr.status, au.user_id AS alumni_user_id
         FROM mentorship_requests mr
         INNER JOIN alumni al ON mr.alumni_id = al.alumni_id
         INNER JOIN users au ON al.user_id = au.user_id
         WHERE mr.request_id = ? FOR UPDATE`,
        [data.request_id]
      );
      const reqRow = rows[0];
      if (!reqRow) throw new Error("REQUEST_NOT_FOUND");
      if (reqRow.alumni_user_id !== user.userId) throw new Error("FORBIDDEN");
      if (reqRow.status !== "accepted") throw new Error("INVALID_STATE");

      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO sessions (request_id, scheduled_at, duration_minutes, meeting_link, status)
         VALUES (?, ?, ?, ?, 'scheduled')`,
        [
          data.request_id,
          new Date(data.scheduled_at),
          data.duration_minutes,
          data.meeting_link || null,
        ]
      );
      return result.insertId;
    });

    return NextResponse.json(
      { message: "Session scheduled.", session_id: sessionId },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "REQUEST_NOT_FOUND") {
        return NextResponse.json({ error: "Mentorship request not found." }, { status: 404 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "Only the assigned mentor can schedule this session." },
          { status: 403 }
        );
      }
      if (error.message === "INVALID_STATE") {
        return NextResponse.json(
          { error: "A session can only be scheduled for an accepted request." },
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

/** GET /api/sessions — role-scoped list via Active_Mentorships_View. */
export async function GET() {
  try {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse || !user) return errorResponse!;

    let rows: RowDataPacket[];
    if (user.role === "student") {
      rows = await query<RowDataPacket[]>(
        `SELECT * FROM Active_Mentorships_View WHERE student_user_id = ? AND session_id IS NOT NULL ORDER BY scheduled_at DESC`,
        [user.userId]
      );
    } else if (user.role === "alumni") {
      rows = await query<RowDataPacket[]>(
        `SELECT * FROM Active_Mentorships_View WHERE alumni_user_id = ? AND session_id IS NOT NULL ORDER BY scheduled_at DESC`,
        [user.userId]
      );
    } else {
      rows = await query<RowDataPacket[]>(
        `SELECT * FROM Active_Mentorships_View WHERE session_id IS NOT NULL ORDER BY scheduled_at DESC LIMIT 200`
      );
    }

    return NextResponse.json({ sessions: rows });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

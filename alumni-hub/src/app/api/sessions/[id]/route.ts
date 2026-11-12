import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, withTransaction } from "@/lib/db";
import { updateSessionSchema } from "@/lib/validators";

interface SessionOwnerRow extends RowDataPacket {
  session_id: number;
  request_id: number;
  status: string;
  alumni_user_id: number;
  student_user_id: number;
}

/**
 * PATCH /api/sessions/:id — mentor updates status/notes/schedule.
 * Marking a session "completed" frees the mentor's slot back up
 * (mirrors the request-level "complete" action) so the capacity count
 * always reflects currently-active mentorships, not historical ones.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(["alumni"]);
    if (errorResponse || !user) return errorResponse!;

    const { id } = await params;
    const sessionId = Number(id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    const parsed = updateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed." },
        { status: 400 }
      );
    }
    const data = parsed.data;

    await withTransaction(async (conn) => {
      const [rows] = await conn.execute<SessionOwnerRow[]>(
        `SELECT se.session_id, se.request_id, se.status, au.user_id AS alumni_user_id, su.user_id AS student_user_id
         FROM sessions se
         INNER JOIN mentorship_requests mr ON se.request_id = mr.request_id
         INNER JOIN alumni al ON mr.alumni_id = al.alumni_id
         INNER JOIN users au ON al.user_id = au.user_id
         INNER JOIN students st ON mr.student_id = st.student_id
         INNER JOIN users su ON st.user_id = su.user_id
         WHERE se.session_id = ? FOR UPDATE`,
        [sessionId]
      );
      const sessionRow = rows[0];
      if (!sessionRow) throw new Error("SESSION_NOT_FOUND");
      if (sessionRow.alumni_user_id !== user.userId) throw new Error("FORBIDDEN");

      const sets: string[] = [];
      const values: (string | number | boolean | Date | null)[] = [];
      if (data.status) {
        sets.push("status = ?");
        values.push(data.status);
      }
      if (data.notes !== undefined) {
        sets.push("notes = ?");
        values.push(data.notes || null);
      }
      if (data.scheduled_at) {
        sets.push("scheduled_at = ?");
        values.push(new Date(data.scheduled_at));
      }
      if (data.meeting_link !== undefined) {
        sets.push("meeting_link = ?");
        values.push(data.meeting_link || null);
      }

      if (sets.length > 0) {
        await conn.execute(
          `UPDATE sessions SET ${sets.join(", ")} WHERE session_id = ?`,
          [...values, sessionId]
        );
      }

      if (data.status === "completed" && sessionRow.status !== "completed") {
        // Only free the mentee slot if the request was still "accepted"
        // (i.e. this is the transition that actually ends an active
        // mentorship) — guards against double-incrementing capacity if
        // the request was already completed/cancelled through another path.
        const [reqUpdate] = await conn.execute<ResultSetHeader>(
          `UPDATE mentorship_requests SET status = 'completed', responded_at = NOW() WHERE request_id = ? AND status = 'accepted'`,
          [sessionRow.request_id]
        );
        if (reqUpdate.affectedRows > 0) {
          await conn.execute(
            `UPDATE alumni al
             INNER JOIN mentorship_requests mr ON mr.alumni_id = al.alumni_id
             SET al.mentee_capacity = al.mentee_capacity + 1
             WHERE mr.request_id = ?`,
            [sessionRow.request_id]
          );
        }
      }
    });

    return NextResponse.json({ message: "Session updated." });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SESSION_NOT_FOUND") {
        return NextResponse.json({ error: "Session not found." }, { status: 404 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "Only the assigned mentor can update this session." },
          { status: 403 }
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

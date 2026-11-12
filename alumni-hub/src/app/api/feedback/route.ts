import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, withTransaction } from "@/lib/db";
import { createFeedbackSchema } from "@/lib/validators";

interface SessionOwnerRow extends RowDataPacket {
  session_id: number;
  status: string;
  student_user_id: number;
}

/**
 * POST /api/feedback — student rates a completed session.
 * `feedback.session_id` is UNIQUE, so a second submission is rejected
 * by the database (ER_DUP_ENTRY → mapped to a friendly 409) rather than
 * silently overwritten.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(["student"]);
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    const parsed = createFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed." },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const feedbackId = await withTransaction<number>(async (conn) => {
      const [rows] = await conn.execute<SessionOwnerRow[]>(
        `SELECT se.session_id, se.status, su.user_id AS student_user_id
         FROM sessions se
         INNER JOIN mentorship_requests mr ON se.request_id = mr.request_id
         INNER JOIN students st ON mr.student_id = st.student_id
         INNER JOIN users su ON st.user_id = su.user_id
         WHERE se.session_id = ? FOR UPDATE`,
        [data.session_id]
      );
      const sessionRow = rows[0];
      if (!sessionRow) throw new Error("SESSION_NOT_FOUND");
      if (sessionRow.student_user_id !== user.userId) throw new Error("FORBIDDEN");
      if (sessionRow.status !== "completed") throw new Error("INVALID_STATE");

      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO feedback (session_id, rating, comments, submitted_by)
         VALUES (?, ?, ?, ?)`,
        [data.session_id, data.rating, data.comments || null, user.userId]
      );
      return result.insertId;
    });

    return NextResponse.json(
      { message: "Feedback submitted. Thank you!", feedback_id: feedbackId },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SESSION_NOT_FOUND") {
        return NextResponse.json({ error: "Session not found." }, { status: 404 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "Only the mentee of this session can leave feedback." },
          { status: 403 }
        );
      }
      if (error.message === "INVALID_STATE") {
        return NextResponse.json(
          { error: "Feedback can only be left for a completed session." },
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

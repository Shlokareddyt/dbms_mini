import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, withTransaction } from "@/lib/db";
import { updateMentorshipRequestSchema } from "@/lib/validators";

interface RequestRow extends RowDataPacket {
  request_id: number;
  status: string;
  student_id: number;
  alumni_id: number;
  student_user_id: number;
  alumni_user_id: number;
}

interface AlumniCapacityRow extends RowDataPacket {
  mentee_capacity: number;
}

/**
 * PATCH /api/mentorship-requests/:id
 * Body: { action: "accept" | "reject" | "cancel" | "complete" }
 *
 * This is the "atomic MySQL transaction" the dashboards promise:
 * accepting a request and decrementing alumni.mentee_capacity happen
 * together, or not at all; the chk_alumni_mentee_capacity CHECK
 * constraint is the last line of defense against the slot count going
 * negative even if application logic has a bug.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(["student", "alumni"]);
    if (errorResponse || !user) return errorResponse!;

    const { id } = await params;
    const requestId = Number(id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    const parsed = updateMentorshipRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed." },
        { status: 400 }
      );
    }
    const { action } = parsed.data;

    await withTransaction(async (conn) => {
      const [rows] = await conn.execute<RequestRow[]>(
        `SELECT mr.request_id, mr.status, mr.student_id, mr.alumni_id,
                su.user_id AS student_user_id, au.user_id AS alumni_user_id
         FROM mentorship_requests mr
         INNER JOIN students st ON mr.student_id = st.student_id
         INNER JOIN users su ON st.user_id = su.user_id
         INNER JOIN alumni al ON mr.alumni_id = al.alumni_id
         INNER JOIN users au ON al.user_id = au.user_id
         WHERE mr.request_id = ? FOR UPDATE`,
        [requestId]
      );
      const reqRow = rows[0];
      if (!reqRow) throw new Error("REQUEST_NOT_FOUND");

      const isOwningStudent = user.role === "student" && user.userId === reqRow.student_user_id;
      const isOwningAlumni = user.role === "alumni" && user.userId === reqRow.alumni_user_id;

      if (action === "accept" || action === "reject") {
        if (!isOwningAlumni) throw new Error("FORBIDDEN");
        if (reqRow.status !== "pending") throw new Error("INVALID_STATE");
      } else if (action === "cancel") {
        if (!isOwningStudent && !isOwningAlumni) throw new Error("FORBIDDEN");
        if (!["pending", "accepted"].includes(reqRow.status)) throw new Error("INVALID_STATE");
      } else if (action === "complete") {
        if (!isOwningAlumni) throw new Error("FORBIDDEN");
        if (reqRow.status !== "accepted") throw new Error("INVALID_STATE");
      }

      if (action === "accept") {
        const [alumniRows] = await conn.execute<AlumniCapacityRow[]>(
          `SELECT mentee_capacity FROM alumni WHERE alumni_id = ? FOR UPDATE`,
          [reqRow.alumni_id]
        );
        if (!alumniRows[0] || alumniRows[0].mentee_capacity < 1) {
          throw new Error("NO_CAPACITY");
        }
        await conn.execute(
          `UPDATE alumni SET mentee_capacity = mentee_capacity - 1 WHERE alumni_id = ?`,
          [reqRow.alumni_id]
        );
        await conn.execute(
          `UPDATE mentorship_requests SET status = 'accepted', responded_at = NOW() WHERE request_id = ?`,
          [requestId]
        );
      } else if (action === "reject") {
        await conn.execute(
          `UPDATE mentorship_requests SET status = 'rejected', responded_at = NOW() WHERE request_id = ?`,
          [requestId]
        );
      } else if (action === "cancel") {
        if (reqRow.status === "accepted") {
          await conn.execute(
            `UPDATE alumni SET mentee_capacity = mentee_capacity + 1 WHERE alumni_id = ?`,
            [reqRow.alumni_id]
          );
        }
        await conn.execute(
          `UPDATE mentorship_requests SET status = 'cancelled', responded_at = NOW() WHERE request_id = ?`,
          [requestId]
        );
      } else if (action === "complete") {
        await conn.execute(
          `UPDATE alumni SET mentee_capacity = mentee_capacity + 1 WHERE alumni_id = ?`,
          [reqRow.alumni_id]
        );
        await conn.execute(
          `UPDATE mentorship_requests SET status = 'completed', responded_at = NOW() WHERE request_id = ?`,
          [requestId]
        );
        await conn.execute(
          `UPDATE sessions SET status = 'completed' WHERE request_id = ? AND status = 'scheduled'`,
          [requestId]
        );
      }
    });

    return NextResponse.json({ message: `Request ${action}ed successfully.` });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "REQUEST_NOT_FOUND") {
        return NextResponse.json({ error: "Mentorship request not found." }, { status: 404 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "You are not authorized to act on this request." },
          { status: 403 }
        );
      }
      if (error.message === "INVALID_STATE") {
        return NextResponse.json(
          { error: "This request is not in a state that allows that action." },
          { status: 409 }
        );
      }
      if (error.message === "NO_CAPACITY") {
        return NextResponse.json(
          { error: "No remaining mentee capacity to accept this request." },
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

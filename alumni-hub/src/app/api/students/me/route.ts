import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, withTransaction } from "@/lib/db";
import { updateStudentProfileSchema } from "@/lib/validators";

interface StudentIdRow extends RowDataPacket {
  student_id: number;
}

/** PATCH /api/students/me — updates the signed-in student's profile & skill tags. */
export async function PATCH(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(["student"]);
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    const parsed = updateStudentProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed." },
        { status: 400 }
      );
    }
    const data = parsed.data;

    await withTransaction(async (conn) => {
      const [rows] = await conn.execute<StudentIdRow[]>(
        `SELECT student_id FROM students WHERE user_id = ? FOR UPDATE`,
        [user.userId]
      );
      const student = rows[0];
      if (!student) throw new Error("STUDENT_NOT_FOUND");

      const sets: string[] = [];
      const values: (string | number | boolean | Date | null)[] = [];
      for (const [col, val] of Object.entries({
        major: data.major,
        grad_year: data.grad_year,
        bio: data.bio,
        career_goals: data.career_goals,
      })) {
        if (val !== undefined) {
          sets.push(`${col} = ?`);
          values.push(val);
        }
      }
      if (sets.length > 0) {
        await conn.execute(`UPDATE students SET ${sets.join(", ")} WHERE student_id = ?`, [
          ...values,
          student.student_id,
        ]);
      }

      if (data.skill_ids) {
        await conn.execute(`DELETE FROM student_skills WHERE student_id = ?`, [
          student.student_id,
        ]);
        for (const skillId of data.skill_ids) {
          await conn.execute(
            `INSERT IGNORE INTO student_skills (student_id, skill_id) VALUES (?, ?)`,
            [student.student_id, skillId]
          );
        }
      }
    });

    return NextResponse.json({ message: "Student profile updated." });
  } catch (error) {
    if (error instanceof Error && error.message === "STUDENT_NOT_FOUND") {
      return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    }
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

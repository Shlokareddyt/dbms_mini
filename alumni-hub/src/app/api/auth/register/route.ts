import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader } from "mysql2/promise";
import {
  attachSessionCookie,
  hashPassword,
  SessionPayload,
  signSessionToken,
} from "@/lib/auth";
import { mapDatabaseError, withTransaction } from "@/lib/db";
import { registerSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstIssue?.message || "Validation failed.",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const normalizedEmail = data.email.toLowerCase();
    const passwordHash = await hashPassword(data.password);

    const sessionPayload = await withTransaction<SessionPayload>(async (conn) => {
      const [userResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO users (name, email, password_hash, role, is_verified)
         VALUES (?, ?, ?, ?, ?)`,
        [data.name, normalizedEmail, passwordHash, data.role, false]
      );

      const userId = userResult.insertId;
      let studentId: number | null = null;
      let alumniId: number | null = null;

      if (data.role === "student") {
        const [studentResult] = await conn.execute<ResultSetHeader>(
          `INSERT INTO students (user_id, major, grad_year, bio, career_goals)
           VALUES (?, ?, ?, ?, ?)`,
          [
            userId,
            data.major,
            data.grad_year,
            data.bio || null,
            data.career_goals || null,
          ]
        );
        studentId = studentResult.insertId;

        if (data.skill_ids.length > 0) {
          for (const skillId of data.skill_ids) {
            await conn.execute(
              `INSERT INTO student_skills (student_id, skill_id) VALUES (?, ?)`,
              [studentId, skillId]
            );
          }
        }
      } else {
        const [alumniResult] = await conn.execute<ResultSetHeader>(
          `INSERT INTO alumni (
            user_id,
            current_company,
            job_title,
            industry,
            grad_year,
            bio,
            mentee_capacity,
            is_verified_by_admin
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            data.current_company,
            data.job_title,
            data.industry,
            data.grad_year,
            data.bio,
            data.mentee_capacity,
            false,
          ]
        );
        alumniId = alumniResult.insertId;

        if (data.skill_ids.length > 0) {
          for (const skillId of data.skill_ids) {
            await conn.execute(
              `INSERT INTO alumni_expertise (alumni_id, skill_id) VALUES (?, ?)`,
              [alumniId, skillId]
            );
          }
        }
      }

      return {
        userId,
        email: normalizedEmail,
        name: data.name,
        role: data.role,
        isVerified: false,
        studentId,
        alumniId,
      };
    });

    const token = await signSessionToken(sessionPayload);
    const response = NextResponse.json(
      {
        message: "Account registered successfully.",
        user: sessionPayload,
      },
      { status: 201 }
    );

    return attachSessionCookie(response, token);
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}


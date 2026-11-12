import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import {
  attachSessionCookie,
  SessionPayload,
  signSessionToken,
  UserRole,
  verifyPassword,
} from "@/lib/auth";
import { mapDatabaseError, query } from "@/lib/db";
import { loginSchema } from "@/lib/validators";

interface UserLoginRow extends RowDataPacket {
  user_id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_verified: number | boolean;
  student_id: number | null;
  alumni_id: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid credentials." },
        { status: 400 }
      );
    }

    const normalizedEmail = parsed.data.email.toLowerCase();

    const rows = await query<UserLoginRow[]>(
      `SELECT
        u.user_id,
        u.name,
        u.email,
        u.password_hash,
        u.role,
        u.is_verified,
        s.student_id,
        a.alumni_id
      FROM users u
      LEFT JOIN students s ON u.user_id = s.user_id
      LEFT JOIN alumni a ON u.user_id = a.user_id
      WHERE u.email = ?
      LIMIT 1`,
      [normalizedEmail]
    );

    const userRecord = rows[0];
    if (!userRecord) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(
      parsed.data.password,
      userRecord.password_hash
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const sessionPayload: SessionPayload = {
      userId: userRecord.user_id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
      isVerified: Boolean(userRecord.is_verified),
      studentId: userRecord.student_id ?? null,
      alumniId: userRecord.alumni_id ?? null,
    };

    const token = await signSessionToken(sessionPayload);
    const response = NextResponse.json({
      message: "Signed in successfully.",
      user: sessionPayload,
    });

    return attachSessionCookie(response, token);
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}


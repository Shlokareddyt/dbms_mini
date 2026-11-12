import { NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, query } from "@/lib/db";

interface ProfileRow extends RowDataPacket {
  user_id: number;
  name: string;
  email: string;
  role: "student" | "alumni" | "admin";
  is_verified: number | boolean;
  created_at: string;
  student_id: number | null;
  major: string | null;
  student_grad_year: number | null;
  student_bio: string | null;
  career_goals: string | null;
  alumni_id: number | null;
  current_company: string | null;
  job_title: string | null;
  industry: string | null;
  alumni_grad_year: number | null;
  alumni_bio: string | null;
  mentee_capacity: number | null;
  is_verified_by_admin: number | boolean | null;
}

interface SkillTagRow extends RowDataPacket {
  skill_id: number;
  name: string;
  category: string | null;
}

export async function GET() {
  try {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse || !user) return errorResponse!;

    const rows = await query<ProfileRow[]>(
      `SELECT
        u.user_id,
        u.name,
        u.email,
        u.role,
        u.is_verified,
        u.created_at,
        s.student_id,
        s.major,
        s.grad_year AS student_grad_year,
        s.bio AS student_bio,
        s.career_goals,
        a.alumni_id,
        a.current_company,
        a.job_title,
        a.industry,
        a.grad_year AS alumni_grad_year,
        a.bio AS alumni_bio,
        a.mentee_capacity,
        a.is_verified_by_admin
      FROM users u
      LEFT JOIN students s ON u.user_id = s.user_id
      LEFT JOIN alumni a ON u.user_id = a.user_id
      WHERE u.user_id = ?
      LIMIT 1`,
      [user.userId]
    );

    const profile = rows[0];
    if (!profile) {
      return NextResponse.json(
        { error: "User record no longer exists." },
        { status: 404 }
      );
    }

    let skills: SkillTagRow[] = [];
    if (profile.student_id) {
      skills = await query<SkillTagRow[]>(
        `SELECT sk.skill_id, sk.name, sk.category
         FROM student_skills ss
         INNER JOIN skills sk ON ss.skill_id = sk.skill_id
         WHERE ss.student_id = ?
         ORDER BY sk.name ASC`,
        [profile.student_id]
      );
    } else if (profile.alumni_id) {
      skills = await query<SkillTagRow[]>(
        `SELECT sk.skill_id, sk.name, sk.category
         FROM alumni_expertise ae
         INNER JOIN skills sk ON ae.skill_id = sk.skill_id
         WHERE ae.alumni_id = ?
         ORDER BY sk.name ASC`,
        [profile.alumni_id]
      );
    }

    return NextResponse.json({
      user: {
        userId: profile.user_id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        isVerified: Boolean(profile.is_verified),
        createdAt: profile.created_at,
        studentProfile: profile.student_id
          ? {
              studentId: profile.student_id,
              major: profile.major,
              gradYear: profile.student_grad_year,
              bio: profile.student_bio,
              careerGoals: profile.career_goals,
            }
          : null,
        alumniProfile: profile.alumni_id
          ? {
              alumniId: profile.alumni_id,
              currentCompany: profile.current_company,
              jobTitle: profile.job_title,
              industry: profile.industry,
              gradYear: profile.alumni_grad_year,
              bio: profile.alumni_bio,
              menteeCapacity: profile.mentee_capacity,
              isVerifiedByAdmin: Boolean(profile.is_verified_by_admin),
            }
          : null,
        skills,
      },
    });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}


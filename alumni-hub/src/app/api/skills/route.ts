import { NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { mapDatabaseError, query } from "@/lib/db";

export interface SkillRow extends RowDataPacket {
  skill_id: number;
  name: string;
  category: string | null;
}

export async function GET() {
  try {
    const skills = await query<SkillRow[]>(
      `SELECT skill_id, name, category
       FROM skills
       ORDER BY category ASC, name ASC`
    );
    return NextResponse.json({ skills });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}


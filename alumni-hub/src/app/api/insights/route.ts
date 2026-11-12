import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { mapDatabaseError, query, withTransaction } from "@/lib/db";
import { createInsightSchema } from "@/lib/validators";

interface InsightRow extends RowDataPacket {
  insight_id: number;
  title: string;
  content: string;
  published_at: string;
  view_count: number;
  alumni_id: number;
  author_name: string;
  current_company: string | null;
  job_title: string | null;
  skills_list: string | null;
  relevance: number | null;
}

interface AlumniIdRow extends RowDataPacket {
  alumni_id: number | null;
}

/**
 * GET /api/insights?search=...&skill_id=...
 * Demonstrates the FULLTEXT index (ft_career_insights_search) via
 * natural-language MATCH ... AGAINST when `search` is present; falls
 * back to a plain reverse-chronological list otherwise.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse || !user) return errorResponse!;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const skillId = searchParams.get("skill_id");

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];
    let relevanceSelect = "NULL AS relevance";

    if (search) {
      relevanceSelect = "MATCH(ci.title, ci.content) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance";
      params.push(search);
      whereClauses.push("MATCH(ci.title, ci.content) AGAINST (? IN NATURAL LANGUAGE MODE)");
      params.push(search);
    }
    if (skillId) {
      whereClauses.push(
        "ci.insight_id IN (SELECT insight_id FROM insight_tags WHERE skill_id = ?)"
      );
      params.push(Number(skillId));
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const orderSql = search ? "ORDER BY relevance DESC" : "ORDER BY ci.published_at DESC";

    const rows = await query<InsightRow[]>(
      `SELECT
        ci.insight_id, ci.title, ci.content, ci.published_at, ci.view_count,
        ci.alumni_id, au.name AS author_name, al.current_company, al.job_title,
        GROUP_CONCAT(DISTINCT sk.name ORDER BY sk.name SEPARATOR ', ') AS skills_list,
        ${relevanceSelect}
      FROM career_insights ci
      INNER JOIN alumni al ON ci.alumni_id = al.alumni_id
      INNER JOIN users au ON al.user_id = au.user_id
      LEFT JOIN insight_tags it ON ci.insight_id = it.insight_id
      LEFT JOIN skills sk ON it.skill_id = sk.skill_id
      ${whereSql}
      GROUP BY ci.insight_id, ci.title, ci.content, ci.published_at, ci.view_count,
               ci.alumni_id, au.name, al.current_company, al.job_title
      ${orderSql}
      LIMIT 100`,
      params
    );

    return NextResponse.json({ insights: rows });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

/** POST /api/insights — alumni-only: publish a career insight tagged with skills. */
export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(["alumni"]);
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    const parsed = createInsightSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed." },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const alumniRows = await query<AlumniIdRow[]>(
      `SELECT alumni_id FROM alumni WHERE user_id = ? LIMIT 1`,
      [user.userId]
    );
    const alumniId = alumniRows[0]?.alumni_id;
    if (!alumniId) {
      return NextResponse.json({ error: "Alumni profile not found." }, { status: 404 });
    }

    const insightId = await withTransaction<number>(async (conn) => {
      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO career_insights (alumni_id, title, content) VALUES (?, ?, ?)`,
        [alumniId, data.title, data.content]
      );
      const insightId = result.insertId;
      for (const skillId of data.skill_ids) {
        await conn.execute(
          `INSERT IGNORE INTO insight_tags (insight_id, skill_id) VALUES (?, ?)`,
          [insightId, skillId]
        );
      }
      return insightId;
    });

    return NextResponse.json(
      { message: "Career insight published.", insight_id: insightId },
      { status: 201 }
    );
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

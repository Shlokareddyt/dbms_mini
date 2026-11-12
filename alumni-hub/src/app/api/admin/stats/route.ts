import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { callProcedure, mapDatabaseError } from "@/lib/db";

/**
 * GET /api/admin/stats
 * Calls `CALL sp_get_hub_stats()`, the stored procedure defined in
 * sql/02_advanced_features.sql, and returns its three result sets
 * (platform KPIs, top skills, industry capacity) as named fields.
 */
export async function GET() {
  try {
    const { errorResponse } = await requireAuth(["admin"]);
    if (errorResponse) return errorResponse;

    const [kpis, topSkills, industryCapacity] = await callProcedure(
      "CALL sp_get_hub_stats()"
    );

    return NextResponse.json({
      kpis: kpis?.[0] || null,
      topSkills: topSkills || [],
      industryCapacity: industryCapacity || [],
    });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status }
    );
  }
}

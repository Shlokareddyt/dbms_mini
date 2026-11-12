import { NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { mapDatabaseError, query } from "@/lib/db";

interface CountRow extends RowDataPacket {
  table_count: number;
}

export async function GET() {
  try {
    await query<RowDataPacket[]>("SELECT 1 AS ok");
    const dbName = process.env.MYSQL_DATABASE || "alumni_hub";
    const rows = await query<CountRow[]>(
      `SELECT COUNT(*) AS table_count
       FROM information_schema.tables
       WHERE table_schema = ?`,
      [dbName]
    );

    return NextResponse.json({
      status: "connected",
      database: dbName,
      tablesDetected: rows[0]?.table_count ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const mapped = mapDatabaseError(error);
    return NextResponse.json(
      {
        status: "error",
        error: mapped.message,
        code: mapped.code,
      },
      { status: mapped.status }
    );
  }
}


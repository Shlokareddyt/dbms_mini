import mysql, {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

type QueryParams = Parameters<Pool["execute"]>[1];

declare global {
  var __mysqlPool: Pool | undefined;
}

export class AppHttpError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.name = "AppHttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getDbConfig() {
  const host = process.env.MYSQL_HOST;
  const port = Number(process.env.MYSQL_PORT || "3306");
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;

  if (!host || !user || !database || password === undefined) {
    throw new AppHttpError(
      "Database environment variables (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE) are not configured in .env.local.",
      500,
      "ENV_MISCONFIGURED"
    );
  }

  return {
    host,
    port: Number.isNaN(port) ? 3306 : port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };
}

export function getPool(): Pool {
  if (!globalThis.__mysqlPool) {
    globalThis.__mysqlPool = mysql.createPool(getDbConfig());
  }
  return globalThis.__mysqlPool;
}

export async function query<T extends RowDataPacket[]>(
  sql: string,
  params: QueryParams = []
): Promise<T> {
  const pool = getPool();
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
}

export async function execute(
  sql: string,
  params: QueryParams = []
): Promise<ResultSetHeader> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

/**
 * Calls a stored procedure that returns multiple result sets
 * (e.g. `sp_get_hub_stats`). mysql2's *prepared-statement* `execute()`
 * API does not support multi-result-set CALL responses, so this uses
 * the plain text-protocol `query()` instead and returns each SELECT's
 * rows as one entry in the returned array (the trailing OkPacket mysql2
 * appends for the CALL itself is filtered out).
 */
export async function callProcedure<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params: Array<string | number | boolean | null> = []
): Promise<T[]> {
  const pool = getPool();
  const [results] = await pool.query<RowDataPacket[][]>(sql, params);
  if (!Array.isArray(results)) return [];
  return results.filter((set) => Array.isArray(set)) as T[];
}

export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // Ignore rollback errors if connection dropped
    }
    throw error;
  } finally {
    conn.release();
  }
}

interface MySqlDriverError {
  code?: string;
  errno?: number;
  sqlMessage?: string;
  message?: string;
}

export function mapDatabaseError(error: unknown): {
  status: number;
  message: string;
  code: string;
} {
  if (error instanceof AppHttpError) {
    return {
      status: error.statusCode,
      message: error.message,
      code: error.code || "APP_ERROR",
    };
  }

  const err = error as MySqlDriverError;
  const code = err?.code || "UNKNOWN_ERROR";
  const sqlMessage = err?.sqlMessage || err?.message || "";

  if (code === "ER_DUP_ENTRY" || err?.errno === 1062) {
    if (sqlMessage.toLowerCase().includes("email")) {
      return {
        status: 409,
        message: "An account with this email address already exists.",
        code: "ER_DUP_ENTRY",
      };
    }
    if (sqlMessage.toLowerCase().includes("request_id")) {
      return {
        status: 409,
        message: "A session already exists for this mentorship request.",
        code: "ER_DUP_ENTRY",
      };
    }
    return {
      status: 409,
      message: "Duplicate record violates a database UNIQUE constraint.",
      code: "ER_DUP_ENTRY",
    };
  }

  if (code === "ER_CHECK_CONSTRAINT_VIOLATED" || err?.errno === 3819) {
    if (sqlMessage.includes("chk_alumni_mentee_capacity")) {
      return {
        status: 409,
        message:
          "This alumnus has no remaining mentee capacity (mentee_capacity cannot drop below 0).",
        code: "ER_CHECK_CONSTRAINT_VIOLATED",
      };
    }
    if (sqlMessage.toLowerCase().includes("rating")) {
      return {
        status: 400,
        message: "Feedback rating must be between 1 and 5.",
        code: "ER_CHECK_CONSTRAINT_VIOLATED",
      };
    }
    return {
      status: 400,
      message: "Input violates a database CHECK constraint.",
      code: "ER_CHECK_CONSTRAINT_VIOLATED",
    };
  }

  if (code === "ER_NO_REFERENCED_ROW_2" || err?.errno === 1452) {
    return {
      status: 400,
      message: "Referenced parent record does not exist (foreign key violation).",
      code: "ER_NO_REFERENCED_ROW_2",
    };
  }

  if (code === "ER_BAD_NULL_ERROR" || err?.errno === 1048) {
    return {
      status: 400,
      message: "Missing required database field (NOT NULL constraint).",
      code: "ER_BAD_NULL_ERROR",
    };
  }

  if (
    code === "ECONNREFUSED" ||
    code === "ER_ACCESS_DENIED_ERROR" ||
    code === "ER_BAD_DB_ERROR"
  ) {
    return {
      status: 503,
      message:
        "Unable to connect to MySQL database. Verify MySQL is running and .env.local credentials match.",
      code,
    };
  }

  console.error("[DB Error]", error);
  return {
    status: 500,
    message: "An unexpected database error occurred.",
    code,
  };
}


import fs from "node:fs";
import path from "node:path";
import mysql, { RowDataPacket } from "mysql2/promise";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

async function initDb() {
  const host = process.env.MYSQL_HOST || "localhost";
  const port = Number(process.env.MYSQL_PORT || "3306");
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE || "alumni_hub";

  if (!user || password === undefined) {
    throw new Error("MYSQL_USER or MYSQL_PASSWORD is missing in .env.local");
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });

  try {
    console.log(`Connected to MySQL at ${host}:${port} as ${user}.`);

    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await conn.query(`USE \`${database}\`;`);

    // 1. Check existing tables
    const [tableRows] = await conn.query<RowDataPacket[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
      [database]
    );
    const existingTables = new Set(tableRows.map((r) => String(r.table_name || r.TABLE_NAME)));
    console.log(`Existing base tables (${existingTables.size}): ${[...existingTables].join(", ") || "none"}`);

    if (existingTables.size < 12) {
      console.log("Applying ../sql/01_schema.sql...");
      const schemaSql = fs.readFileSync(
        path.resolve(process.cwd(), "../sql/01_schema.sql"),
        "utf8"
      );
      await conn.query(schemaSql);
      console.log("Base 12-table schema verified/created.");
    }

    // 2. Idempotent ALTER TABLE checks
    const [constraints] = await conn.query<RowDataPacket[]>(
      `SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = ?`,
      [database]
    );
    const constraintSet = new Set(
      constraints.map((r) => String(r.constraint_name || r.CONSTRAINT_NAME))
    );

    if (!constraintSet.has("chk_alumni_mentee_capacity")) {
      await conn.query(
        `ALTER TABLE alumni ADD CONSTRAINT chk_alumni_mentee_capacity CHECK (mentee_capacity >= 0);`
      );
      console.log("Added CHECK constraint chk_alumni_mentee_capacity.");
    }
    if (!constraintSet.has("chk_session_duration_positive")) {
      await conn.query(
        `ALTER TABLE sessions ADD CONSTRAINT chk_session_duration_positive CHECK (duration_minutes IS NULL OR duration_minutes > 0);`
      );
      console.log("Added CHECK constraint chk_session_duration_positive.");
    }
    if (!constraintSet.has("chk_insight_view_count")) {
      await conn.query(
        `ALTER TABLE career_insights ADD CONSTRAINT chk_insight_view_count CHECK (view_count >= 0);`
      );
      console.log("Added CHECK constraint chk_insight_view_count.");
    }

    const [logCols] = await conn.query<RowDataPacket[]>(
      `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = ? AND table_name = 'admin_actions_log'`,
      [database]
    );
    const colMap = new Map(
      logCols.map((r) => [
        String(r.column_name || r.COLUMN_NAME),
        String(r.is_nullable || r.IS_NULLABLE),
      ])
    );
    if (colMap.get("admin_id") === "NO") {
      await conn.query(
        `ALTER TABLE admin_actions_log MODIFY COLUMN admin_id INT NULL;`
      );
      console.log("Updated admin_actions_log.admin_id to allow NULL.");
    }
    if (!colMap.has("details")) {
      await conn.query(
        `ALTER TABLE admin_actions_log ADD COLUMN details VARCHAR(255) NULL AFTER target_id;`
      );
      console.log("Added admin_actions_log.details column.");
    }

    // 3. Idempotent Indexes
    const [indexRows] = await conn.query<RowDataPacket[]>(
      `SELECT DISTINCT index_name FROM information_schema.statistics WHERE table_schema = ?`,
      [database]
    );
    const indexSet = new Set(
      indexRows.map((r) => String(r.index_name || r.INDEX_NAME))
    );

    const indexesToCreate: Array<[string, string]> = [
      [
        "idx_users_role_verified",
        "CREATE INDEX idx_users_role_verified ON users (role, is_verified);",
      ],
      [
        "idx_alumni_industry_verified",
        "CREATE INDEX idx_alumni_industry_verified ON alumni (industry, is_verified_by_admin);",
      ],
      [
        "idx_requests_student_status",
        "CREATE INDEX idx_requests_student_status ON mentorship_requests (student_id, status);",
      ],
      [
        "idx_requests_alumni_status",
        "CREATE INDEX idx_requests_alumni_status ON mentorship_requests (alumni_id, status);",
      ],
      [
        "idx_sessions_status_scheduled",
        "CREATE INDEX idx_sessions_status_scheduled ON sessions (status, scheduled_at);",
      ],
      [
        "idx_insights_published",
        "CREATE INDEX idx_insights_published ON career_insights (published_at DESC);",
      ],
      [
        "ft_career_insights_search",
        "CREATE FULLTEXT INDEX ft_career_insights_search ON career_insights (title, content);",
      ],
    ];

    for (const [idxName, ddl] of indexesToCreate) {
      if (!indexSet.has(idxName)) {
        await conn.query(ddl);
        console.log(`Created index ${idxName}.`);
      }
    }

    // 4. Views
    await conn.query(`
      CREATE OR REPLACE VIEW Active_Mentorships_View AS
      SELECT
        mr.request_id,
        mr.status AS request_status,
        mr.match_score,
        mr.message AS request_message,
        mr.requested_at,
        mr.responded_at,
        st.student_id,
        su.user_id AS student_user_id,
        su.name AS student_name,
        su.email AS student_email,
        st.major AS student_major,
        st.grad_year AS student_grad_year,
        al.alumni_id,
        au.user_id AS alumni_user_id,
        au.name AS alumni_name,
        au.email AS alumni_email,
        al.current_company,
        al.job_title,
        al.industry,
        al.mentee_capacity AS remaining_capacity,
        se.session_id,
        se.scheduled_at,
        se.duration_minutes,
        se.meeting_link,
        se.status AS session_status,
        se.notes AS session_notes,
        fb.rating AS feedback_rating,
        fb.comments AS feedback_comments
      FROM mentorship_requests mr
      INNER JOIN students st ON mr.student_id = st.student_id
      INNER JOIN users su ON st.user_id = su.user_id
      INNER JOIN alumni al ON mr.alumni_id = al.alumni_id
      INNER JOIN users au ON al.user_id = au.user_id
      LEFT JOIN sessions se ON mr.request_id = se.request_id
      LEFT JOIN feedback fb ON se.session_id = fb.session_id;
    `);

    await conn.query(`
      CREATE OR REPLACE VIEW Alumni_Directory_View AS
      SELECT
        al.alumni_id,
        u.user_id,
        u.name,
        u.email,
        u.is_verified,
        al.current_company,
        al.job_title,
        al.industry,
        al.grad_year,
        al.bio,
        al.mentee_capacity,
        al.is_verified_by_admin,
        GROUP_CONCAT(DISTINCT sk.name ORDER BY sk.name SEPARATOR ', ') AS skills_list
      FROM alumni al
      INNER JOIN users u ON al.user_id = u.user_id
      LEFT JOIN alumni_expertise ae ON al.alumni_id = ae.alumni_id
      LEFT JOIN skills sk ON ae.skill_id = sk.skill_id
      GROUP BY
        al.alumni_id,
        u.user_id,
        u.name,
        u.email,
        u.is_verified,
        al.current_company,
        al.job_title,
        al.industry,
        al.grad_year,
        al.bio,
        al.mentee_capacity,
        al.is_verified_by_admin;
    `);
    console.log("Views Active_Mentorships_View & Alumni_Directory_View ensured.");

    // 5. Trigger
    await conn.query(`DROP TRIGGER IF EXISTS trg_log_user_verification;`);
    await conn.query(`
      CREATE TRIGGER trg_log_user_verification
      AFTER UPDATE ON users
      FOR EACH ROW
      BEGIN
        IF NOT (OLD.is_verified <=> NEW.is_verified) THEN
          INSERT INTO admin_actions_log (
            admin_id,
            action_type,
            target_table,
            target_id,
            details
          )
          VALUES (
            @acting_admin_id,
            IF(NEW.is_verified = TRUE, 'USER_VERIFIED', 'USER_UNVERIFIED'),
            'users',
            NEW.user_id,
            CONCAT(
              'User "', NEW.name, '" is_verified changed from ',
              IFNULL(OLD.is_verified, 0), ' to ', IFNULL(NEW.is_verified, 0)
            )
          );
        END IF;
      END
    `);
    console.log("Trigger trg_log_user_verification ensured.");

    // 6. Stored Procedure
    await conn.query(`DROP PROCEDURE IF EXISTS sp_get_hub_stats;`);
    await conn.query(`
      CREATE PROCEDURE sp_get_hub_stats()
      BEGIN
        SELECT
          (SELECT COUNT(*) FROM students) AS total_students,
          (SELECT COUNT(*) FROM alumni) AS total_alumni,
          (SELECT COUNT(*) FROM users WHERE role = 'alumni' AND is_verified = TRUE) AS verified_alumni,
          (SELECT COUNT(*) FROM users WHERE is_verified = FALSE) AS pending_verifications,
          (SELECT COUNT(*) FROM mentorship_requests) AS total_requests,
          (SELECT COUNT(*) FROM mentorship_requests WHERE status = 'pending') AS pending_requests,
          (SELECT COUNT(*) FROM sessions WHERE status = 'scheduled') AS active_sessions,
          (SELECT COUNT(*) FROM sessions WHERE status = 'completed') AS completed_sessions,
          (SELECT COUNT(*) FROM career_insights) AS total_insights,
          (SELECT ROUND(AVG(rating), 2) FROM feedback) AS avg_session_rating;

        SELECT
          sk.skill_id,
          sk.name AS skill_name,
          sk.category,
          COUNT(DISTINCT ae.alumni_id) AS alumni_count,
          COUNT(DISTINCT ss.student_id) AS student_count,
          (COUNT(DISTINCT ae.alumni_id) + COUNT(DISTINCT ss.student_id)) AS total_mentions
        FROM skills sk
        LEFT JOIN alumni_expertise ae ON sk.skill_id = ae.skill_id
        LEFT JOIN student_skills ss ON sk.skill_id = ss.skill_id
        GROUP BY sk.skill_id, sk.name, sk.category
        HAVING total_mentions > 0
        ORDER BY total_mentions DESC, sk.name ASC
        LIMIT 8;

        SELECT
          COALESCE(al.industry, 'Unspecified') AS industry,
          COUNT(al.alumni_id) AS mentor_count,
          SUM(al.mentee_capacity) AS total_open_slots
        FROM alumni al
        GROUP BY COALESCE(al.industry, 'Unspecified')
        ORDER BY mentor_count DESC, total_open_slots DESC;
      END
    `);
    console.log("Stored procedure sp_get_hub_stats ensured.");

    const [finalTables] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
      [database]
    );
    console.log(`All set! Base tables in '${database}': ${finalTables[0].cnt}`);
  } finally {
    await conn.end();
  }
}

initDb().catch((err) => {
  console.error("Database initialization failed:", err.message || err);
  process.exit(1);
});


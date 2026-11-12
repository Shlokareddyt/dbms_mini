-- ============================================================================
-- Campus Alumni Mentorship & Career Insights Hub
-- Advanced SQL Features: ALTER Constraints, Indexes, Views, Triggers, Stored Procedures
-- Run AFTER 01_schema.sql on a fresh database (or run sections individually)
-- ============================================================================

USE alumni_hub;

-- ----------------------------------------------------------------------------
-- 1. ALTER TABLE & Database-Level Integrity Constraints
-- ----------------------------------------------------------------------------
-- Prevent mentee_capacity from ever going negative during transactional bookings
ALTER TABLE alumni
  ADD CONSTRAINT chk_alumni_mentee_capacity CHECK (mentee_capacity >= 0);

-- Ensure scheduled session duration is positive when specified
ALTER TABLE sessions
  ADD CONSTRAINT chk_session_duration_positive CHECK (duration_minutes IS NULL OR duration_minutes > 0);

-- Ensure insight view_count cannot be negative
ALTER TABLE career_insights
  ADD CONSTRAINT chk_insight_view_count CHECK (view_count >= 0);

-- Allow admin_actions_log to capture structured details and tolerate CLI/system updates
-- (API routes still populate @acting_admin_id with the logged-in admin's user_id)
ALTER TABLE admin_actions_log
  MODIFY COLUMN admin_id INT NULL,
  ADD COLUMN details VARCHAR(255) NULL AFTER target_id;

-- ----------------------------------------------------------------------------
-- 2. Performance & Full-Text Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX idx_users_role_verified
  ON users (role, is_verified);

CREATE INDEX idx_alumni_industry_verified
  ON alumni (industry, is_verified_by_admin);

CREATE INDEX idx_requests_student_status
  ON mentorship_requests (student_id, status);

CREATE INDEX idx_requests_alumni_status
  ON mentorship_requests (alumni_id, status);

CREATE INDEX idx_sessions_status_scheduled
  ON sessions (status, scheduled_at);

CREATE INDEX idx_insights_published
  ON career_insights (published_at DESC);

CREATE FULLTEXT INDEX ft_career_insights_search
  ON career_insights (title, content);

-- ----------------------------------------------------------------------------
-- 3. Views (Simplifying Complex Multi-Table Joins for Dashboards)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 4. Triggers (Automatic Audit Logging on Verification Status Changes)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_log_user_verification;

DELIMITER $$

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
END$$

DELIMITER ;

-- ----------------------------------------------------------------------------
-- 5. Stored Procedure (Hub & System Analytics)
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_get_hub_stats;

DELIMITER $$

CREATE PROCEDURE sp_get_hub_stats()
BEGIN
  -- Result Set 1: Overall Platform KPIs
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

  -- Result Set 2: Top Skills by Alumni Expertise + Student Demand
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

  -- Result Set 3: Industry Mentorship Capacity Overview
  SELECT
    COALESCE(al.industry, 'Unspecified') AS industry,
    COUNT(al.alumni_id) AS mentor_count,
    SUM(al.mentee_capacity) AS total_open_slots
  FROM alumni al
  GROUP BY COALESCE(al.industry, 'Unspecified')
  ORDER BY mentor_count DESC, total_open_slots DESC;
END$$

DELIMITER ;


-- ============================================================================
-- Campus Alumni Mentorship & Career Insights Hub
-- Base Relational Schema (MySQL 8.0)
-- Matches the verified ER Diagram & Relational Schema for `alumni_hub`
-- ============================================================================

CREATE DATABASE IF NOT EXISTS alumni_hub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE alumni_hub;

-- 1. Core Users Table (Authentication & Roles)
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('student', 'alumni', 'admin')),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Skills Catalog
CREATE TABLE IF NOT EXISTS skills (
  skill_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL,
  category VARCHAR(50)
);

-- 3. Students Profile Table (1:1 with users)
CREATE TABLE IF NOT EXISTS students (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE NOT NULL,
  major VARCHAR(100),
  grad_year INT,
  bio TEXT,
  career_goals TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. Alumni Profile Table (1:1 with users)
CREATE TABLE IF NOT EXISTS alumni (
  alumni_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE NOT NULL,
  current_company VARCHAR(150),
  job_title VARCHAR(150),
  industry VARCHAR(100),
  grad_year INT,
  bio TEXT,
  mentee_capacity INT DEFAULT 3,
  is_verified_by_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 5. Student Skills (M:N Junction)
CREATE TABLE IF NOT EXISTS student_skills (
  student_id INT NOT NULL,
  skill_id INT NOT NULL,
  PRIMARY KEY (student_id, skill_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
);

-- 6. Alumni Expertise (M:N Junction)
CREATE TABLE IF NOT EXISTS alumni_expertise (
  alumni_id INT NOT NULL,
  skill_id INT NOT NULL,
  PRIMARY KEY (alumni_id, skill_id),
  FOREIGN KEY (alumni_id) REFERENCES alumni(alumni_id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
);

-- 7. Mentorship Requests
CREATE TABLE IF NOT EXISTS mentorship_requests (
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  alumni_id INT NOT NULL,
  status VARCHAR(12) DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  match_score DECIMAL(4,3),
  message TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL,
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (alumni_id) REFERENCES alumni(alumni_id) ON DELETE CASCADE
);

-- 8. Scheduled Mentorship Sessions (1:1 with mentorship_requests)
CREATE TABLE IF NOT EXISTS sessions (
  session_id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT UNIQUE NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INT,
  meeting_link TEXT,
  status VARCHAR(10) DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  FOREIGN KEY (request_id) REFERENCES mentorship_requests(request_id) ON DELETE CASCADE
);

-- 9. Session Feedback (1:1 with sessions)
CREATE TABLE IF NOT EXISTS feedback (
  feedback_id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNIQUE NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  submitted_by INT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 10. Career Insights Published by Alumni
CREATE TABLE IF NOT EXISTS career_insights (
  insight_id INT AUTO_INCREMENT PRIMARY KEY,
  alumni_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  view_count INT DEFAULT 0,
  FOREIGN KEY (alumni_id) REFERENCES alumni(alumni_id) ON DELETE CASCADE
);

-- 11. Career Insight Skill Tags (M:N Junction)
CREATE TABLE IF NOT EXISTS insight_tags (
  insight_id INT NOT NULL,
  skill_id INT NOT NULL,
  PRIMARY KEY (insight_id, skill_id),
  FOREIGN KEY (insight_id) REFERENCES career_insights(insight_id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
);

-- 12. Admin Actions Audit Log
CREATE TABLE IF NOT EXISTS admin_actions_log (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action_type VARCHAR(50),
  target_table VARCHAR(50),
  target_id INT,
  action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE
);


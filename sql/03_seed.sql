-- ============================================================================
-- Campus Alumni Mentorship & Career Insights Hub
-- Seed Catalog Data (Skills)
-- Note: User accounts with bcrypt-hashed passwords & Qdrant embeddings are
-- seeded via `npm run seed` inside alumni-hub/.
-- ============================================================================

USE alumni_hub;

INSERT IGNORE INTO skills (name, category) VALUES
  ('Machine Learning', 'AI & Data'),
  ('Generative AI & LLMs', 'AI & Data'),
  ('Data Engineering', 'AI & Data'),
  ('System Design', 'Software Engineering'),
  ('Full-Stack Web Development', 'Software Engineering'),
  ('Distributed Systems', 'Software Engineering'),
  ('Cloud Architecture (AWS/GCP)', 'Cloud & DevOps'),
  ('Kubernetes & Docker', 'Cloud & DevOps'),
  ('Cybersecurity', 'Security'),
  ('Product Management', 'Product & Strategy'),
  ('Venture Capital & Startups', 'Entrepreneurship'),
  ('Technical Interview Prep', 'Career Growth'),
  ('Resume & Portfolio Review', 'Career Growth'),
  ('Embedded Systems & IoT', 'Hardware & Systems'),
  ('Database Internals', 'AI & Data');


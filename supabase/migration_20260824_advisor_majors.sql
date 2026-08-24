-- ============================================================
-- Migration: advisor_majors junction table
-- Run against dev first, then prod after confirmation
-- ============================================================

-- 1. Junction table
CREATE TABLE IF NOT EXISTS advisor_majors (
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  major_id   uuid NOT NULL REFERENCES majors(id)   ON DELETE CASCADE,
  PRIMARY KEY (advisor_id, major_id)
);

-- 2. RLS
ALTER TABLE advisor_majors ENABLE ROW LEVEL SECURITY;

-- Kiosk (anon) can read — needed to filter advisors by major
DROP POLICY IF EXISTS "Public read advisor_majors" ON advisor_majors;
CREATE POLICY "Public read advisor_majors"
  ON advisor_majors FOR SELECT
  USING (true);

-- Authenticated users (advisors/admins) can manage assignments
DROP POLICY IF EXISTS "Auth users manage advisor_majors" ON advisor_majors;
CREATE POLICY "Auth users manage advisor_majors"
  ON advisor_majors FOR ALL
  USING (auth.role() = 'authenticated');

-- 3. Grant explicit SELECT to anon and authenticated roles
GRANT SELECT ON advisor_majors TO anon, authenticated;

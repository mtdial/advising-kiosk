-- Migration: add office_hours_available to advisors, notes to queue
-- Run in Supabase SQL Editor (dev project)

-- 1. Add office_hours_available flag to advisors
ALTER TABLE advisors
  ADD COLUMN IF NOT EXISTS office_hours_available boolean NOT NULL DEFAULT false;

-- 2. Add optional student notes to queue
ALTER TABLE queue
  ADD COLUMN IF NOT EXISTS notes text;

-- Done. No data loss — both columns are additive.

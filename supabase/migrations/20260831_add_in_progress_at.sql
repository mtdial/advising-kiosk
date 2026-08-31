ALTER TABLE queue ADD COLUMN IF NOT EXISTS in_progress_at timestamptz;

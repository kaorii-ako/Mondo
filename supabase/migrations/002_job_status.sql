ALTER TABLE question_sets
  ADD COLUMN IF NOT EXISTS job_status text DEFAULT 'pending'
    CHECK (job_status IN ('pending', 'processing', 'done', 'error')),
  ADD COLUMN IF NOT EXISTS job_error  text;

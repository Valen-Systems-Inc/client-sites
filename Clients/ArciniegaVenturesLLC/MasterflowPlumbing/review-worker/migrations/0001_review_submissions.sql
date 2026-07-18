CREATE TABLE IF NOT EXISTS review_submissions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL,
  contact TEXT,
  consent_ip_collection INTEGER NOT NULL CHECK (consent_ip_collection IN (0, 1)),
  consent_display INTEGER NOT NULL DEFAULT 0 CHECK (consent_display IN (0, 1)),
  source_path TEXT,
  ip_address TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  country TEXT,
  cf_ray TEXT,
  referer TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_submissions_status_created
  ON review_submissions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_submissions_ip_hash
  ON review_submissions (ip_hash);

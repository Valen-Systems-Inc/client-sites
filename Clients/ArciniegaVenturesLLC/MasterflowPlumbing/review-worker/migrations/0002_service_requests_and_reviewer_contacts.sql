ALTER TABLE review_submissions ADD COLUMN reviewer_email TEXT;
ALTER TABLE review_submissions ADD COLUMN reviewer_phone TEXT;
ALTER TABLE review_submissions ADD COLUMN moderated_at TEXT;
ALTER TABLE review_submissions ADD COLUMN moderated_by TEXT;

CREATE INDEX IF NOT EXISTS idx_review_submissions_email
  ON review_submissions (reviewer_email);

CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  service_location TEXT NOT NULL,
  service_needed TEXT NOT NULL,
  urgency TEXT NOT NULL,
  preferred_contact TEXT NOT NULL,
  details TEXT NOT NULL,
  consent_contact INTEGER NOT NULL CHECK (consent_contact IN (0, 1)),
  source_path TEXT,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  country TEXT,
  cf_ray TEXT,
  referer TEXT,
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_message_id TEXT,
  email_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_service_requests_status_created
  ON service_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_requests_email
  ON service_requests (email);

CREATE INDEX IF NOT EXISTS idx_service_requests_ip_hash
  ON service_requests (ip_hash);

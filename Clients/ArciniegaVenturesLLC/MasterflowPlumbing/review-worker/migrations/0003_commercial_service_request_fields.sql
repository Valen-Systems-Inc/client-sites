ALTER TABLE service_requests ADD COLUMN site_variant TEXT NOT NULL DEFAULT 'residential';
ALTER TABLE service_requests ADD COLUMN company_name TEXT NOT NULL DEFAULT '';
ALTER TABLE service_requests ADD COLUMN property_type TEXT NOT NULL DEFAULT '';
ALTER TABLE service_requests ADD COLUMN access_window TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_service_requests_site_variant_created
  ON service_requests (site_variant, created_at DESC);

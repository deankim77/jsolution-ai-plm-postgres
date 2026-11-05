CREATE TABLE office_preview_jobs (
  version_id text PRIMARY KEY REFERENCES deliverable_versions(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','done','failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token text,
  lease_until timestamptz,
  error text
);
--> statement-breakpoint
CREATE INDEX office_preview_jobs_available_idx ON office_preview_jobs(state,available_at);

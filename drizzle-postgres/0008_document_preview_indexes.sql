-- These indexes previously ran while opening/uploading documents. Install them once.
CREATE UNIQUE INDEX IF NOT EXISTS deliverable_versions_deliverable_revision_uq ON deliverable_versions(deliverable_id,revision);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deliverable_versions_project_task_idx ON deliverable_versions(project_id,task_id,created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS deliverables_drawing_company_code_uq ON deliverables(drawing_company_id,drawing_code) WHERE drawing_code IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deliverable_versions_deliverable_revision_idx ON deliverable_versions(deliverable_id,revision DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deliverables_project_status_created_idx ON deliverables(project_id,status,created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deliverables_project_category_idx ON deliverables(project_id,category);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS workflow_instances_main_deliverable_status_idx ON workflow_instances(main_deliverable_id,status,updated_at DESC);

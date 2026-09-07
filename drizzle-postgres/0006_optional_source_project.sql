ALTER TABLE "design_change_requests" ALTER COLUMN "project_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "quality_cases" ALTER COLUMN "project_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "workflow_source_attachments" ALTER COLUMN "project_id" DROP NOT NULL;

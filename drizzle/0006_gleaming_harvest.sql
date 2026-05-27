CREATE TABLE IF NOT EXISTS "deliverables" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"task_id" varchar(64) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"file_name" varchar(320) NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"status" varchar(32) NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliverables_task_id_idx" ON "deliverables" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliverables_task_id_kind_idx" ON "deliverables" USING btree ("task_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliverables_task_id_status_idx" ON "deliverables" USING btree ("task_id","status");

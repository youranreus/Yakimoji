CREATE TABLE IF NOT EXISTS "task_intake_drafts" (
	"token" varchar(64) PRIMARY KEY NOT NULL,
	"creator_user_id" integer NOT NULL,
	"intake_method" varchar(32) NOT NULL,
	"source_url" text,
	"source_identifier" varchar(320),
	"source_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processing_baseline_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"upload_storage_key" text,
	"upload_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_events" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"task_id" varchar(64) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"from_status" varchar(32) NOT NULL,
	"to_status" varchar(32) NOT NULL,
	"reason_code" varchar(128),
	"request_id" varchar(64) NOT NULL,
	"actor_user_id" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_intake_drafts" ADD CONSTRAINT "task_intake_drafts_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_events" ADD CONSTRAINT "task_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_intake_drafts_creator_user_id_idx" ON "task_intake_drafts" USING btree ("creator_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_intake_drafts_expires_at_idx" ON "task_intake_drafts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_events_task_id_idx" ON "task_events" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_events_event_type_idx" ON "task_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_events_request_id_idx" ON "task_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_events_created_at_idx" ON "task_events" USING btree ("created_at");
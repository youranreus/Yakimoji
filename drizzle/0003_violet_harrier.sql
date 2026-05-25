CREATE TABLE IF NOT EXISTS "tasks" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"creator_user_id" integer NOT NULL,
	"intake_method" varchar(32) NOT NULL,
	"source_url" text,
	"source_identifier" varchar(320) NOT NULL,
	"source_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processing_baseline_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"upload_storage_key" text,
	"status" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_creator_user_id_idx" ON "tasks" USING btree ("creator_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_source_identifier_idx" ON "tasks" USING btree ("source_identifier");
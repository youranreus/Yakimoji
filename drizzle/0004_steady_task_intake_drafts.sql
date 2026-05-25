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
DO $$ BEGIN
 ALTER TABLE "task_intake_drafts" ADD CONSTRAINT "task_intake_drafts_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_intake_drafts_creator_user_id_idx" ON "task_intake_drafts" USING btree ("creator_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_intake_drafts_expires_at_idx" ON "task_intake_drafts" USING btree ("expires_at");

CREATE TABLE IF NOT EXISTS "channel_presets" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"owner_user_id" integer NOT NULL,
	"source_identifier" varchar(320) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"translation_mode" varchar(120) NOT NULL,
	"subtitle_template" varchar(160) NOT NULL,
	"output_package" varchar(120) NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "channel_presets" ADD CONSTRAINT "channel_presets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_channel_presets_owner_source" ON "channel_presets" USING btree ("owner_user_id","source_identifier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_channel_presets_owner_user_id" ON "channel_presets" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_channel_presets_source_identifier" ON "channel_presets" USING btree ("source_identifier");--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "preset_id" varchar(64);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "preset_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_preset_id_channel_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."channel_presets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_preset_id_idx" ON "tasks" USING btree ("preset_id");

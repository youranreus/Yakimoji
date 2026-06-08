CREATE TABLE IF NOT EXISTS "api_credentials" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"owner_user_id" integer NOT NULL,
	"label" varchar(160) NOT NULL,
	"secret_hash" text NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "api_credential_id" varchar(64);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_credentials_owner_user_id_idx" ON "api_credentials" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_credentials_status_idx" ON "api_credentials" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_credentials_expires_at_idx" ON "api_credentials" USING btree ("expires_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_api_credential_id_api_credentials_id_fk" FOREIGN KEY ("api_credential_id") REFERENCES "public"."api_credentials"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "tasks_api_credential_id_idx" ON "tasks" USING btree ("api_credential_id");--> statement-breakpoint

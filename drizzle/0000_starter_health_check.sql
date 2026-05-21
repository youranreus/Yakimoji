CREATE TABLE IF NOT EXISTS "starter_health_checks" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "name" varchar(128) NOT NULL UNIQUE,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL
);

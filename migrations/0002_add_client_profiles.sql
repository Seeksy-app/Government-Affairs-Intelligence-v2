CREATE TABLE "client_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"industries" text[] DEFAULT '{}'::text[] NOT NULL,
	"watchlist_topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"relevant_agencies" text[] DEFAULT '{}'::text[] NOT NULL,
	"relevant_committees" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_profiles_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "government_press_releases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar NOT NULL,
	"department_slug" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"content_hash" text NOT NULL,
	"published_at" timestamp,
	"summary" text,
	"full_text" text,
	"raw_metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "government_press_releases_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "government_press_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_slug" text NOT NULL,
	"department_name" text NOT NULL,
	"feed_url" text NOT NULL,
	"fetch_type" text DEFAULT 'rss' NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_synced_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"block_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "government_press_sources_department_slug_unique" UNIQUE("department_slug")
);
--> statement-breakpoint
CREATE TABLE "government_press_sync_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar NOT NULL,
	"department_slug" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"releases_found" integer DEFAULT 0,
	"releases_inserted" integer DEFAULT 0,
	"releases_updated" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
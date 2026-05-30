CREATE TABLE "bill_change_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracked_bill_id" varchar NOT NULL,
	"change_type" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"description" text,
	"detected_at" timestamp DEFAULT now(),
	"is_read" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "bill_tracking_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracked_bill_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"alert_on_status_change" boolean DEFAULT true,
	"alert_on_new_action" boolean DEFAULT true,
	"alert_on_amendment" boolean DEFAULT true,
	"alert_on_cosponsor_change" boolean DEFAULT false,
	"email_notification" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brief_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brief_id" varchar NOT NULL,
	"citation_number" integer NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"publication" text,
	"publish_date" text,
	"tier" integer NOT NULL,
	"excerpts" jsonb,
	"extracted_content" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brief_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brief_id" varchar NOT NULL,
	"email" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"viewed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"public_uuid" varchar NOT NULL,
	"title" text NOT NULL,
	"client_context" text,
	"sensitivity" text DEFAULT 'internal' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"content" jsonb,
	"model_used" text,
	"generation_error" text,
	"generated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "briefs_public_uuid_unique" UNIQUE("public_uuid")
);
--> statement-breakpoint
CREATE TABLE "career_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" varchar NOT NULL,
	"title" text NOT NULL,
	"organization" text NOT NULL,
	"organization_type" text,
	"start_year" integer,
	"end_year" integer,
	"start_month" integer,
	"end_month" integer,
	"policy_areas" text[],
	"supervisor" text,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"industry" text,
	"company_size" text,
	"website" text,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"email_verified" boolean DEFAULT false,
	"email_verification_token" text,
	"email_verification_expires" timestamp,
	"rejection_reason" text,
	"approved_client_id" varchar,
	"primary_goals" text[],
	"firm_size" text,
	"how_heard_about_us" text,
	"referral_source" text,
	"current_tools" text,
	"expected_users" text,
	"urgency" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_applications_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "client_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"module_id" varchar NOT NULL,
	"enabled" boolean DEFAULT true,
	"enabled_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_portals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"industry" text,
	"logo_url" text,
	"address" text,
	"phone" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "clients_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "committee_meeting_portal_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" integer NOT NULL,
	"chamber" text NOT NULL,
	"congress" integer NOT NULL,
	"title" text,
	"meeting_date" text,
	"committees" text,
	"location" text,
	"portal_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"assigned_by" varchar
);
--> statement-breakpoint
CREATE TABLE "congressional_staff_directory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" text,
	"name" text NOT NULL,
	"job_title" text NOT NULL,
	"office_code" text,
	"office_name" text,
	"office_type" text,
	"telephone" text,
	"address" text,
	"parent_office_code" text,
	"parent_office_name" text,
	"member_bioguide_id" text,
	"last_synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" varchar NOT NULL,
	"connected_contact_id" varchar NOT NULL,
	"relationship" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"title" text,
	"organization" text,
	"email" text,
	"phone" text,
	"party" text,
	"state" text,
	"chamber" text,
	"image_url" text,
	"notes" text,
	"priority" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "conversations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_portal_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"portal_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"assigned_by" varchar
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"organization" text,
	"email" text,
	"phone" text,
	"party" text,
	"state" text,
	"source_type" text NOT NULL,
	"source_id" text,
	"image_url" text,
	"notes" text,
	"tags" text[],
	"matter_id" varchar,
	"portal_id" varchar,
	"is_active" boolean DEFAULT true,
	"last_contacted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "demo_access_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"session_start" timestamp DEFAULT now(),
	"time_spent_seconds" integer DEFAULT 0,
	"videos_viewed" integer DEFAULT 0,
	"videos_completed" integer DEFAULT 0,
	"last_activity" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "demo_videos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"video_url" text NOT NULL,
	"thumbnail_url" text,
	"sort_order" integer DEFAULT 0,
	"is_published" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "favorite_congress_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"bioguide_id" varchar NOT NULL,
	"name" text NOT NULL,
	"party" text,
	"state" text,
	"chamber" text,
	"image_url" text,
	"matter_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "high_intent_keywords" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"keyword" text NOT NULL,
	"category" text,
	"priority" text DEFAULT 'normal',
	"is_active" boolean DEFAULT true,
	"match_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "influencer_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"influencer_id" varchar NOT NULL,
	"platform" text NOT NULL,
	"post_id" text NOT NULL,
	"post_url" text,
	"content" text,
	"post_type" text,
	"media_type" text,
	"likes" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"views" integer,
	"engagement_rate" text,
	"hashtags" text[],
	"posted_at" timestamp,
	"is_read" boolean DEFAULT false,
	"is_flagged" boolean DEFAULT false,
	"raw_data" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kb_articles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"category_id" varchar,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"content" text,
	"is_published" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kb_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kb_tooltips" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"article_id" varchar,
	"label" text NOT NULL,
	"page" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kb_tooltips_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "legistorm_staffers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legistorm_id" integer NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"preferred_first_name" text,
	"preferred_last_name" text,
	"full_name" text NOT NULL,
	"gender" text,
	"party" text,
	"race" text,
	"email" text,
	"phone" text,
	"office_address" text,
	"current_title" text,
	"current_office" text,
	"current_member_name" text,
	"current_member_id" integer,
	"chamber" text,
	"state" varchar(2),
	"district" integer,
	"is_current_staff" boolean DEFAULT true,
	"positions" jsonb,
	"linkedin_url" text,
	"career_research" text,
	"career_researched_at" timestamp,
	"last_updated_from_api" timestamp,
	"synced_at" timestamp DEFAULT now(),
	CONSTRAINT "legistorm_staffers_legistorm_id_unique" UNIQUE("legistorm_id")
);
--> statement-breakpoint
CREATE TABLE "legistorm_sync_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_type" text NOT NULL,
	"status" text NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_created" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"last_page" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "marketing_ai_recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text,
	"priority" text DEFAULT 'medium',
	"status" text DEFAULT 'new',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_intelligence_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"category" text NOT NULL,
	"label" text NOT NULL,
	"data" jsonb NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_alerts_sent" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "news_article_portal_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" varchar NOT NULL,
	"portal_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"assigned_by" varchar
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"external_id" varchar,
	"title" text NOT NULL,
	"summary" text,
	"content" text,
	"source" text,
	"author" text,
	"url" text,
	"category" text,
	"image_url" text,
	"relevance_score" integer DEFAULT 0,
	"matched_topics" jsonb,
	"is_read" boolean DEFAULT false,
	"is_flagged" boolean DEFAULT false,
	"is_bookmarked" boolean DEFAULT false,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "news_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"preferred_sources" jsonb,
	"excluded_sources" jsonb,
	"tracked_topics" jsonb,
	"alert_threshold" integer DEFAULT 70,
	"email_alerts" boolean DEFAULT true,
	"alert_frequency" text DEFAULT 'daily',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general',
	"icon" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "platform_modules_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "political_organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar,
	"name" text NOT NULL,
	"org_type" text,
	"chamber" text,
	"party" text,
	"state" varchar(2),
	"website" text,
	"linkedin_url" text,
	"industry" text,
	"description" text,
	"employee_count" integer,
	"employee_count_range" text,
	"founded" integer,
	"headquarters_city" text,
	"headquarters_state" text,
	"headquarters_country" text,
	"tags" text[],
	"naics_code" text,
	"sic_code" text,
	"is_lobbying_firm" boolean DEFAULT false,
	"is_pac" boolean DEFAULT false,
	"is_think_tank" boolean DEFAULT false,
	"is_government_agency" boolean DEFAULT false,
	"is_political_org" boolean DEFAULT false,
	"is_campaign" boolean DEFAULT false,
	"ai_summary" text,
	"ai_sources" text[],
	"pdl_enriched" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"is_tracked" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_id" varchar NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_matter_access" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_id" varchar NOT NULL,
	"matter_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_tracked_bills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_id" varchar NOT NULL,
	"tracked_bill_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rank_tracked_queries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"query" text NOT NULL,
	"target_domain" text,
	"device" text DEFAULT 'desktop',
	"location" text,
	"is_active" boolean DEFAULT true,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rank_tracking_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"position" integer,
	"title" text,
	"link" text,
	"domain" text,
	"snippet" text,
	"checked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "research_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "research_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"source_url" text,
	"original_filename" text,
	"extracted_content" text,
	"summary" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "research_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rss_feed_client_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"assigned_by" varchar
);
--> statement-breakpoint
CREATE TABLE "rss_feeds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"feed_url" text NOT NULL,
	"website_url" text,
	"category" text DEFAULT 'politics',
	"tier" integer DEFAULT 2,
	"is_active" boolean DEFAULT true,
	"fetch_frequency" integer DEFAULT 60,
	"last_fetched_at" timestamp,
	"last_fetch_status" text,
	"last_fetch_error" text,
	"article_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_controls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"client_id" varchar,
	"name" text NOT NULL,
	"category" text,
	"status" text DEFAULT 'enabled' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_status" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"client_id" varchar,
	"level" text DEFAULT 'standard' NOT NULL,
	"notes" text,
	"last_reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_auto_sync_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"is_enabled" boolean DEFAULT false,
	"sync_interval_minutes" integer DEFAULT 60,
	"last_auto_sync_at" timestamp,
	"next_scheduled_sync" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_engagement_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"post_id" varchar,
	"followers" integer,
	"likes" integer DEFAULT 0,
	"reposts" integer DEFAULT 0,
	"replies" integer DEFAULT 0,
	"impressions" integer,
	"engagement_rate" text,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_keyword_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"keyword_id" varchar NOT NULL,
	"post_id" varchar NOT NULL,
	"matched_keyword" text NOT NULL,
	"post_content" text,
	"author_username" text,
	"post_url" text,
	"is_read" boolean DEFAULT false,
	"is_dismissed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_tracking_keywords" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"account_id" varchar,
	"keyword" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sports_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar,
	"team_id" varchar,
	"name" text NOT NULL,
	"title" text,
	"department" text,
	"email" text,
	"phone" text,
	"linkedin_url" text,
	"image_url" text,
	"role_type" text,
	"source" text DEFAULT 'manual',
	"notes" text,
	"ai_research" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sports_teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar,
	"name" text NOT NULL,
	"league" text,
	"conference" text,
	"division" text,
	"level" text DEFAULT 'professional',
	"sport" text,
	"city" text,
	"state" text,
	"venue" text,
	"website" text,
	"logo_url" text,
	"social_twitter" text,
	"social_instagram" text,
	"social_facebook" text,
	"community_url" text,
	"ticket_partner_url" text,
	"estimated_attendance" integer,
	"notes" text,
	"ai_research" text,
	"ai_researched_at" timestamp,
	"pdl_enriched" boolean DEFAULT false,
	"scraped_data" jsonb,
	"scraped_at" timestamp,
	"outreach_status" text DEFAULT 'not_started',
	"outreach_notes" text,
	"last_contacted_at" timestamp,
	"is_tracked" boolean DEFAULT true,
	"is_favorite" boolean DEFAULT false,
	"abbreviation" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staffer_bill_associations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"staffer_type" text NOT NULL,
	"staffer_id" varchar NOT NULL,
	"staffer_name" text NOT NULL,
	"tracked_bill_id" varchar,
	"bill_title" text,
	"bill_type" text,
	"bill_number" integer,
	"congress" integer,
	"role" text,
	"position_title" text,
	"position_organization" text,
	"position_member_name" text,
	"year_start" integer,
	"year_end" integer,
	"confidence" text DEFAULT 'confirmed',
	"source" text DEFAULT 'manual',
	"source_details" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staffer_career_positions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staffer_id" varchar NOT NULL,
	"position" text NOT NULL,
	"organization" text NOT NULL,
	"boss_name" text,
	"start_year" integer NOT NULL,
	"end_year" integer,
	"is_current" boolean DEFAULT false,
	"org_type" text,
	"chamber" text,
	"state" varchar(2),
	"concurrent" boolean DEFAULT false,
	"description" text,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staffer_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staffer_id" varchar NOT NULL,
	"connected_to_name" text NOT NULL,
	"connected_to_id" varchar,
	"connection_type" text,
	"organization" text,
	"years_together" integer,
	"strength" text DEFAULT 'Medium',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staffers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"current_position" text,
	"current_organization" text,
	"current_member" text,
	"chamber" text,
	"party" text,
	"state" varchar(2),
	"specialty" text,
	"pathway_type" text,
	"years_in_current_role" integer,
	"education" jsonb,
	"contact_email" text,
	"linkedin_url" text,
	"photo_url" text,
	"bio" text,
	"track_updates" boolean DEFAULT true,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strategy_boards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_type" text,
	"target_id" text,
	"target_name" text,
	"columns" jsonb DEFAULT '["Identify","Research","Outreach","In Progress","Connected"]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strategy_cards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_name" text NOT NULL,
	"entity_meta" jsonb,
	"stage" text DEFAULT 'Identify' NOT NULL,
	"position" integer DEFAULT 0,
	"notes" text,
	"priority" text DEFAULT 'medium',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "super_admins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "super_admins_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "tracked_bills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"congress" integer NOT NULL,
	"bill_type" text NOT NULL,
	"bill_number" integer NOT NULL,
	"title" text,
	"sponsor" text,
	"sponsor_party" text,
	"sponsor_state" text,
	"introduced_date" text,
	"latest_action" text,
	"latest_action_date" text,
	"status" text,
	"policy_area" text,
	"notes" text,
	"matter_id" varchar,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tracked_influencers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"platform" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"profile_url" text,
	"profile_picture_url" text,
	"bio" text,
	"follower_count" integer,
	"following_count" integer,
	"post_count" integer,
	"engagement_rate" text,
	"is_verified" boolean DEFAULT false,
	"location" text,
	"email" text,
	"is_active" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"raw_data" text,
	"notes" text,
	"keywords" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tracked_social_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"platform" text DEFAULT 'x' NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"profile_url" text,
	"is_active" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tracked_social_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"platform" text DEFAULT 'x' NOT NULL,
	"post_id" text NOT NULL,
	"post_url" text,
	"content" text,
	"author_username" text,
	"author_display_name" text,
	"post_type" text DEFAULT 'post' NOT NULL,
	"matched_keywords" text[],
	"likes" integer DEFAULT 0,
	"reposts" integer DEFAULT 0,
	"replies" integer DEFAULT 0,
	"posted_at" timestamp,
	"is_read" boolean DEFAULT false,
	"is_flagged" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "veteran_congress_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"bioguide_id" text NOT NULL,
	"member_name" text NOT NULL,
	"chamber" text,
	"state" text,
	"party" text,
	"is_veteran" boolean DEFAULT false,
	"service_branch" text,
	"service_details" text,
	"years_of_service" text,
	"rank" text,
	"source" text DEFAULT 'ai_research',
	"confidence" text DEFAULT 'medium',
	"researched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "youtube_watch_list" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"video_url" text NOT NULL,
	"video_id" text NOT NULL,
	"title" text,
	"channel_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"transcript_available" boolean DEFAULT false,
	"last_checked_at" timestamp,
	"matter_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"password_hash" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "client_modules" ADD CONSTRAINT "client_modules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_modules" ADD CONSTRAINT "client_modules_module_id_platform_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."platform_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_ai_recommendations" ADD CONSTRAINT "marketing_ai_recommendations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_intelligence_data" ADD CONSTRAINT "marketing_intelligence_data_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "political_organizations" ADD CONSTRAINT "political_organizations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports_contacts" ADD CONSTRAINT "sports_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports_contacts" ADD CONSTRAINT "sports_contacts_team_id_sports_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sports_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports_teams" ADD CONSTRAINT "sports_teams_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");
CREATE TYPE "public"."group_mode" AS ENUM('host', 'match', 'gather');--> statement-breakpoint
CREATE TYPE "public"."group_status" AS ENUM('open', 'full', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('waiting', 'matched', 'expired');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('pending', 'accepted', 'attended', 'no_show', 'excused');--> statement-breakpoint
CREATE TABLE "escape_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"studio" text,
	"url" text,
	"location" text,
	"min_players" integer,
	"max_players" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "member_status" DEFAULT 'pending' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"escape_room_id" uuid NOT NULL,
	"proposed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" "group_mode" NOT NULL,
	"escape_room_id" uuid,
	"host_id" uuid NOT NULL,
	"datetime" timestamp with time zone,
	"time_range_start" timestamp with time zone,
	"time_range_end" timestamp with time zone,
	"max_members" integer NOT NULL,
	"min_credit" integer DEFAULT 0 NOT NULL,
	"auto_accept" boolean DEFAULT true NOT NULL,
	"status" "group_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"escape_room_id" uuid NOT NULL,
	"time_range_start" timestamp with time zone NOT NULL,
	"time_range_end" timestamp with time zone NOT NULL,
	"status" "match_status" DEFAULT 'waiting' NOT NULL,
	"matched_group_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fb_id" text NOT NULL,
	"phone" text,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"credit_score" integer DEFAULT 100 NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_fb_id_unique" UNIQUE("fb_id"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "escape_rooms" ADD CONSTRAINT "escape_rooms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_proposals" ADD CONSTRAINT "group_proposals_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_proposals" ADD CONSTRAINT "group_proposals_escape_room_id_escape_rooms_id_fk" FOREIGN KEY ("escape_room_id") REFERENCES "public"."escape_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_proposals" ADD CONSTRAINT "group_proposals_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_escape_room_id_escape_rooms_id_fk" FOREIGN KEY ("escape_room_id") REFERENCES "public"."escape_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_escape_room_id_escape_rooms_id_fk" FOREIGN KEY ("escape_room_id") REFERENCES "public"."escape_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_matched_group_id_groups_id_fk" FOREIGN KEY ("matched_group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_votes" ADD CONSTRAINT "proposal_votes_proposal_id_group_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."group_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_votes" ADD CONSTRAINT "proposal_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "escape_rooms_location_idx" ON "escape_rooms" USING btree ("location");--> statement-breakpoint
CREATE INDEX "group_members_group_id_idx" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_members_user_id_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_members_group_user_idx" ON "group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "group_proposals_group_idx" ON "group_proposals" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "groups_status_idx" ON "groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "groups_host_id_idx" ON "groups" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "groups_created_at_idx" ON "groups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "match_requests_status_idx" ON "match_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "match_requests_room_idx" ON "match_requests" USING btree ("escape_room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_votes_unique_idx" ON "proposal_votes" USING btree ("proposal_id","user_id");--> statement-breakpoint
CREATE INDEX "reports_reported_user_group_idx" ON "reports" USING btree ("reported_user_id","group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_unique_idx" ON "reports" USING btree ("reporter_id","reported_user_id","group_id");
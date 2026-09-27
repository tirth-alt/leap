CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"goal" text NOT NULL,
	"jd_text" text,
	"resume_id" uuid,
	"status" text DEFAULT 'clarifying' NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"questions" jsonb,
	"report" jsonb,
	"usage" jsonb,
	"provider" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"repo" text NOT NULL,
	"path" text NOT NULL,
	"additions" integer DEFAULT 0 NOT NULL,
	"deletions" integer DEFAULT 0 NOT NULL,
	"commits" integer DEFAULT 0 NOT NULL,
	"newest_sha" text NOT NULL,
	"url" text NOT NULL,
	"substantive" real,
	"relevance" integer,
	"summary" text,
	"skills" jsonb DEFAULT '[]' NOT NULL,
	"stale" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"difficulty" text NOT NULL,
	"skills" jsonb DEFAULT '[]' NOT NULL,
	"questions" jsonb,
	"answers" jsonb DEFAULT '[]' NOT NULL,
	"grades" jsonb DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'preparing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_scan" (
	"user_id" uuid,
	"repo" text,
	"pushed_at" timestamp with time zone,
	"last_commit_sha" text,
	"last_scanned_at" timestamp with time zone,
	"author_share" real DEFAULT 0 NOT NULL,
	"languages" jsonb DEFAULT '{}' NOT NULL,
	"frameworks" jsonb DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "repo_scan_pkey" PRIMARY KEY("user_id","repo")
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"skills" jsonb DEFAULT '[]' NOT NULL,
	"kind" text NOT NULL,
	"analysis_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"github_id" bigint NOT NULL UNIQUE,
	"login" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"free_analyses_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_user_repo_path" ON "evidence" ("user_id","repo","path");--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_resume_id_resumes_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_analysis_id_analyses_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repo_scan" ADD CONSTRAINT "repo_scan_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_facts" ADD CONSTRAINT "user_facts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_facts" ADD CONSTRAINT "user_facts_analysis_id_analyses_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE SET NULL;
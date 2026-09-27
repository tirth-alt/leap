import { sql } from "drizzle-orm";
import { bigint, boolean, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const emptyArray = sql`'[]'::jsonb`;

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  freeAnalysesUsed: integer("free_analyses_used").notNull().default(0),
  createdAt: createdAt(),
});

export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  source: text("source", { enum: ["pdf", "paste", "sample"] }).notNull(),
  createdAt: createdAt(),
});

export const analyses = pgTable("analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  goal: text("goal").notNull(),
  jdText: text("jd_text"),
  resumeId: uuid("resume_id").references(() => resumes.id, { onDelete: "set null" }),
  status: text("status", { enum: ["clarifying", "scanning", "building", "ready", "failed"] }).notNull().default("clarifying"),
  tier: text("tier", { enum: ["free", "byok"] }).notNull().default("free"),
  questions: jsonb("questions").$type<unknown>(),
  report: jsonb("report").$type<unknown>(),
  usage: jsonb("usage").$type<unknown>(),
  provider: text("provider"),
  createdAt: createdAt(),
});

export const userFacts = pgTable("user_facts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  skills: jsonb("skills").$type<string[]>().notNull().default(emptyArray),
  kind: text("kind", { enum: ["experience", "preference", "context"] }).notNull(),
  analysisId: uuid("analysis_id").references(() => analyses.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const repoScan = pgTable(
  "repo_scan",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    repo: text("repo").notNull(),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    lastCommitSha: text("last_commit_sha"),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
    authorShare: real("author_share").notNull().default(0),
    languages: jsonb("languages").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    frameworks: jsonb("frameworks").$type<string[]>().notNull().default(emptyArray),
    status: text("status", { enum: ["active", "stale"] }).notNull().default("active"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.repo] })],
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    repo: text("repo").notNull(),
    path: text("path").notNull(),
    additions: integer("additions").notNull().default(0),
    deletions: integer("deletions").notNull().default(0),
    commits: integer("commits").notNull().default(0),
    newestSha: text("newest_sha").notNull(),
    url: text("url").notNull(),
    substantive: real("substantive"),
    relevance: integer("relevance"),
    summary: text("summary"),
    skills: jsonb("skills").$type<string[]>().notNull().default(emptyArray),
    stale: boolean("stale").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("evidence_user_repo_path").on(t.userId, t.repo, t.path)],
);

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  analysisId: uuid("analysis_id").notNull().references(() => analyses.id, { onDelete: "cascade" }),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull(),
  skills: jsonb("skills").$type<string[]>().notNull().default(emptyArray),
  questions: jsonb("questions").$type<unknown>(),
  answers: jsonb("answers").$type<unknown[]>().notNull().default(emptyArray),
  grades: jsonb("grades").$type<unknown[]>().notNull().default(emptyArray),
  status: text("status", { enum: ["preparing", "ready", "started", "finished"] }).notNull().default("preparing"),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;

import { db } from "./db.js";
import { sql } from "drizzle-orm";

// Lightweight bootstrap: creates tables if they don't exist yet. Works the same
// way against the local embedded PGlite database and a real Neon/Postgres
// instance, so there is no separate migration step to run in dev.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
      id varchar(24) PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      connect_code varchar(8) NOT NULL UNIQUE,
      partner_id varchar(24),
      anniversary_date text,
      notifications_enabled boolean NOT NULL DEFAULT true,
      reminder_time text NOT NULL DEFAULT 'random',
      language varchar(2) NOT NULL DEFAULT 'sl',
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS moods (
      id serial PRIMARY KEY,
      user_id varchar(24) NOT NULL,
      level integer NOT NULL,
      note text,
      date text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS questions (
      id serial PRIMARY KEY,
      text text NOT NULL,
      category varchar(32) NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS question_answers (
      id serial PRIMARY KEY,
      user_id varchar(24) NOT NULL,
      question_id integer NOT NULL,
      source varchar(16) NOT NULL DEFAULT 'builtin',
      answer text NOT NULL,
      date text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS challenges (
      id serial PRIMARY KEY,
      text text NOT NULL,
      category varchar(32) NOT NULL,
      difficulty varchar(16) NOT NULL DEFAULT 'easy',
      active boolean NOT NULL DEFAULT true
    )`,
  `CREATE TABLE IF NOT EXISTS challenge_completions (
      id serial PRIMARY KEY,
      user_id varchar(24) NOT NULL,
      challenge_id integer NOT NULL,
      source varchar(16) NOT NULL DEFAULT 'builtin',
      date text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS date_ideas (
      id serial PRIMARY KEY,
      title text NOT NULL,
      description text NOT NULL,
      category varchar(24) NOT NULL,
      cost varchar(16) NOT NULL,
      duration varchar(24) NOT NULL,
      location_type varchar(32),
      city text,
      address text,
      phone text,
      website text,
      tags text[],
      lat double precision,
      lng double precision,
      external_id text UNIQUE
    )`,
  `CREATE TABLE IF NOT EXISTS planned_dates (
      id serial PRIMARY KEY,
      user_id varchar(24) NOT NULL,
      idea_id integer NOT NULL,
      scheduled_at timestamp NOT NULL,
      notes text,
      completed boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id serial PRIMARY KEY,
      user_id varchar(24) NOT NULL,
      endpoint text NOT NULL UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS reactions (
      id serial PRIMARY KEY,
      target_type varchar(16) NOT NULL,
      target_id integer NOT NULL,
      user_id varchar(24) NOT NULL,
      emoji varchar(8) NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS custom_questions (
      id serial PRIMARY KEY,
      couple_key varchar(49) NOT NULL,
      created_by varchar(24) NOT NULL,
      text text NOT NULL,
      used boolean NOT NULL DEFAULT false,
      used_date text,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS custom_challenges (
      id serial PRIMARY KEY,
      couple_key varchar(49) NOT NULL,
      created_by varchar(24) NOT NULL,
      text text NOT NULL,
      used boolean NOT NULL DEFAULT false,
      used_date text,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS daily_assignments (
      id serial PRIMARY KEY,
      couple_key varchar(49) NOT NULL,
      date text NOT NULL,
      type varchar(16) NOT NULL,
      item_id integer NOT NULL,
      source varchar(16) NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS reminder_log (
      id serial PRIMARY KEY,
      user_id varchar(24) NOT NULL,
      date text NOT NULL,
      type varchar(24) NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reactions_target_user_idx ON reactions (target_type, target_id, user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS daily_assignment_idx ON daily_assignments (couple_key, date, type)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reminder_log_idx ON reminder_log (user_id, date, type)`,
  // Backfill for databases created before the `source` column existed.
  `ALTER TABLE question_answers ADD COLUMN IF NOT EXISTS source varchar(16) NOT NULL DEFAULT 'builtin'`,
  `ALTER TABLE challenge_completions ADD COLUMN IF NOT EXISTS source varchar(16) NOT NULL DEFAULT 'builtin'`,
  `ALTER TABLE date_ideas ADD COLUMN IF NOT EXISTS external_id text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS date_ideas_external_id_idx ON date_ideas (external_id)`,
];

export async function runMigrations() {
  for (const statement of STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
  console.log("[migrate] Tables ensured");
}

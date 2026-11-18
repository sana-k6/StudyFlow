import Database from 'better-sqlite3';
import { env } from './env.js';

export function createDatabase(dbPath: string = env.DATABASE_PATH): Database.Database {
  const db = new Database(dbPath);

  // Enable WAL mode and foreign key constraints as required by ARCHITECTURE.md
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL;');
  }
  db.pragma('foreign_keys = ON;');

  runMigrations(db);
  return db;
}

export function runMigrations(db: Database.Database): void {
  // 1. users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      university TEXT,
      subscription_tier TEXT NOT NULL DEFAULT 'FREE' CHECK (subscription_tier IN ('FREE', 'PRO')),
      daily_study_cap_mins INTEGER NOT NULL DEFAULT 240,
      preferred_study_start TEXT NOT NULL DEFAULT '09:00',
      preferred_study_end TEXT NOT NULL DEFAULT '21:00',
      created_at TEXT NOT NULL
    );
  `);

  // 2. modules
  db.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      color_hex TEXT NOT NULL DEFAULT '#3B82F6',
      credits INTEGER,
      semester TEXT
    );
  `);

  // 3. assignments
  db.exec(`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      weight_percentage REAL DEFAULT 0,
      estimated_total_mins INTEGER NOT NULL DEFAULT 120,
      priority_score REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'))
    );
  `);

  // 4. subtasks
  db.exec(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      estimated_mins INTEGER NOT NULL DEFAULT 45,
      completed_mins INTEGER NOT NULL DEFAULT 0,
      is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
      ai_generated INTEGER NOT NULL DEFAULT 0 CHECK (ai_generated IN (0, 1))
    );
  `);

  // 5. calendar_events
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id TEXT REFERENCES modules(id) ON DELETE SET NULL,
      subtask_id TEXT REFERENCES subtasks(id) ON DELETE SET NULL,
      external_uid TEXT,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('LECTURE', 'TUTORIAL', 'EXAM', 'PERSONAL', 'AI_STUDY_BLOCK')),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_fixed INTEGER NOT NULL DEFAULT 1 CHECK (is_fixed IN (0, 1)),
      UNIQUE(user_id, external_uid)
    );
  `);

  // 6. study_logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS study_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subtask_id TEXT REFERENCES subtasks(id) ON DELETE SET NULL,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      duration_mins INTEGER NOT NULL,
      focus_rating INTEGER CHECK (focus_rating BETWEEN 1 AND 5),
      logged_at TEXT NOT NULL
    );
  `);

  // 7. ai_usage_logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      feature_type TEXT NOT NULL CHECK (feature_type IN ('BREAKDOWN', 'SCHEDULE_GEN')),
      tokens_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
}

// Global default database instance (can be overridden in tests)
let defaultDb: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!defaultDb) {
    defaultDb = createDatabase();
  }
  return defaultDb;
}

export function setDb(db: Database.Database): void {
  defaultDb = db;
}

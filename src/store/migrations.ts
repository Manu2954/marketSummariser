import type { Database } from 'better-sqlite3';

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      start INTEGER NOT NULL,
      end INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payloads (
      run_id TEXT NOT NULL,
      request_json TEXT NOT NULL,
      feature_json TEXT NOT NULL,
      llm_json TEXT NOT NULL,
      text TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES runs(id)
    );
  `);
}

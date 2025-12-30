import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runMigrations } from './migrations.js';

export function initDb(dbPath: string = process.env.DB_PATH ?? 'data/market-summary.db') {
  const resolvedPath = dbPath === ':memory:' ? dbPath : resolve(dbPath);

  if (resolvedPath !== ':memory:') {
    mkdirSync(dirname(resolvedPath), { recursive: true });
  }

  const db = new Database(resolvedPath);
  runMigrations(db);
  return db;
}

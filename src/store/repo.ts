import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { FeatureReport, LlmSummary, MarketSummaryRequest } from '../domain/types.js';
import { nowIso } from '../utils/time.js';

export type RunRecord = {
  id: string;
  symbol: string;
  timeframe: string;
  start: number;
  end: number;
  createdAt: string;
};

export type RunPayload = {
  request: MarketSummaryRequest;
  featureReport: FeatureReport;
  llmSummary: LlmSummary;
  text: string;
};

export function insertRun(
  db: Database,
  input: Omit<RunRecord, 'id' | 'createdAt'>,
): RunRecord {
  const id = randomUUID();
  const createdAt = nowIso();
  const stmt = db.prepare(
    'INSERT INTO runs (id, symbol, timeframe, start, end, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  stmt.run(id, input.symbol, input.timeframe, input.start, input.end, createdAt);
  return { id, createdAt, ...input };
}

export function insertPayload(db: Database, runId: string, payload: RunPayload): void {
  const stmt = db.prepare(
    'INSERT INTO payloads (run_id, request_json, feature_json, llm_json, text) VALUES (?, ?, ?, ?, ?)',
  );
  stmt.run(
    runId,
    JSON.stringify(payload.request),
    JSON.stringify(payload.featureReport),
    JSON.stringify(payload.llmSummary),
    payload.text,
  );
}

export function getRun(db: Database, id: string): { run: RunRecord; payload: RunPayload } | null {
  const runRow = db
    .prepare(
      'SELECT id, symbol, timeframe, start, end, created_at as createdAt FROM runs WHERE id = ?',
    )
    .get(id) as RunRecord | undefined;

  if (!runRow) {
    return null;
  }

  const payloadRow = db
    .prepare('SELECT request_json, feature_json, llm_json, text FROM payloads WHERE run_id = ?')
    .get(id) as
    | {
        request_json: string;
        feature_json: string;
        llm_json: string;
        text: string;
      }
    | undefined;

  if (!payloadRow) {
    return null;
  }

  return {
    run: {
      id: runRow.id,
      symbol: runRow.symbol,
      timeframe: runRow.timeframe,
      start: runRow.start,
      end: runRow.end,
      createdAt: runRow.createdAt,
    },
    payload: {
      request: JSON.parse(payloadRow.request_json) as MarketSummaryRequest,
      featureReport: JSON.parse(payloadRow.feature_json) as FeatureReport,
      llmSummary: JSON.parse(payloadRow.llm_json) as LlmSummary,
      text: payloadRow.text,
    },
  };
}

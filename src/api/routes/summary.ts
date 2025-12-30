import type { Database } from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import {
  marketSummaryInputSchema,
  marketSummaryRequestSchema,
} from '../../domain/schemas.js';
import type { Candle, MarketSummaryRequest } from '../../domain/types.js';
import { buildFeatureReport } from '../../features/report.js';
import { summarizeMarket } from '../../llm/summarize.js';
import { sortByNumber } from '../../utils/math.js';
import { insertPayload, insertRun } from '../../store/repo.js';

type SummaryRouteDeps = {
  db: Database;
};

const BINANCE_BASE_URL = 'https://api.binance.com/api/v3/klines';
const MIN_CANDLES = 20;

function toNumber(value: unknown, label: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid numeric value for ${label}.`);
  }
  return num;
}

function toOptionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return toNumber(value, label);
}

function mapBinanceKlines(data: unknown): Candle[] {
  if (!Array.isArray(data)) {
    throw new Error('Unexpected Binance response payload.');
  }

  return data.map((kline, index) => {
    if (!Array.isArray(kline) || kline.length < 11) {
      throw new Error(`Invalid kline shape at index ${index}.`);
    }
    return {
      t: toNumber(kline[0], 't'),
      o: toNumber(kline[1], 'o'),
      h: toNumber(kline[2], 'h'),
      l: toNumber(kline[3], 'l'),
      c: toNumber(kline[4], 'c'),
      v: toNumber(kline[5], 'v'),
      qv: toOptionalNumber(kline[7], 'qv'),
      n: toOptionalNumber(kline[8], 'n'),
      tbv: toOptionalNumber(kline[9], 'tbv'),
      tqv: toOptionalNumber(kline[10], 'tqv'),
    };
  });
}

async function fetchBinanceCandles(params: {
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
}): Promise<Candle[]> {
  const url = new URL(BINANCE_BASE_URL);
  url.searchParams.set('symbol', params.symbol);
  url.searchParams.set('interval', params.interval);
  url.searchParams.set('startTime', String(params.startTime));
  url.searchParams.set('endTime', String(params.endTime));

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Binance API error ${response.status}: ${text}`);
  }
  const payload = (await response.json()) as unknown;
  return mapBinanceKlines(payload);
}

export function summaryRoutes(app: FastifyInstance, deps: SummaryRouteDeps): void {
  app.post('/v1/market/summary', async (request, reply) => {
    const parsed = marketSummaryInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        issues: parsed.error.flatten(),
      });
    }

    let requestForReport: MarketSummaryRequest;

    if (parsed.data.candles) {
      requestForReport = {
        symbol: parsed.data.symbol,
        timeframe: parsed.data.timeframe,
        candles: parsed.data.candles,
        preferences: parsed.data.preferences,
      };
    } else {
      let candles: Candle[];
      try {
        candles = await fetchBinanceCandles({
          symbol: parsed.data.symbol,
          interval: parsed.data.timeframe,
          startTime: parsed.data.startTime ?? 0,
          endTime: parsed.data.endTime ?? 0,
        });
      } catch (error) {
        return reply.code(502).send({
          error: 'Failed to fetch Binance candles',
          detail: error instanceof Error ? error.message : String(error),
        });
      }

      if (candles.length < MIN_CANDLES) {
        return reply.code(400).send({
          error: 'Insufficient data',
          detail: `Expected at least ${MIN_CANDLES} candles, got ${candles.length}.`,
        });
      }

      requestForReport = {
        symbol: parsed.data.symbol,
        timeframe: parsed.data.timeframe,
        candles,
        preferences: parsed.data.preferences,
      };
    }

    const validated = marketSummaryRequestSchema.safeParse(requestForReport);
    if (!validated.success) {
      return reply.code(400).send({
        error: 'Invalid candle data',
        issues: validated.error.flatten(),
      });
    }

    const report = buildFeatureReport(requestForReport);
    const { sorted: sortedCandles } = sortByNumber(requestForReport.candles, (candle) => candle.t);
    const llmResult = await summarizeMarket(
      report,
      sortedCandles.slice(-15),
      requestForReport.preferences,
    );
    const run = insertRun(deps.db, {
      symbol: report.meta.symbol,
      timeframe: report.meta.timeframe,
      start: report.meta.start,
      end: report.meta.end,
    });
    insertPayload(deps.db, run.id, {
      request: requestForReport,
      featureReport: report,
      llmSummary: llmResult.llmSummary,
      text: llmResult.text,
    });

    return reply.code(200).send({
      featureReport: report,
      llmSummary: llmResult.llmSummary,
      text: llmResult.text,
      candles: sortedCandles,
    });
  });
}

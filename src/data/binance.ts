import type { Candle } from '../domain/types.js';

const BINANCE_BASE_URL = 'https://fapi.binance.com/fapi/v1/klines';
const MAX_LIMIT = 1000; // Binance max per request

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

function parseIntervalMs(interval: string): number | null {
  const match = interval.match(/^(\d+)([smhdw])$/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  const mult = multipliers[unit];
  if (!mult) {
    return null;
  }
  return value * mult;
}

export async function fetchBinanceCandles(params: {
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
}): Promise<Candle[]> {
  const intervalMs = parseIntervalMs(params.interval);
  const candles: Candle[] = [];
  let nextStart = params.startTime;
  let safety = 0;

  while (nextStart < params.endTime && safety < 100) {
    const url = new URL(BINANCE_BASE_URL);
    url.searchParams.set('symbol', params.symbol);
    url.searchParams.set('interval', params.interval);
    url.searchParams.set('startTime', String(nextStart));
    url.searchParams.set('endTime', String(params.endTime));
    url.searchParams.set('limit', String(MAX_LIMIT));

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Binance API error ${response.status}: ${text}`);
    }
    const payload = (await response.json()) as unknown;
    const batch = mapBinanceKlines(payload);
    if (batch.length === 0) {
      break;
    }
    candles.push(...batch);
    const last = batch[batch.length - 1];
    if (!intervalMs) {
      nextStart = last.t + 1;
    } else {
      nextStart = last.t + intervalMs;
    }
    safety += 1;
    if (batch.length < MAX_LIMIT) {
      break;
    }
  }

  const filtered = candles.filter((candle) => candle.t <= params.endTime);
  filtered.sort((a, b) => a.t - b.t);
  return filtered;
}

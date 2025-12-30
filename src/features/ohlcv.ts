import type { OhlcvCandle, OhlcvStats } from '../domain/types.js';
import { max, min } from '../utils/math.js';

const EPSILON = 1e-12;

export type CandleDerived = {
  range: number;
  body: number;
  upperWick: number;
  lowerWick: number;
  clv: number;
  tr: number;
};

export type SeriesDerived = {
  range: number[];
  body: number[];
  upperWick: number[];
  lowerWick: number[];
  clv: number[];
  tr: number[];
};

export function computeCandleDerived(candle: OhlcvCandle, prevClose?: number): CandleDerived {
  const range = candle.h - candle.l;
  const body = Math.abs(candle.c - candle.o);
  const upperWick = candle.h - Math.max(candle.o, candle.c);
  const lowerWick = Math.min(candle.o, candle.c) - candle.l;
  const clvNumerator = (candle.c - candle.l) - (candle.h - candle.c);
  const clv = clvNumerator / Math.max(range, EPSILON);
  const trBase =
    prevClose === undefined
      ? range
      : Math.max(range, Math.abs(candle.h - prevClose), Math.abs(candle.l - prevClose));

  return {
    range,
    body,
    upperWick,
    lowerWick,
    clv,
    tr: trBase,
  };
}

export function computeSeriesDerived(candles: OhlcvCandle[]): SeriesDerived {
  const series: SeriesDerived = {
    range: [],
    body: [],
    upperWick: [],
    lowerWick: [],
    clv: [],
    tr: [],
  };

  candles.forEach((candle, index) => {
    const prevClose = index > 0 ? candles[index - 1].c : undefined;
    const derived = computeCandleDerived(candle, prevClose);
    series.range.push(derived.range);
    series.body.push(derived.body);
    series.upperWick.push(derived.upperWick);
    series.lowerWick.push(derived.lowerWick);
    series.clv.push(derived.clv);
    series.tr.push(derived.tr);
  });

  return series;
}

export function computeOhlcvStats(candles: OhlcvCandle[]): OhlcvStats {
  const first = candles[0];
  const last = candles[candles.length - 1];
  const highs = candles.map((candle) => candle.h);
  const lows = candles.map((candle) => candle.l);
  const change = last.c - first.o;
  const changePct = first.o === 0 ? 0 : change / first.o;

  return {
    firstOpen: first.o,
    lastClose: last.c,
    high: max(highs),
    low: min(lows),
    change,
    changePct,
  };
}

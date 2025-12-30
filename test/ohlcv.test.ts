import { describe, expect, it } from 'vitest';
import type { Candle } from '../src/domain/types.js';
import { computeCandleDerived, computeSeriesDerived } from '../src/features/ohlcv.js';

describe('ohlcv derived', () => {
  it('computes candle derived metrics', () => {
    const candle: Candle = {
      t: 1,
      o: 100,
      h: 110,
      l: 90,
      c: 105,
      v: 10,
    };

    const derived = computeCandleDerived(candle, 100);

    expect(derived.range).toBe(20);
    expect(derived.body).toBe(5);
    expect(derived.upperWick).toBe(5);
    expect(derived.lowerWick).toBe(10);
    expect(derived.clv).toBeCloseTo(0.5, 6);
    expect(derived.tr).toBe(20);
  });

  it('computes series derived metrics with true range', () => {
    const candles: Candle[] = [
      { t: 1, o: 100, h: 110, l: 95, c: 105, v: 10 },
      { t: 2, o: 105, h: 120, l: 100, c: 115, v: 12 },
    ];

    const series = computeSeriesDerived(candles);

    expect(series.range).toEqual([15, 20]);
    expect(series.tr[0]).toBe(15);
    expect(series.tr[1]).toBe(20);
    expect(series.body).toEqual([5, 10]);
  });
});

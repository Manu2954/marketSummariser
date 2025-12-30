import { describe, expect, it } from 'vitest';
import type { Candle } from '../src/domain/types.js';
import { buildLiquidityInsights } from '../src/features/liquidity.js';

describe('liquidity insights', () => {
  it('detects initiative buy breaks', () => {
    const candles: Candle[] = Array.from({ length: 12 }, (_, index) => ({
      t: index + 1,
      o: 100,
      h: 101,
      l: 99,
      c: 100,
      v: 10,
    }));

    candles.push({
      t: 13,
      o: 100,
      h: 120,
      l: 98,
      c: 118,
      v: 500,
    });

    const insights = buildLiquidityInsights(candles);

    const types = insights.events.map((event) => event.type);
    expect(types).toContain('initiative_buy_break');
  });

  it('detects absorption and overhead supply zones', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, index) => ({
      t: index + 1,
      o: 100,
      h: 101,
      l: 99,
      c: 100,
      v: 10,
    }));

    candles.push({
      t: 21,
      o: 100,
      h: 105,
      l: 95,
      c: 101,
      v: 500,
    });
    candles.push({
      t: 22,
      o: 101,
      h: 104,
      l: 96,
      c: 100,
      v: 12,
    });
    candles.push({
      t: 23,
      o: 100,
      h: 103,
      l: 97,
      c: 102,
      v: 12,
    });

    const insights = buildLiquidityInsights(candles);

    const types = insights.events.map((event) => event.type);
    expect(types).toContain('absorption_suspected');
    expect(insights.levels.overheadSupply.length).toBeGreaterThan(0);
  });

  it('detects sweep down and support zones', () => {
    const candles: Candle[] = Array.from({ length: 10 }, (_, index) => ({
      t: index + 1,
      o: 100,
      h: 105,
      l: 95,
      c: 100,
      v: 10,
    }));

    candles.push({
      t: 11,
      o: 100,
      h: 104,
      l: 90,
      c: 96,
      v: 10,
    });

    const insights = buildLiquidityInsights(candles);

    const types = insights.events.map((event) => event.type);
    expect(types).toContain('liquidity_sweep_down');
    expect(insights.levels.supportZones.length).toBeGreaterThan(0);
  });
});

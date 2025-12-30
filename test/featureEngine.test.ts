import { describe, expect, it } from 'vitest';
import type { Candle } from '../src/domain/types.js';
import { buildFeatureReport } from '../src/features/report.js';

describe('feature report', () => {
  it('returns stable report keys', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, index) => ({
      t: index + 1,
      o: 100,
      h: 105,
      l: 95,
      c: 100,
      v: 10,
    }));

    const report = buildFeatureReport({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      candles,
    });

    expect(Object.keys(report)).toEqual([
      'meta',
      'stats',
      'state',
      'value',
      'levels',
      'events',
      'qualityFlags',
    ]);
  });

  it('computes deterministic stats from candles', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, index) => {
      const base = 100 + index;
      return {
        t: index + 1,
        o: base,
        h: base + 5,
        l: base - 5,
        c: base + 2,
        v: 10 + index,
      };
    });

    const report = buildFeatureReport({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      candles,
    });

    expect(report.meta.symbol).toBe('BTCUSDT');
    expect(report.meta.timeframe).toBe('1h');
    expect(report.meta.n).toBe(20);
    expect(report.meta.start).toBe(1);
    expect(report.meta.end).toBe(20);

    expect(report.stats.sessionReturnPct).toBeCloseTo(21, 6);
    expect(report.stats.rangePct).toBeCloseTo(29, 6);
    expect(report.stats.avgRange).toBe(10);
    expect(report.stats.atrLike).toBe(10);
    expect(report.stats.avgVolume).toBe(19.5);
    expect(report.stats.volumeP95).toBe(29);

    expect(report.state.regime).toBe('balance');
    expect(report.value.vwap).not.toBeNull();
    expect(report.value.closeClusterZones.length).toBeGreaterThan(0);

    expect(Array.isArray(report.levels.overheadSupply)).toBe(true);
    expect(Array.isArray(report.levels.supportZones)).toBe(true);
    expect(Array.isArray(report.levels.rejectionZones)).toBe(true);
    expect(Array.isArray(report.events)).toBe(true);
    expect(report.qualityFlags.missingExtras).toEqual(['n', 'tbv', 'tqv', 'qv']);
    expect(report.qualityFlags.notes).toEqual([]);
  });

  it('sorts candles when timestamps are out of order', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, index) => {
      const base = 200 + index;
      return {
        t: index + 1,
        o: base,
        h: base + 5,
        l: base - 5,
        c: base + 2,
        v: 20 + index,
      };
    });
    const unsorted = [...candles];
    [unsorted[0], unsorted[1]] = [unsorted[1], unsorted[0]];

    const report = buildFeatureReport({
      symbol: 'ETHUSDT',
      timeframe: '1h',
      candles: unsorted,
    });

    expect(report.meta.start).toBe(1);
    expect(report.qualityFlags.notes).toEqual(['Candles sorted by timestamp.']);
  });

  it('classifies regimes for imbalance trends', () => {
    const uptrend: Candle[] = Array.from({ length: 20 }, (_, index) => {
      const base = 100 + index * 10;
      return {
        t: index + 1,
        o: base,
        h: base + 1,
        l: base - 1,
        c: base + 1,
        v: 10,
      };
    });

    const downtrend: Candle[] = Array.from({ length: 20 }, (_, index) => {
      const base = 200 - index * 10;
      return {
        t: index + 1,
        o: base,
        h: base + 1,
        l: base - 1,
        c: base - 1,
        v: 10,
      };
    });

    const upReport = buildFeatureReport({ symbol: 'BTCUSDT', timeframe: '1h', candles: uptrend });
    const downReport = buildFeatureReport({ symbol: 'ETHUSDT', timeframe: '1h', candles: downtrend });

    expect(upReport.state.regime).toBe('imbalance_up');
    expect(downReport.state.regime).toBe('imbalance_down');
  });
});

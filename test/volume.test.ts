import { describe, expect, it } from 'vitest';
import type { Candle } from '../src/domain/types.js';
import {
  effortVsResult,
  rollingMean,
  rollingStd,
  volumePercentile,
  volumeZScore,
} from '../src/features/volume.js';

describe('volume helpers', () => {
  it('computes rolling mean and std', () => {
    const values = [1, 2, 3, 4];

    expect(rollingMean(values, 2)).toEqual([1, 1.5, 2.5, 3.5]);
    expect(rollingStd(values, 2)).toEqual([0, 0.5, 0.5, 0.5]);
  });

  it('computes volume z-scores', () => {
    const candles: Candle[] = [
      { t: 1, o: 1, h: 1, l: 1, c: 1, v: 10 },
      { t: 2, o: 1, h: 1, l: 1, c: 1, v: 20 },
      { t: 3, o: 1, h: 1, l: 1, c: 1, v: 30 },
    ];

    const zscores = volumeZScore(candles, 2);

    expect(zscores.length).toBe(3);
    expect(zscores[0]).toBe(0);
    expect(zscores[2]).toBeCloseTo(1, 6);
  });

  it('computes volume percentile', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, index) => ({
      t: index + 1,
      o: 1,
      h: 1,
      l: 1,
      c: 1,
      v: index + 1,
    }));

    expect(volumePercentile(candles)).toBe(20);
  });

  it('computes effort vs result metrics', () => {
    const candles: Candle[] = [
      { t: 1, o: 100, h: 115, l: 95, c: 110, v: 10 },
    ];

    const metrics = effortVsResult(candles);

    expect(metrics.displacement).toEqual([10]);
    expect(metrics.efficiency).toEqual([0.5]);
    expect(metrics.movePerVolume).toEqual([1]);
  });
});

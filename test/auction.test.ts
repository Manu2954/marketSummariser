import { describe, expect, it } from 'vitest';
import type { Candle } from '../src/domain/types.js';
import { buildAuctionFeatures } from '../src/features/auction.js';

describe('auction features', () => {
  it('scores balance with overlapping ranges', () => {
    const candles: Candle[] = Array.from({ length: 12 }, (_, index) => ({
      t: index + 1,
      o: 100,
      h: 110,
      l: 90,
      c: 100,
      v: 10,
    }));

    const features = buildAuctionFeatures(candles);

    expect(features.balanceScore).toBe(100);
    expect(features.trendEfficiencyScore).toBe(0);
    expect(features.volatilityExpansionScore).toBe(0);
    expect(features.regime).toBe('balance');
    expect(features.valueMigration).toBe('flat');
    expect(features.closeClusters[0]?.hits).toBe(12);
    expect(features.closeClusters[0]?.zone).toEqual([100, 101]);
  });

  it('detects volatility expansion and efficiency', () => {
    const candles: Candle[] = [
      { t: 1, o: 10, h: 11, l: 10, c: 10, v: 1 },
      { t: 2, o: 10, h: 11, l: 10, c: 10, v: 1 },
      { t: 3, o: 10, h: 11, l: 10, c: 10, v: 1 },
      { t: 4, o: 10, h: 13, l: 10, c: 12, v: 1 },
    ];

    const features = buildAuctionFeatures(candles);

    expect(features.volatilityExpansionScore).toBeCloseTo(35, 6);
    expect(features.trendEfficiencyScore).toBe(40);
  });

  it('tracks value migration via vwap slope', () => {
    const candles: Candle[] = Array.from({ length: 6 }, (_, index) => ({
      t: index + 1,
      o: 100 + index,
      h: 101 + index,
      l: 99 + index,
      c: 100 + index,
      v: 10,
    }));

    const features = buildAuctionFeatures(candles);

    expect(features.vwap).not.toBeNull();
    expect(features.vwapSlope).toBeGreaterThan(0);
    expect(features.valueMigration).toBe('up');
    expect(features.closeClusters.length).toBe(2);
    expect(features.closeClusters[0]?.zone).toEqual([100, 101]);
  });
});

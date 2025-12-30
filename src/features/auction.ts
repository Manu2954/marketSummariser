import type { AuctionFeatures, OhlcvCandle } from '../domain/types.js';
import { computeSeriesDerived } from './ohlcv.js';
import { clamp, clamp01, linregSlope, median, safeDiv, sum } from '../utils/math.js';

const EPSILON = 1e-12;
const BALANCE_WINDOW = 12;
const EXPANSION_WINDOW = 20;
const VWAP_SLOPE_WINDOW = 30;

export type AuctionRegime = 'balance' | 'imbalance_up' | 'imbalance_down';
export type ValueMigration = 'up' | 'down' | 'flat';

export type CloseCluster = {
  zone: [number, number];
  hits: number;
};

export type AuctionFeatureSet = {
  balanceScore: number;
  trendEfficiencyScore: number;
  volatilityExpansionScore: number;
  regime: AuctionRegime;
  confidence: number;
  vwap: number | null;
  vwapSlope: number;
  valueMigration: ValueMigration;
  closeClusters: CloseCluster[];
};

function rollingMedian(values: number[], window: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    return median(values.slice(start, index + 1));
  });
}

function computeBalanceScore(candles: OhlcvCandle[], window: number): number {
  if (candles.length < 2) {
    return 0;
  }
  const startIndex = Math.max(1, candles.length - window);
  const ratios: number[] = [];

  for (let index = startIndex; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    const overlap = Math.max(0, Math.min(current.h, previous.h) - Math.max(current.l, previous.l));
    const range = current.h - current.l;
    ratios.push(safeDiv(overlap, Math.max(range, EPSILON), 0));
  }

  if (ratios.length === 0) {
    return 0;
  }

  const averageRatio = sum(ratios) / ratios.length;
  return clamp(averageRatio * 100, 0, 100);
}

function computeTrendEfficiencyScore(candles: OhlcvCandle[], trueRanges: number[]): number {
  if (candles.length === 0) {
    return 0;
  }
  const first = candles[0];
  const last = candles[candles.length - 1];
  const netMove = Math.abs(last.c - first.o);
  const sumTR = sum(trueRanges);
  const efficiency = safeDiv(netMove, Math.max(sumTR, EPSILON), 0);
  return clamp(Math.round(efficiency * 120), 0, 100);
}

function computeVolatilityExpansionScore(trueRanges: number[]): number {
  if (trueRanges.length === 0) {
    return 0;
  }
  const medians = rollingMedian(trueRanges, EXPANSION_WINDOW);
  let expansionCount = 0;

  trueRanges.forEach((tr, index) => {
    const threshold = medians[index] * 1.5;
    if (tr > threshold) {
      expansionCount += 1;
    }
  });

  const ratio = expansionCount / trueRanges.length;
  return clamp(ratio * 140, 0, 100);
}

function computeVwapSeries(candles: OhlcvCandle[]): number[] {
  let cumulativePv = 0;
  let cumulativeVolume = 0;
  const series: number[] = [];

  candles.forEach((candle) => {
    const typicalPrice = (candle.h + candle.l + candle.c) / 3;
    cumulativePv += typicalPrice * candle.v;
    cumulativeVolume += candle.v;
    series.push(cumulativeVolume === 0 ? 0 : cumulativePv / cumulativeVolume);
  });

  return series;
}

function computeValueMigration(vwapSeries: number[], slope: number): ValueMigration {
  if (vwapSeries.length === 0) {
    return 'flat';
  }
  const last = vwapSeries[vwapSeries.length - 1];
  const tolerance = Math.max(Math.abs(last) * 0.0001, 1e-6);
  if (slope > tolerance) {
    return 'up';
  }
  if (slope < -tolerance) {
    return 'down';
  }
  return 'flat';
}

function computeCloseClusters(candles: OhlcvCandle[]): CloseCluster[] {
  if (candles.length === 0) {
    return [];
  }
  const closes = candles.map((candle) => candle.c);
  const reference = Math.abs(closes[closes.length - 1] ?? 0);
  const binSize = reference >= 100 ? 1 : 0.5;
  const buckets = new Map<number, number>();

  closes.forEach((close) => {
    const binIndex = Math.floor(close / binSize);
    const low = binIndex * binSize;
    buckets.set(low, (buckets.get(low) ?? 0) + 1);
  });

  const clusters = Array.from(buckets.entries()).map(([low, hits]) => ({
    zone: [low, low + binSize] as [number, number],
    hits,
  }));

  clusters.sort((left, right) => {
    if (right.hits !== left.hits) {
      return right.hits - left.hits;
    }
    return left.zone[0] - right.zone[0];
  });

  return clusters.slice(0, 2);
}

export function buildAuctionFeatures(
  candles: OhlcvCandle[],
  derived = computeSeriesDerived(candles),
): AuctionFeatureSet {
  const balanceScore = computeBalanceScore(candles, BALANCE_WINDOW);
  const trendEfficiencyScore = computeTrendEfficiencyScore(candles, derived.tr);
  const volatilityExpansionScore = computeVolatilityExpansionScore(derived.tr);

  const first = candles[0];
  const last = candles[candles.length - 1];
  const regime: AuctionRegime =
    balanceScore > 60
      ? 'balance'
      : last && first && last.c < first.o
        ? 'imbalance_down'
        : 'imbalance_up';

  let confidence = (trendEfficiencyScore + volatilityExpansionScore) / 200;
  if (regime === 'balance') {
    confidence *= 0.7;
  }
  confidence = clamp01(confidence);

  const vwapSeries = computeVwapSeries(candles);
  const vwap = vwapSeries.length === 0 ? null : vwapSeries[vwapSeries.length - 1];
  const vwapSlice = vwapSeries.slice(-VWAP_SLOPE_WINDOW);
  const vwapSlope = linregSlope(vwapSlice);
  const valueMigration = computeValueMigration(vwapSeries, vwapSlope);

  return {
    balanceScore,
    trendEfficiencyScore,
    volatilityExpansionScore,
    regime,
    confidence,
    vwap,
    vwapSlope,
    valueMigration,
    closeClusters: computeCloseClusters(candles),
  };
}

export function computeAuctionFeatures(candles: OhlcvCandle[]): AuctionFeatures {
  const features = buildAuctionFeatures(candles);
  const vwap = features.vwap ?? 0;
  const lastClose = candles[candles.length - 1]?.c ?? 0;

  return {
    vwap,
    lastCloseVsVwap: lastClose - vwap,
  };
}

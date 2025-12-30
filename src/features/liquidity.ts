import type { FeatureEvent, FeatureLevels, FeatureQualityFlags, LiquidityFeatures, OhlcvCandle } from '../domain/types.js';
import { computeSeriesDerived } from './ohlcv.js';
import { effortVsResult, volumePercentile, volumeZScore } from './volume.js';
import { clamp01, median, percentile, safeDiv } from '../utils/math.js';

const EPSILON = 1e-12;
const BALANCE_LOOKBACK = 12;
const SWING_LOOKBACK = 20;
const EXPANSION_WINDOW = 20;

function rollingMedian(values: number[], window: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    return median(values.slice(start, index + 1));
  });
}

function detectMissingLiquidityExtras(candles: OhlcvCandle[]): FeatureQualityFlags['missingExtras'] {
  const missing: FeatureQualityFlags['missingExtras'] = [];

  if (candles.every((candle) => candle.n === undefined)) {
    missing.push('n');
  }
  if (candles.every((candle) => candle.tbv === undefined)) {
    missing.push('tbv');
  }

  return missing;
}

function addEvent(
  events: FeatureEvent[],
  type: string,
  candle: OhlcvCandle,
  severity: number,
  context: string,
): void {
  events.push({
    type,
    t: candle.t,
    severity: clamp01(severity),
    context: { note: context },
  });
}

function computeBreakLevels(candles: OhlcvCandle[], index: number, lookback: number): {
  priorLow: number;
  priorHigh: number;
} {
  const start = Math.max(0, index - lookback);
  const window = candles.slice(start, index);
  let priorLow = Number.POSITIVE_INFINITY;
  let priorHigh = Number.NEGATIVE_INFINITY;

  window.forEach((candle) => {
    if (candle.l < priorLow) {
      priorLow = candle.l;
    }
    if (candle.h > priorHigh) {
      priorHigh = candle.h;
    }
  });

  if (priorLow === Number.POSITIVE_INFINITY) {
    priorLow = candles[index].l;
  }
  if (priorHigh === Number.NEGATIVE_INFINITY) {
    priorHigh = candles[index].h;
  }

  return { priorLow, priorHigh };
}

function computeSeverity(tr: number, medianTr: number, volumeZ: number, volume: number, volumeP90: number, clv: number): number {
  const trScore = clamp01(safeDiv(tr, Math.max(medianTr * 1.5, EPSILON), 0));
  const volumeScore = clamp01(Math.max(volumeZ / 3, safeDiv(volume, Math.max(volumeP90, EPSILON), 0)));
  const clvScore = clamp01(Math.abs(clv));
  return 0.4 * trScore + 0.4 * volumeScore + 0.2 * clvScore;
}

function buildRejectionZones(candles: OhlcvCandle[], ranges: number[], upperWicks: number[], lowerWicks: number[]): [number, number][] {
  const wickExtremes: number[] = [];

  candles.forEach((candle, index) => {
    const range = ranges[index] ?? 0;
    if (range <= EPSILON) {
      return;
    }
    const upperRatio = (upperWicks[index] ?? 0) / range;
    const lowerRatio = (lowerWicks[index] ?? 0) / range;
    if (upperRatio > 0.6) {
      wickExtremes.push(candle.h);
    }
    if (lowerRatio > 0.6) {
      wickExtremes.push(candle.l);
    }
  });

  if (wickExtremes.length === 0) {
    return [];
  }

  const reference = Math.abs(wickExtremes[wickExtremes.length - 1]);
  const binSize = reference >= 100 ? 1 : 0.5;
  const buckets = new Map<number, number>();

  wickExtremes.forEach((value) => {
    const binIndex = Math.floor(value / binSize);
    const low = binIndex * binSize;
    buckets.set(low, (buckets.get(low) ?? 0) + 1);
  });

  const clusters = Array.from(buckets.entries())
    .filter(([, hits]) => hits >= 2)
    .map(([low, hits]) => ({ low, hits }))
    .sort((left, right) => right.hits - left.hits)
    .slice(0, 2);

  return clusters.map((cluster) => [cluster.low, cluster.low + binSize]);
}

export function computeLiquidityFeatures(candles: OhlcvCandle[]): LiquidityFeatures {
  const ranges = candles.map((candle) => candle.h - candle.l);
  const lastRange = ranges[ranges.length - 1] ?? 0;
  const lastClose = candles[candles.length - 1]?.c ?? 0;

  return {
    averageRange: ranges.length === 0 ? 0 : ranges.reduce((sum, value) => sum + value, 0) / ranges.length,
    lastRange,
    rangePct: lastClose === 0 ? 0 : lastRange / lastClose,
  };
}

export function buildLiquidityInsights(candles: OhlcvCandle[]): {
  events: FeatureEvent[];
  levels: FeatureLevels;
  missingExtras: FeatureQualityFlags['missingExtras'];
} {
  const events: FeatureEvent[] = [];
  const derived = computeSeriesDerived(candles);
  const volumeZ = volumeZScore(candles, 20);
  const volumeP90 = volumePercentile(candles, 0.9);
  const moveMetrics = effortVsResult(candles);
  const rollingMedianTR = rollingMedian(derived.tr, EXPANSION_WINDOW);
  const movePerVolumeThreshold = percentile(moveMetrics.movePerVolume, 0.9);
  const overheadSupply: [number, number][] = [];
  const supportZones: [number, number][] = [];

  candles.forEach((candle, index) => {
    const range = derived.range[index] ?? 0;
    const body = derived.body[index] ?? 0;
    const clv = derived.clv[index] ?? 0;
    const tr = derived.tr[index] ?? 0;
    const medianTr = rollingMedianTR[index] ?? 0;
    const volZ = volumeZ[index] ?? 0;
    const { priorLow, priorHigh } = computeBreakLevels(candles, index, BALANCE_LOOKBACK);
    const { priorLow: swingLow, priorHigh: swingHigh } = computeBreakLevels(
      candles,
      index,
      SWING_LOOKBACK,
    );

    const rangeExpansion = tr > 1.5 * medianTr;
    const volumeSpike = volZ > 1.5 || candle.v > volumeP90;
    const breaksDown = candle.l < priorLow;
    const breaksUp = candle.h > priorHigh;

    if (rangeExpansion && volumeSpike && clv < -0.6 && breaksDown) {
      const severity = computeSeverity(tr, medianTr, volZ, candle.v, volumeP90, clv);
      addEvent(events, 'initiative_sell_break', candle, severity, 'expansion+volume+clv+breakdown');
    }

    if (rangeExpansion && volumeSpike && clv > 0.6 && breaksUp) {
      const severity = computeSeverity(tr, medianTr, volZ, candle.v, volumeP90, clv);
      addEvent(events, 'initiative_buy_break', candle, severity, 'expansion+volume+clv+breakout');
    }

    const bodyRatio = safeDiv(body, Math.max(range, EPSILON), 0);
    if (volZ > 1.5 && bodyRatio < 0.25 && index + 2 < candles.length) {
      const limitUp = candle.h + range * 0.2;
      const limitDown = candle.l - range * 0.2;
      const noFollowThrough = [candles[index + 1], candles[index + 2]].every(
        (nextCandle) => nextCandle.c <= limitUp && nextCandle.c >= limitDown,
      );
      if (noFollowThrough) {
        const severity = clamp01(volZ / 3) * clamp01(1 - bodyRatio / 0.25);
        addEvent(
          events,
          'absorption_suspected',
          candle,
          severity,
          'high_vol + small_body + no_followthrough',
        );
        if (candle.c >= candle.o) {
          overheadSupply.push([candle.h - range * 0.2, candle.h]);
        }
      }
    }

    const classicSweepDown =
      candle.l < swingLow && candle.c > swingLow && candle.c < swingHigh && candle.h > swingLow;
    const classicSweepUp =
      candle.h > swingHigh && candle.c < swingHigh && candle.c > swingLow && candle.l < swingHigh;

    if (classicSweepDown) {
      const severity = clamp01(Math.abs(clv));
      addEvent(events, 'liquidity_sweep_down', candle, severity, 'classic sweep down');
      supportZones.push([candle.l, candle.l + range * 0.2]);
    }

    if (classicSweepUp) {
      const severity = clamp01(Math.abs(clv));
      addEvent(events, 'liquidity_sweep_up', candle, severity, 'classic sweep up');
    }

    const prevIndex = index - 1;
    if (prevIndex >= 0) {
      const currentDir = Math.sign(candle.c - candle.o);
      const prevDir = Math.sign(candles[prevIndex].c - candles[prevIndex].o);
      const displacementRatio = safeDiv(body, Math.max(range, EPSILON), 0);
      const prevDisplacement = safeDiv(
        derived.body[prevIndex] ?? 0,
        Math.max(derived.range[prevIndex] ?? 0, EPSILON),
        0,
      );
      const movePerVolume = moveMetrics.movePerVolume[index] ?? 0;
      const prevMovePerVolume = moveMetrics.movePerVolume[prevIndex] ?? 0;
      const highMove =
        movePerVolume > movePerVolumeThreshold && prevMovePerVolume > movePerVolumeThreshold;
      const strongDisplacement = displacementRatio > 0.6 && prevDisplacement > 0.6;

      if (highMove && strongDisplacement && currentDir !== 0 && currentDir === prevDir) {
        const severity = clamp01(0.6 * (movePerVolume / (movePerVolumeThreshold + EPSILON)) + 0.4 * displacementRatio);
        const type = currentDir > 0 ? 'liquidity_sweep_up' : 'liquidity_sweep_down';
        addEvent(events, type, candle, severity, 'thin-liquidity continuation');
        if (type === 'liquidity_sweep_down') {
          supportZones.push([candle.l, candle.l + range * 0.2]);
        }
      }
    }
  });

  const rejectionZones = buildRejectionZones(
    candles,
    derived.range,
    derived.upperWick,
    derived.lowerWick,
  );

  return {
    events,
    levels: {
      overheadSupply,
      supportZones,
      rejectionZones,
    },
    missingExtras: detectMissingLiquidityExtras(candles),
  };
}

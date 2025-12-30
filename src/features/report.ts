import type { FeatureReport, MarketSummaryRequest, OhlcvCandle } from '../domain/types.js';
import { marketSummaryRequestSchema } from '../domain/schemas.js';
import { buildAuctionFeatures } from './auction.js';
import { buildLiquidityInsights } from './liquidity.js';
import { computeOhlcvStats, computeSeriesDerived } from './ohlcv.js';
import { computeVolumeStats, volumePercentile } from './volume.js';
import { clamp, mean, safeDiv, sortByNumber } from '../utils/math.js';

const extraKeys = ['n', 'tbv', 'tqv', 'qv'] as const;

type ExtraKey = (typeof extraKeys)[number];

function detectMissingExtras(candles: OhlcvCandle[]): ExtraKey[] {
  const missing: ExtraKey[] = [];

  if (candles.every((candle) => candle.n === undefined)) {
    missing.push('n');
  }
  if (candles.every((candle) => candle.tbv === undefined)) {
    missing.push('tbv');
  }
  if (candles.every((candle) => candle.tqv === undefined)) {
    missing.push('tqv');
  }
  if (candles.every((candle) => candle.qv === undefined)) {
    missing.push('qv');
  }

  return missing;
}

function addNote(notes: Set<string>, message: string): void {
  notes.add(message);
}

function finiteOr(value: number, fallback: number, notes: Set<string>, label: string): number {
  if (!Number.isFinite(value)) {
    addNote(notes, `Non-finite ${label} replaced with ${fallback}.`);
    return fallback;
  }
  return value;
}

function sanitizeZone(zone: [number, number], notes: Set<string>, label: string): [number, number] {
  const low = finiteOr(zone[0], 0, notes, `${label}.low`);
  const high = finiteOr(zone[1], 0, notes, `${label}.high`);
  if (low > high) {
    addNote(notes, `Swapped ${label} bounds to enforce low<=high.`);
    return [high, low];
  }
  return [low, high];
}

export function buildFeatureReport(request: MarketSummaryRequest): FeatureReport {
  const parsed = marketSummaryRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error('Invalid market summary request for feature report.');
  }

  const notes = new Set<string>();
  const { sorted: candles, wasSorted } = sortByNumber(parsed.data.candles, (candle) => candle.t);
  if (wasSorted) {
    addNote(notes, 'Candles sorted by timestamp.');
  }

  const first = candles[0];
  const last = candles[candles.length - 1];
  const ohlcv = computeOhlcvStats(candles);
  const derived = computeSeriesDerived(candles);
  const volume = computeVolumeStats(candles);
  const auction = buildAuctionFeatures(candles, derived);
  const liquidityInsights = buildLiquidityInsights(candles);

  if (!first || !last) {
    addNote(notes, 'No candles available; metrics defaulted to zero.');
  }

  const baseOpen = first?.o ?? 0;
  if (baseOpen === 0) {
    addNote(notes, 'Open price is zero; percent metrics defaulted to 0.');
  }

  const sessionReturnPct = safeDiv((last?.c ?? 0) - (first?.o ?? 0), baseOpen, 0) * 100;
  const rangePct =
    safeDiv((ohlcv.high ?? 0) - (ohlcv.low ?? 0), baseOpen, 0) * 100;

  const stats = {
    sessionReturnPct: finiteOr(sessionReturnPct, 0, notes, 'stats.sessionReturnPct'),
    rangePct: finiteOr(rangePct, 0, notes, 'stats.rangePct'),
    avgRange: finiteOr(mean(derived.range), 0, notes, 'stats.avgRange'),
    atrLike: finiteOr(mean(derived.tr), 0, notes, 'stats.atrLike'),
    avgVolume: finiteOr(volume.average, 0, notes, 'stats.avgVolume'),
    volumeP95: finiteOr(volumePercentile(candles, 0.95), 0, notes, 'stats.volumeP95'),
  };

  const state = {
    regime: auction.regime,
    balanceScore: finiteOr(clamp(auction.balanceScore, 0, 100), 0, notes, 'state.balanceScore'),
    trendEfficiencyScore: finiteOr(
      clamp(auction.trendEfficiencyScore, 0, 100),
      0,
      notes,
      'state.trendEfficiencyScore',
    ),
    volatilityExpansionScore: finiteOr(
      clamp(auction.volatilityExpansionScore, 0, 100),
      0,
      notes,
      'state.volatilityExpansionScore',
    ),
    confidence: finiteOr(clamp(auction.confidence, 0, 1), 0, notes, 'state.confidence'),
  };

  let vwap = auction.vwap;
  if (vwap !== null && !Number.isFinite(vwap)) {
    addNote(notes, 'Non-finite value.vwap replaced with null.');
    vwap = null;
  }

  const value = {
    vwap,
    vwapSlope: finiteOr(auction.vwapSlope, 0, notes, 'value.vwapSlope'),
    valueMigration: auction.valueMigration,
    closeClusterZones: auction.closeClusters.map((cluster, index) =>
      sanitizeZone(cluster.zone, notes, `value.closeClusterZones[${index}]`),
    ),
  };

  return {
    meta: {
      symbol: parsed.data.symbol,
      timeframe: parsed.data.timeframe,
      n: candles.length,
      start: candles[0]?.t ?? 0,
      end: candles[candles.length - 1]?.t ?? 0,
    },
    stats,
    state,
    value,
    levels: {
      overheadSupply: liquidityInsights.levels.overheadSupply.map((zone, index) =>
        sanitizeZone(zone, notes, `levels.overheadSupply[${index}]`),
      ),
      supportZones: liquidityInsights.levels.supportZones.map((zone, index) =>
        sanitizeZone(zone, notes, `levels.supportZones[${index}]`),
      ),
      rejectionZones: liquidityInsights.levels.rejectionZones.map((zone, index) =>
        sanitizeZone(zone, notes, `levels.rejectionZones[${index}]`),
      ),
    },
    events: liquidityInsights.events,
    qualityFlags: {
      missingExtras: Array.from(
        new Set<ExtraKey>([...detectMissingExtras(candles), ...liquidityInsights.missingExtras]),
      ),
      notes: Array.from(notes),
    },
  };
}

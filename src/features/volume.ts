import type { OhlcvCandle, VolumeStats } from '../domain/types.js';
import { average, max, mean, percentile, safeDiv, stddev, sum } from '../utils/math.js';

const EPSILON = 1e-12;

export function computeVolumeStats(candles: OhlcvCandle[]): VolumeStats {
  const volumes = candles.map((candle) => candle.v);

  return {
    total: sum(volumes),
    average: average(volumes),
    max: max(volumes),
    last: volumes[volumes.length - 1] ?? 0,
  };
}

export function rollingMean(values: number[], window: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    return mean(values.slice(start, index + 1));
  });
}

export function rollingStd(values: number[], window: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    return stddev(values.slice(start, index + 1));
  });
}

export function volumeZScore(candles: OhlcvCandle[], window: number = 20): number[] {
  const volumes = candles.map((candle) => candle.v);
  const means = rollingMean(volumes, window);
  const stds = rollingStd(volumes, window);

  return volumes.map((volume, index) => safeDiv(volume - means[index], stds[index], 0));
}

export function volumePercentile(candles: OhlcvCandle[], rank: number = 0.95): number {
  const volumes = candles.map((candle) => candle.v);
  return percentile(volumes, rank);
}

export function effortVsResult(candles: OhlcvCandle[]): {
  displacement: number[];
  efficiency: number[];
  movePerVolume: number[];
} {
  const displacement: number[] = [];
  const efficiency: number[] = [];
  const movePerVolume: number[] = [];

  candles.forEach((candle) => {
    const range = candle.h - candle.l;
    const move = Math.abs(candle.c - candle.o);
    displacement.push(move);
    efficiency.push(safeDiv(move, Math.max(range, EPSILON), 0));
    movePerVolume.push(safeDiv(move, Math.max(candle.v, EPSILON), 0));
  });

  return { displacement, efficiency, movePerVolume };
}

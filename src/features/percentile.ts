import { fetchBinanceCandles } from '../data/binance.js';

async function getData(symbol: string, interval: string, startTime: number, endTime: number) {
  return fetchBinanceCandles({
    symbol,
    interval,
    startTime,
    endTime,
  });
}

function getP_95Volume(volumes: number[]): number {
  if (volumes.length === 0) {
    return 0;
  }

  const volumesSorted = volumes
    .filter((volume) => Number.isFinite(volume))
    .sort((a, b) => a - b);

  if (volumesSorted.length === 0) {
    return 0;
  }

  // Linear interpolation on 0-based indices keeps the percentile inside bounds.
  const percentileRank = 0.95 * (volumesSorted.length - 1);
  const lowerIndex = Math.floor(percentileRank);
  const upperIndex = Math.min(volumesSorted.length - 1, Math.ceil(percentileRank));

  if (lowerIndex === upperIndex) {
    return volumesSorted[lowerIndex];
  }

  const weight = percentileRank - lowerIndex;
  return volumesSorted[lowerIndex] + weight * (volumesSorted[upperIndex] - volumesSorted[lowerIndex]);
}

try {
  const candles = await getData('BTCUSDT', '5m', 1767882300000, 1767892800000);
  const volumes = (candles: { v: number }[]): number[] => candles.map((candle) => candle.v);

  const P_95 = getP_95Volume(volumes(candles));

  console.log(P_95);

} catch (error) {
  console.error('Failed to fetch candles:', error instanceof Error ? error.message : error);
}

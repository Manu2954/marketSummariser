export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return sum(values) / values.length;
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return sum(values) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function stddev(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function max(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.max(...values);
}

export function min(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.min(...values);
}

export function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(Math.max(value, minValue), maxValue);
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function safeDiv(numerator: number, denominator: number, fallback: number = 0): number {
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) {
    return fallback;
  }
  return numerator / denominator;
}

export function isNonDecreasing(values: number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[index - 1]) {
      return false;
    }
  }
  return true;
}

export function sortByNumber<T>(
  items: T[],
  selector: (item: T) => number,
): { sorted: T[]; wasSorted: boolean } {
  const values = items.map(selector);
  if (isNonDecreasing(values)) {
    return { sorted: items, wasSorted: false };
  }
  const sorted = [...items].sort((left, right) => selector(left) - selector(right));
  return { sorted, wasSorted: true };
}

export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) {
    return 0;
  }
  const clampedFraction = clamp(fraction, 0, 1);
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor(clampedFraction * sorted.length));
  return sorted[index];
}

export function linregSlope(values: number[], xs?: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const n = values.length;
  const xValues = xs ?? values.map((_, index) => index);
  if (xValues.length !== values.length) {
    return 0;
  }
  const sumX = sum(xValues);
  const sumY = sum(values);
  const sumXY = sum(values.map((value, index) => value * xValues[index]));
  const sumXX = sum(xValues.map((value) => value * value));
  const denominator = n * sumXX - sumX * sumX;
  return safeDiv(n * sumXY - sumX * sumY, denominator, 0);
}

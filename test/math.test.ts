import { describe, expect, it } from 'vitest';
import { linregSlope, mean, median, safeDiv, stddev } from '../src/utils/math.js';

describe('math helpers', () => {
  it('computes mean and median', () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(median([1, 3, 2, 4])).toBe(2.5);
  });

  it('computes standard deviation', () => {
    expect(stddev([1, 2, 3])).toBeCloseTo(0.816496, 6);
  });

  it('handles safe division', () => {
    expect(safeDiv(10, 2, 0)).toBe(5);
    expect(safeDiv(10, 0, 5)).toBe(5);
  });

  it('computes linear regression slope', () => {
    expect(linregSlope([1, 2, 3, 4])).toBeCloseTo(1, 6);
    expect(linregSlope([1, 3, 5], [0, 2, 4])).toBeCloseTo(1, 6);
  });
});

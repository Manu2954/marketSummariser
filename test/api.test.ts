import { afterAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/api/server.js';

const app = buildServer({ logger: false, dbPath: ':memory:' });

afterAll(async () => {
  await app.close();
});

describe('api', () => {
  it('returns health status', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('accepts market summary requests', async () => {
    const candles = Array.from({ length: 20 }, (_, index) => {
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

    const payload = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      candles,
    };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/market/summary',
      payload,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.featureReport).toBeTruthy();
    expect(body.featureReport.meta).toBeTruthy();
    expect(body.featureReport.stats).toBeTruthy();
    expect(body.llmSummary).toBeTruthy();
    expect(body.llmSummary.summary).toBeTruthy();
    expect(body.text).toBeTypeOf('string');
  });
});

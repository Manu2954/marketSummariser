import type { Candle, SummaryRequest } from './schema';

type SummaryResponse = {
  featureReport: Record<string, unknown>;
  llmSummary: Record<string, unknown>;
  text: string;
  candles?: Candle[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function getSummary(payload: SummaryRequest): Promise<SummaryResponse> {
  const response = await fetch(`${API_BASE}/v1/market/summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await parseJsonResponse(response);
    const message =
      typeof detail === 'string'
        ? detail
        : detail && typeof detail === 'object'
          ? JSON.stringify(detail)
          : 'Request failed.';
    throw new Error(message);
  }

  const data = (await response.json()) as SummaryResponse;
  return data;
}

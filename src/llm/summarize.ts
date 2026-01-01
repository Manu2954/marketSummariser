import type {
  Candle,
  FeatureReport,
  LlmSummary,
  MarketSummaryPreferences,
  SummaryResult,
} from '../domain/types.js';
import { llmSummarySchema } from '../domain/schemas.js';
import { z } from 'zod';
import { buildFixPrompt, buildPrompt } from './prompt.js';

export interface LlmClient {
  complete(prompt: string): Promise<string>;
}

type OpenAiClientOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

// const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1/chat/completions';

export function createOpenAiClient(options: OpenAiClientOptions = {}): LlmClient {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = process.env.LLM_MODEL;
  const baseUrl = options.baseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL;

  console.log(apiKey, model, baseUrl);

  return {
    async complete(prompt: string): Promise<string> {
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set.');
      }

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a precise market summarization engine.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI request failed: ${response.status} ${text}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI response missing content.');
      }
      return content;
    },
  };
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model output.');
  }
  return text.slice(start, end + 1);
}

function parseAndValidate(raw: string): LlmSummary {
  const jsonText = extractJson(raw.trim());
  const parsed = JSON.parse(jsonText) as unknown;
  const result = llmSummarySchema.safeParse(parsed);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

function buildFallbackSummary(report: FeatureReport): LlmSummary {
  const levels = report.levels;
  const events = report.events.map((event) => ({
    type: event.type,
    t: event.t,
    severity: event.severity,
  }));
  const onlyOhlcv = report.qualityFlags.missingExtras.length >= 4;

  const details = [
    `Auction regime ${report.state.regime} with balance score ${report.state.balanceScore.toFixed(0)}.`,
    `Trend efficiency ${report.state.trendEfficiencyScore.toFixed(0)} and expansion ${report.state.volatilityExpansionScore.toFixed(0)}.`,
    `Session return ${report.stats.sessionReturnPct.toFixed(2)}% and range ${report.stats.rangePct.toFixed(2)}%.`,
    `Volume P95 ${report.stats.volumeP95.toFixed(2)} with avg volume ${report.stats.avgVolume.toFixed(2)}.`,
  ];

  const invalidateIf = [
    'Session range compresses below recent average and momentum stalls',
    'Sustained acceptance beyond dominant supply/support zones',
    'Follow-through fails after a breakout impulse',
  ];

  const textParts = [
    `Auction: Regime ${report.state.regime}; confidence ${report.state.confidence.toFixed(2)}.`,
    `Auction: Balance ${report.state.balanceScore.toFixed(0)}; efficiency ${report.state.trendEfficiencyScore.toFixed(0)}.`,
    `Volume: Avg ${report.stats.avgVolume.toFixed(2)}; P95 ${report.stats.volumeP95.toFixed(2)}.`,
    `Liquidity: Events ${report.events.length}; overhead zones ${report.levels.overheadSupply.length}; supports ${report.levels.supportZones.length}.`,
    `Options: Favor pullback entries if structure holds; avoid chasing expansion candles.`,
    `Checklist: Expansion? ${report.state.volatilityExpansionScore.toFixed(0)}. Rejection? ${report.levels.rejectionZones.length}.`,
    `Final: ${report.state.regime} bias with ${report.value.valueMigration} value migration.`,
    'Risk: Acting mid-expansion increases slippage and reduces edge.',
  ];
  if (onlyOhlcv) {
    textParts.push(
      'Only OHLCV-based signals are available; treat liquidity inference as probabilistic.',
    );
  }
  const text = textParts.join('\n');

  return {
    state: {
      auction: report.state.regime,
      confidence: report.state.confidence,
    },
    levels: {
      overheadSupply: levels.overheadSupply,
      support: levels.supportZones,
    },
    events,
    summary: {
      one_liner: `Regime ${report.state.regime} with ${report.stats.sessionReturnPct.toFixed(2)}% session return.`,
      details,
      invalidate_if: invalidateIf,
    },
    text,
  };
}

export function summarizeDeterministic(report: FeatureReport): SummaryResult {
  const llmSummary = buildFallbackSummary(report);
  return {
    llmSummary,
    text: llmSummary.text,
  };
}

export async function summarizeMarket(
  report: FeatureReport,
  candlesTail: Candle[] = [],
  preferences?: MarketSummaryPreferences,
  client: LlmClient | null = null,
): Promise<SummaryResult> {
  const prompt = buildPrompt(report, candlesTail, preferences);
  const llmClient = client ?? createOpenAiClient();
  let llmSummary: LlmSummary | null = null;
  let raw = '';

  try {
    console.log(prompt);
    raw = await llmClient.complete(prompt);
    console.log(raw);
    llmSummary = parseAndValidate(raw);
  } catch (error) {
    console.log("manu", error)
    if (raw.trim().length > 0) {
      const details =
        error instanceof z.ZodError ? JSON.stringify(error.flatten()) : String(error);
      const fixPrompt = buildFixPrompt(raw, details);
      try {
        const retryRaw = await llmClient.complete(fixPrompt);
        llmSummary = parseAndValidate(retryRaw);
      } catch {
        llmSummary = null;
      }
    } else {
      llmSummary = null;
    }
  }

  if (!llmSummary) {
    console.log("manoj");
    llmSummary = buildFallbackSummary(report);
  }

  return {
    llmSummary,
    text: llmSummary.text,
  };
}

import type { Candle, FeatureReport, MarketSummaryPreferences } from '../domain/types.js';

function formatSection(title: string, payload: unknown): string {
  return `${title}:\n${JSON.stringify(payload, null, 2)}`;
}

export function buildPrompt(
  report: FeatureReport,
  candlesTail: Candle[] = [],
  preferences?: MarketSummaryPreferences,
): string {
  const extrasMissing = report.qualityFlags.missingExtras;
const hasOnlyOhlcv = extrasMissing.length > 0;

  const instructions = [
    'You are writing a post-auction tape-reading memo.',
    'This memo explains how the auction unfolded and why the market is behaving as it is now.',
    'The memo itself is the primary output. Structured fields are secondary.',
    'If the correct conclusion is uncertainty or balance, state that plainly.',
    'Do not optimize for actionability. Optimize for correctness.',
    'You are a market analyst summarizing auction-style market structure from OHLCV data.',
    'You only see the last 15 candles for context; broader session stats come from the feature report.',
    'Tone: brutally direct, unfiltered, and challenging. No fluff, no validation.',
    'Pressure-test the evidence: call out weak signals, blind spots, and uncertainty explicitly.',
    'If signals conflict or are thin, say so and state the opportunity cost or risk of acting on them.',
    'Do not speculate about user intent or personal context; keep it strictly market-focused.',
    'Primary objective: narrate the auction process that led to the current state.',
    'Think in sequence: prior value → initiative attempt → response → acceptance or rejection → current condition.',
    'Do NOT summarize indicators or features independently; always explain how they interact.',
    'State explicitly whether the market is in initiative, balance, or transition — and why.',
    'If evidence is insufficient to resolve direction, say so and default to balance/renegotiation.',
    'Never manufacture precision: ranges > exact levels; conditions > predictions.',
    'Volume analysis must answer: effort vs result, expansion vs contraction, follow-through vs absorption.',
    'Liquidity analysis must answer: what liquidity was taken, what remains, and what is now overhead or supportive.',
    'The "text" field must read like a professional tape-reading debrief, not a dashboard.',
    'Use short, declarative lines. Include at least 8 lines.',
    'Call out failed initiative, acceptance, rejection, and balance explicitly when present.',
    'If only OHLCV is available, state exactly what cannot be known.',
    'state.auction is a single phrase (e.g., "renegotiation with absorption", "initiative selling, acceptance pending", "balance after failed initiative").',
    '"state.confidence" reflects strength of acceptance, not directional conviction. Balance/renegotiation should be low (0.2–0.4); clear acceptance high (0.7+).',
    'In balance or renegotiation, confidence must be low even if volatility was high.',
    'Levels must be derived from acceptance/rejection zones, not swing highs/lows.',
    'If the market is balanced, levels should be wide ranges, not precise prices. It is acceptable to leave levels empty when unresolved.',
    'When signals conflict, default to "renegotiation" as the auction state; do not resolve ambiguity unless acceptance is clear and sustained.',
    'Output JSON ONLY. Do not include markdown, code fences, or commentary.',
    'Never claim orderbook, delta, or trade-flow signals unless explicitly provided. If not provided, state uncertainty.',
    'If only OHLCV is available, explicitly mention uncertainty or limitations in the text field.',
    'Put scenarios in summary.details and invalidate_if items in summary.invalidate_if.',
    'Use the schema exactly:',
    '{',
    '  "state": { "auction": string, "confidence": number(0..1) },',
    '  "levels": { "overheadSupply": number[][], "support": number[][] },',
    '  "events": [ { "type": string, "t": number, "severity": number(0..1) } ],',
    '  "summary": { "one_liner": string, "details": string[], "invalidate_if": string[] },',
    '  "text": string',
    '}',
  ].join('\n');

  return [
    instructions,
    formatSection('FEATURE_REPORT', report),
    formatSection('CANDLES_TAIL', candlesTail),
    formatSection('PREFERENCES', preferences ?? {}),
    `MISSING_EXTRAS: ${extrasMissing.join(', ') || 'none'}`,
    `ONLY_OHLCV: ${hasOnlyOhlcv}`,
  ].join('\n\n');
}

export function buildFixPrompt(rawOutput: string, errors: string): string {
  return [
    'Fix the JSON output to match the schema. Output JSON ONLY.',
    'Schema:',
    '{',
    '  "state": { "auction": string, "confidence": number(0..1) },',
    '  "levels": { "overheadSupply": number[][], "support": number[][] },',
    '  "events": [ { "type": string, "t": number, "severity": number(0..1) } ],',
    '  "summary": { "one_liner": string, "details": string[], "invalidate_if": string[] },',
    '  "text": string',
    '}',
    `Errors: ${errors}`,
    `Original output: ${rawOutput}`,
  ].join('\n');
}

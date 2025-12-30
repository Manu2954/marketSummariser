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
    'You are a market analyst summarizing auction-style market structure from OHLCV data.',
    'Tone: brutally direct, unfiltered, and challenging. No fluff, no validation.',
    'Pressure-test the evidence: call out weak signals, blind spots, and uncertainty explicitly.',
    'If signals conflict or are thin, say so and state the opportunity cost or risk of acting on them.',
    'Do not speculate about user intent or personal context; keep it strictly market-focused.',
    'Make the response detailed and structured: include sections for Auction, Volume, Liquidity, Options, Checklist, and Final.',
    'In text, use short lines separated by newlines; include at least 8 lines.',
    'Output JSON ONLY. Do not include markdown, code fences, or commentary.',
    'Never claim orderbook, delta, or trade-flow signals unless explicitly provided. If not provided, state uncertainty.',
    'If only OHLCV is available, explicitly mention uncertainty or limitations in the text field.',
    'Include auction state, volume behavior, liquidity inference, key levels, scenarios, invalidation, and confidence.',
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

import type { z } from 'zod';
import {
  candleSchema,
  featureEventSchema,
  featureLevelsSchema,
  featureMetaSchema,
  featureQualityFlagsSchema,
  featureReportSchema,
  featureStateSchema,
  featureStatsSchema,
  featureValueSchema,
  llmSummarySchema,
  marketSummaryInputSchema,
  marketSummaryRequestSchema,
  preferencesSchema,
} from './schemas.js';

export type Candle = z.infer<typeof candleSchema>;
export type OhlcvCandle = Candle;

export type MarketSummaryPreferences = z.infer<typeof preferencesSchema>;
export type MarketSummaryInput = z.infer<typeof marketSummaryInputSchema>;
export type MarketSummaryRequest = z.infer<typeof marketSummaryRequestSchema>;

export type FeatureMeta = z.infer<typeof featureMetaSchema>;
export type FeatureStats = z.infer<typeof featureStatsSchema>;
export type FeatureState = z.infer<typeof featureStateSchema>;
export type FeatureValue = z.infer<typeof featureValueSchema>;
export type FeatureLevels = z.infer<typeof featureLevelsSchema>;
export type FeatureEvent = z.infer<typeof featureEventSchema>;
export type FeatureQualityFlags = z.infer<typeof featureQualityFlagsSchema>;
export type FeatureReport = z.infer<typeof featureReportSchema>;

export type LlmSummary = z.infer<typeof llmSummarySchema>;

export type OhlcvStats = {
  firstOpen: number;
  lastClose: number;
  high: number;
  low: number;
  change: number;
  changePct: number;
};

export type VolumeStats = {
  total: number;
  average: number;
  max: number;
  last: number;
};

export type AuctionFeatures = {
  vwap: number;
  lastCloseVsVwap: number;
};

export type LiquidityFeatures = {
  averageRange: number;
  lastRange: number;
  rangePct: number;
};

export type SummaryResult = {
  llmSummary: LlmSummary;
  text: string;
};

export type MarketSummaryResponse = {
  featureReport: FeatureReport;
  llmSummary: LlmSummary;
  text: string;
  candles: Candle[];
};

export type TakerLongShortRatio = {
  timestamp: number;
  buySellRatio: number;
  buyVol: number;
  sellVol: number;
};

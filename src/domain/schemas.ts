import { z } from 'zod';

const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.nonnegative();
const zeroToOne = z.number().min(0).max(1);

export const candleExtraKeySchema = z.enum(['n', 'tbv', 'tqv', 'qv']);

export const candleSchema = z
  .object({
    t: z.number().int().nonnegative(),
    o: finiteNumber,
    h: finiteNumber,
    l: finiteNumber,
    c: finiteNumber,
    v: nonNegativeNumber,
    n: z.number().int().nonnegative().optional(),
    tbv: nonNegativeNumber.optional(),
    tqv: nonNegativeNumber.optional(),
    qv: nonNegativeNumber.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.h < value.l) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'h must be >= l',
        path: ['h'],
      });
    }
    if (value.o < value.l || value.o > value.h) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'o must be between l and h',
        path: ['o'],
      });
    }
    if (value.c < value.l || value.c > value.h) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'c must be between l and h',
        path: ['c'],
      });
    }
  });

export const candlesSchema = z.array(candleSchema).min(20);

export const preferencesSchema = z
  .object({
    style: z.enum(['auction_pro', 'simple']).optional(),
    length: z.enum(['short', 'medium', 'long']).optional(),
    includeLevels: z.boolean().optional(),
  })
  .strict();

export const marketSummaryRequestSchema = z
  .object({
    symbol: z.string().min(1),
    timeframe: z.string().min(1),
    candles: candlesSchema,
    preferences: preferencesSchema.optional(),
  })
  .strict();

export const marketSummaryInputSchema = z
  .object({
    symbol: z.string().min(1),
    timeframe: z.string().min(1),
    candles: candlesSchema.optional(),
    startTime: z.number().int().nonnegative().optional(),
    endTime: z.number().int().nonnegative().optional(),
    preferences: preferencesSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasCandles = value.candles !== undefined;
    const startTime = value.startTime;
    const endTime = value.endTime;
    const hasStart = startTime !== undefined;
    const hasEnd = endTime !== undefined;
    const hasTimes = hasStart || hasEnd;

    if (hasCandles && hasTimes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either candles or startTime/endTime, not both.',
      });
    }

    if (!hasCandles && !hasTimes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide candles or startTime/endTime to fetch candles.',
      });
    }

    if (hasTimes && (!hasStart || !hasEnd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Both startTime and endTime are required.',
      });
    }

    if (hasStart && hasEnd && endTime <= startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be greater than startTime.',
        path: ['endTime'],
      });
    }
  });

export const zoneSchema = z
  .tuple([finiteNumber, finiteNumber])
  .superRefine((value, ctx) => {
    if (value[0] > value[1]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'zone low must be <= zone high',
        path: [0],
      });
    }
  });

export const featureMetaSchema = z
  .object({
    symbol: z.string().min(1),
    timeframe: z.string().min(1),
    n: z.number().int().nonnegative(),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  })
  .strict();

export const featureStatsSchema = z
  .object({
    sessionReturnPct: finiteNumber,
    rangePct: finiteNumber,
    avgRange: finiteNumber,
    atrLike: finiteNumber,
    avgVolume: finiteNumber,
    volumeP95: finiteNumber,
  })
  .strict();

export const featureStateSchema = z
  .object({
    regime: z.enum(['balance', 'imbalance_up', 'imbalance_down']),
    balanceScore: z.number().min(0).max(100),
    trendEfficiencyScore: z.number().min(0).max(100),
    volatilityExpansionScore: z.number().min(0).max(100),
    confidence: zeroToOne,
  })
  .strict();

export const featureValueSchema = z
  .object({
    vwap: finiteNumber.nullable(),
    vwapSlope: finiteNumber,
    valueMigration: z.enum(['up', 'down', 'flat']),
    closeClusterZones: z.array(zoneSchema),
  })
  .strict();

export const featureLevelsSchema = z
  .object({
    overheadSupply: z.array(zoneSchema),
    supportZones: z.array(zoneSchema),
    rejectionZones: z.array(zoneSchema),
  })
  .strict();

export const featureEventSchema = z
  .object({
    type: z.string().min(1),
    t: z.number().int().nonnegative(),
    severity: zeroToOne,
    context: z.record(z.unknown()),
  })
  .strict();

export const featureQualityFlagsSchema = z
  .object({
    missingExtras: z.array(candleExtraKeySchema),
    notes: z.array(z.string().min(1)),
  })
  .strict();

export const featureReportSchema = z
  .object({
    meta: featureMetaSchema,
    stats: featureStatsSchema,
    state: featureStateSchema,
    value: featureValueSchema,
    levels: featureLevelsSchema,
    events: z.array(featureEventSchema),
    qualityFlags: featureQualityFlagsSchema,
  })
  .strict();

export const llmSummarySchema = z
  .object({
    state: z
      .object({
        auction: z
          .string()
          .min(1)
          .describe('Single-phrase auction state (e.g., balance after failed initiative)'),
        confidence: zeroToOne.describe('Acceptance strength, not directional conviction'),
      })
      .strict(),
    levels: z
      .object({
        overheadSupply: z.array(zoneSchema).default([]),
        support: z.array(zoneSchema).default([]),
      })
      .partial()
      .default({ overheadSupply: [], support: [] }),
    events: z
      .array(
        z
          .object({
            type: z.string().min(1),
            t: z.number().int().nonnegative(),
            severity: zeroToOne,
          })
        .strict(),
      )
      .default([]),
    summary: z
      .object({
        one_liner: z.string().min(1),
        details: z.array(z.string().min(1)).default([]),
        invalidate_if: z.array(z.string().min(1)).default([]),
      })
      .strict(),
    text: z.string().min(1),
  })
  .strict();

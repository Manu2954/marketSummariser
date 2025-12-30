import { z } from 'zod';

const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.nonnegative();

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

export const summaryRequestSchema = z
  .object({
    symbol: z.string().min(1),
    timeframe: z.string().min(1),
    startTime: z.number().int().nonnegative(),
    endTime: z.number().int().nonnegative(),
    preferences: z
      .object({
        style: z.enum(['auction_pro', 'simple']).optional(),
        length: z.enum(['short', 'medium', 'long']).optional(),
        includeLevels: z.boolean().optional(),
      })
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.endTime <= value.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be greater than startTime.',
        path: ['endTime'],
      });
    }
  });

export type Candle = z.infer<typeof candleSchema>;
export type SummaryRequest = z.infer<typeof summaryRequestSchema>;

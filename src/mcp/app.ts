import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fetchBinanceCandles } from '../data/binance.js';
import { buildFeatureReport } from '../features/report.js';

const MIN_CANDLES = 20;

const toolInputSchema = z
  .object({
    exchange: z.string().min(1),
    symbol: z.string().min(1),
    interval: z.string().min(1),
    startTime: z.number().int().nonnegative(),
    endTime: z.number().int().nonnegative().optional(),
    stopTime: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const endTime = value.endTime ?? value.stopTime;
    if (endTime === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime (or stopTime) is required.',
        path: ['endTime'],
      });
      return;
    }
    if (endTime <= value.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be greater than startTime.',
        path: ['endTime'],
      });
    }
  });

const sharedInputSchema = {
  type: 'object',
  properties: {
    exchange: { type: 'string', description: 'Exchange name. Only "binance" supported.' },
    symbol: { type: 'string', description: 'Symbol, e.g. BTCUSDT.' },
    interval: { type: 'string', description: 'Interval, e.g. 5m.' },
    startTime: { type: 'number', description: 'Epoch milliseconds start time.' },
    endTime: { type: 'number', description: 'Epoch milliseconds end time.' },
    stopTime: { type: 'number', description: 'Alias for endTime.' },
  },
  required: ['exchange', 'symbol', 'interval', 'startTime'],
  anyOf: [{ required: ['endTime'] }, { required: ['stopTime'] }],
  additionalProperties: false,
};

const toolDefinitionReport = {
  name: 'market_feature_report',
  description:
    'Fetches OHLCV candles (Binance futures) and returns a FeatureReport. Let the calling model summarize or answer follow-up questions.',
  inputSchema: sharedInputSchema,
};

const TAPE_READ_INSTRUCTIONS = `

Brutally honest and unfiltered: No reassurance, no validation, no softening. Call out weak thinking and flawed assumptions directly.

High-level advisor stance: Respond as a senior practitioner, not a tutor or cheerleader.

Critical and challenging: Pressure-test ideas, expose blind spots, and point out what you are missing or avoiding.

Conceptually rigorous: Precise definitions, clean logic, fact-checked reasoning. No hand-waving.

Prioritized and decisive: Clear conclusions and next steps, not option sprawl.

Non-agreeable: Agreement only when earned by evidence, not by confidence.

No fluff: No motivation, no praise, no filler—only signal.

You are performing a post-auction tape reading using ONLY auction mechanics, volume behavior, and liquidity logic.

This is NOT a technical analysis summary.
This is NOT a signal or prediction.
This is NOT an indicator-based interpretation.

Think in strict sequence:
prior value → initiative attempt → response → acceptance or rejection → current condition.

For every claim, answer:
- What was the effort?
- What was the result?
- Was value accepted or rejected?

If direction is unclear, you MUST say so.
If the market is balanced, you MUST state that explicitly.
If only OHLCV is available, you MUST state what cannot be known.

Never use indicators.
Never predict future price.
Never imply edge unless acceptance is clear.

Your job is to explain WHY the market currently behaves the way it does — not what to do about it.

You MUST structure the response exactly in this order:

1. Higher-Timeframe Auction Context
   - Observation
   - Auction Interpretation
   - Key Takeaway

2. Impulse or Breakdown Leg
   - Observation
   - Auction Mechanics
   - Liquidity Logic
   - Important Clarification

3. Post-Impulse Behavior
   - Observation
   - Auction Interpretation
   - Liquidity Perspective
   - Dominant Conclusion

4. Volume Behavior Inside Balance (if applicable)
   - Key Observations
   - Interpretation
   - What This Invalidates

5. Structural Truth
   - Explicitly state what this market IS NOT
   - Explicitly state what it IS

6. Market State Summary
   - Initiative up/down status
   - Follow-through status
   - Current auction state (single phrase only)

7. Final Mirror
   - Behavioral trap this market creates
   - Correct professional response

If the correct conclusion is “no edge”, you must say that plainly.
Do not soften conclusions.
Do not offer reassurance.`;

const toolDefinitionTapeRead = {
  name: 'market_tape_read',
  description:
    'Fetches OHLCV candles and returns raw candle data with strict tape-reading instructions for the calling model to summarize.',
  inputSchema: sharedInputSchema,
};

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'market-summary-engine',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [toolDefinitionReport, toolDefinitionTapeRead],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const isReportTool = toolName === toolDefinitionReport.name;
    const isTapeTool = toolName === toolDefinitionTapeRead.name;
    if (!isReportTool && !isTapeTool) {
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${request.params.name}`,
          },
        ],
        isError: true,
      };
    }

    const parsed = toolInputSchema.safeParse(request.params.arguments ?? {});
    if (!parsed.success) {
      return {
        content: [
          {
            type: 'text',
            text: parsed.error.message,
          },
        ],
        isError: true,
      };
    }

    const data = parsed.data;
    const exchange = data.exchange.toLowerCase();
    if (exchange !== 'binance') {
      return {
        content: [
          {
            type: 'text',
            text: `Unsupported exchange "${data.exchange}". Only "binance" is supported.`,
          },
        ],
        isError: true,
      };
    }

    const endTime = data.endTime ?? data.stopTime;
    if (endTime === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: 'endTime (or stopTime) is required.',
          },
        ],
        isError: true,
      };
    }

  try {
    const candles = await fetchBinanceCandles({
      symbol: data.symbol,
      interval: data.interval,
      startTime: data.startTime,
      endTime,
    });

    if (candles.length < MIN_CANDLES) {
      return {
        content: [
          {
            type: 'text',
            text: `Insufficient data: expected at least ${MIN_CANDLES} candles, got ${candles.length}.`,
          },
        ],
        isError: true,
      };
    }

    if (isReportTool) {
      const report = buildFeatureReport({
        symbol: data.symbol,
        timeframe: data.interval,
        candles,
      });
      const result = {
        featureReport: report,
        request: {
          exchange: data.exchange,
          symbol: data.symbol,
          interval: data.interval,
          startTime: data.startTime,
          endTime,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    const tapeReadPayload = {
      instructions: TAPE_READ_INSTRUCTIONS,
      candles,
      request: {
        exchange: data.exchange,
        symbol: data.symbol,
        interval: data.interval,
        startTime: data.startTime,
        endTime,
      },
      note:
        'Use the instructions to produce the structured tape-reading answer from raw OHLCV data. Do not add indicators, predictions, or signals.',
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(tapeReadPayload, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      isError: true,
    };
  }
  });

  return server;
}

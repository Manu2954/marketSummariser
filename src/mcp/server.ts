import 'dotenv/config';
import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fetchBinanceCandles } from '../data/binance.js';
import { buildFeatureReport } from '../features/report.js';
import { summarizeDeterministic } from '../llm/summarize.js';

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

const toolDefinition = {
  name: 'market_summary',
  description:
    'Fetches OHLCV candles for a time range and returns a FeatureReport plus deterministic summary.',
  inputSchema: {
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
  },
};

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
  tools: [toolDefinition],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== toolDefinition.name) {
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

    const report = buildFeatureReport({
      symbol: data.symbol,
      timeframe: data.interval,
      candles,
    });
    const summary = summarizeDeterministic(report);
    const result = {
      featureReport: report,
      llmSummary: summary.llmSummary,
      text: summary.text,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
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

async function runServer() {
  console.error('Starting MCP server...');
  
  const transport = new StdioServerTransport();
  
  console.error('Connecting server to transport...');
  await server.connect(transport);
  
  console.error('MCP server running on stdio');
  
  // Keep the process alive by reading from stdin
  process.stdin.resume();
  
  // Handle errors on the transport
  transport.onclose = () => {
    console.error('Transport closed');
  };
  
  transport.onerror = (error) => {
    console.error('Transport error:', error);
  };
}

// Run the server
runServer().catch((error) => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});

// Handle process signals
process.on('SIGINT', () => {
  console.error('Received SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM');
  process.exit(0);
});

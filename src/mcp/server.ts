import 'dotenv/config';
import { startSseServer } from './sseServer.js';
import { createMcpServer } from './app.js';

function start() {
  const port = Number(process.env.PORT ?? process.env.MCP_PORT ?? 3000);
  const ssePath = process.env.MCP_SSE_PATH ?? '/sse';
  const messagePath = process.env.MCP_POST_PATH ?? '/message';
  const apiKey = process.env.MCP_API_KEY;

  startSseServer({
    port,
    ssePath,
    messagePath,
    apiKey,
    createMcpServer,
  });
}

try {
  start();
} catch (error) {
  console.error('Fatal error starting MCP server:', error);
  process.exit(1);
}

process.on('SIGINT', () => {
  console.error('Received SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM');
  process.exit(0);
});

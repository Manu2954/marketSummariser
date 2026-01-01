import { createServer as createHttpServer } from 'node:http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';

type StartOptions = {
  port: number;
  ssePath?: string;
  messagePath?: string;
  apiKey?: string;
  createMcpServer: () => McpServer;
};

type ActiveSession = {
  transport: SSEServerTransport;
  server: McpServer;
};

// Hosts the MCP server over SSE + POST. Creates a fresh MCP server per SSE connection.
export function startSseServer(options: StartOptions) {
  const {
    port,
    ssePath = '/sse',
    messagePath = '/message',
    apiKey,
    createMcpServer,
  } = options;

  let activeSession: ActiveSession | null = null;

  const httpServer = createHttpServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400).end('Missing URL');
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    const isAuthorized = (): boolean => {
      if (!apiKey) return true;
      const provided = Array.isArray(req.headers['x-api-key'])
        ? req.headers['x-api-key'][0]
        : req.headers['x-api-key'];
      const ok = provided === apiKey;
      if (!ok) {
        res.writeHead(401).end('Unauthorized');
      }
      return ok;
    };

    if (req.method === 'GET' && url.pathname === ssePath) {
      if (!isAuthorized()) return;

      // Only allow one active connection; close the previous one if present.
      if (activeSession) {
        await activeSession.transport.close().catch(() => undefined);
        activeSession = null;
      }

      const server = createMcpServer();
      const transport = new SSEServerTransport(messagePath, res);
      activeSession = { transport, server };

      transport.onclose = () => {
        if (activeSession?.transport === transport) {
          activeSession = null;
        }
        console.error('SSE transport closed');
      };

      transport.onerror = (error) => {
        console.error('Transport error:', error);
      };

      console.error(
        `New SSE connection. POST endpoint: ${messagePath}?sessionId=${transport.sessionId}`,
      );

      await server.connect(transport);
      return;
    }

    if (req.method === 'POST' && url.pathname === messagePath) {
      if (!isAuthorized()) return;
      if (!activeSession) {
        res.writeHead(503).end('No active SSE session.');
        return;
      }
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId || sessionId !== activeSession.transport.sessionId) {
        res.writeHead(404).end('Unknown session.');
        return;
      }
      await activeSession.transport.handlePostMessage(req, res);
      return;
    }

    res.writeHead(404).end('Not found');
  });

  httpServer.listen(port, () => {
    console.error(`MCP SSE server running: GET ${ssePath}, POST ${messagePath}, port ${port}`);
  });

  return httpServer;
}

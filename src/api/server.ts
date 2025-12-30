import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pathToFileURL } from 'node:url';
import { initDb } from '../store/db.js';
import { summaryRoutes } from './routes/summary.js';

type ServerOptions = {
  logger?: boolean;
  dbPath?: string;
};

export function buildServer(options: ServerOptions = {}) {
  const loggerEnabled =
    options.logger ?? (process.env.NODE_ENV === 'test' ? false : true);
  const app = Fastify({ logger: loggerEnabled });
  const db = initDb(options.dbPath);

  app.register(cors, {
    origin: true,
  });

  app.get('/health', async () => ({ ok: true }));
  summaryRoutes(app, { db });
  app.addHook('onClose', async () => {
    db.close();
  });

  return app;
}

async function startServer() {
  const app = buildServer();
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen({ port, host });
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

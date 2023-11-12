import 'dotenv/config.js';

import fastify from 'fastify';

import { logger } from './logger.js';
import { q } from './queue.js';

const app = fastify();

app.get('/health', async (req, reply) => {
  return reply.status(200).send({ responseTime: reply.getResponseTime() });
});

app.put<{ Params: { id: string; hash: string } }>('/refetch/:id/:hash', async (req, reply) => {
  if (req.headers.authorization !== process.env.ACCESS_KEY) return reply.status(401).send({ error: 'Unauthorized' });
  q.push({ id: req.params.id, hash: req.params.hash });
  return reply.status(200).send({ ok: true });
});

app.listen(
  {
    port: process.env.PORT ? parseInt(process.env.PORT) : 7697,
    host: process.env.HOST || 'localhost'
  },
  (err, address) => {
    if (err) {
      logger.error(err);
      process.exit(1);
    }

    logger.info(`Serving at ${address} (${process.env.NODE_ENV})`);
    if (process.send && process.env.PM2_USAGE) process.send('ready');
  }
);

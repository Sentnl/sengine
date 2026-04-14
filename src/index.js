import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { setupRoutes } from './routes.js';
import { setupDatabase } from './models/db.js';
import { startMonitoring } from './services/monitoringService.js';

dotenv.config();

const fastify = Fastify({
  logger: process.env.LOG_LEVEL ? { level: process.env.LOG_LEVEL } : true,
  disableRequestLogging: true,
});

fastify.register(cors, {
  origin: true
});

setupRoutes(fastify);

const start = async () => {
  try {
    await setupDatabase();
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    await fastify.listen({ port: process.env.PORT || 3000, host });
    startMonitoring();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

import { buildApp } from './app.js';
import { env } from './app/config/env.js';
import { logger } from './app/config/logger.js';
import { connectMongo, disconnectMongo } from './app/db/mongoose.js';
import { seedSearchProfile } from './app/modules/search-profile/service.js';
process.on('unhandledRejection', (e) => logger.fatal({ err: e }, 'unhandled rejection'));
process.on('uncaughtException', (e) => {
  logger.fatal({ err: e }, 'uncaught exception');
  process.exit(1);
});
await connectMongo();
await seedSearchProfile();
const server = buildApp().listen(env.PORT, env.HOST, () =>
  logger.info({ host: env.HOST, port: env.PORT }, 'api listening'),
);
const shutdown = async () => {
  server.close();
  await disconnectMongo();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

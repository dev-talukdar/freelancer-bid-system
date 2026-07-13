import { buildApp } from './app.js';
import { env } from './app/config/env.js';
import { logger } from './app/config/logger.js';
import { connectMongo, disconnectMongo } from './app/db/mongoose.js';
import {
  clearLegacyDefaultCountryFilters,
  seedSearchProfile,
} from './app/modules/search-profile/service.js';
import { monitor } from './app/modules/project-monitor/service.js';
process.on('unhandledRejection', (e) => logger.fatal({ err: e }, 'unhandled rejection'));
process.on('uncaughtException', (e) => {
  logger.fatal({ err: e }, 'uncaught exception');
  process.exit(1);
});
await connectMongo();
await seedSearchProfile();
await clearLegacyDefaultCountryFilters();
monitor.start();
const server = buildApp().listen(env.PORT, env.HOST, () => {
  console.log(`Server is running on port ${env.PORT}`);
});

const shutdown = async () => {
  monitor.stop();
  server.close();
  await disconnectMongo();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

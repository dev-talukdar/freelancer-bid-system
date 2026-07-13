import { buildApp } from './app.js';
import { env } from './app/config/env.js';
import { logger } from './app/config/logger.js';
import { connectMongo, disconnectMongo } from './app/db/mongoose.js';
import {
  seedSearchProfile,
  syncActiveProfileTargetCountryCodes,
  syncActiveProfileTargetCurrencies,
} from './app/modules/search-profile/service.js';
import { monitor } from './app/modules/project-monitor/service.js';

const bootstrap = async (): Promise<void> => {
  await connectMongo();
  await seedSearchProfile();
  await syncActiveProfileTargetCountryCodes();
  await syncActiveProfileTargetCurrencies();

  const server = buildApp().listen(env.PORT, env.HOST, () => {
    logger.info({ host: env.HOST, port: env.PORT }, 'api listening');
    console.log(`Server is running on port ${env.PORT}`);
    monitor.start();
  });

  server.keepAliveTimeout = 5_000;
  server.requestTimeout = 15_000;
  server.headersTimeout = 20_000;

  server.on('clientError', (error, socket) => {
    logger.error({ err: error }, 'http client error');

    if (!socket.destroyed) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown started');
    monitor.stop();

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await disconnectMongo();
    logger.info('shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

process.on('unhandledRejection', (e) => logger.fatal({ err: e }, 'unhandled rejection'));
process.on('uncaughtException', (e) => {
  logger.fatal({ err: e }, 'uncaught exception');
  process.exit(1);
});

void bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'server bootstrap failed');
  process.exit(1);
});

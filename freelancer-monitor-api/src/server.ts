import { buildApp } from './app.js';
import { env } from './app/config/env.js';
import { logger } from './app/config/logger.js';
import { connectMongo, disconnectMongo } from './app/db/mongoose.js';
import { seedSearchProfile } from './app/modules/search-profile/service.js';
import { validateFreelancerAllowlists } from './app/modules/freelancer-client/allowlists.js';
import { monitor } from './app/modules/project-monitor/service.js';

process.on('unhandledRejection', (error) => {
  logger.fatal({ err: error }, 'unhandled rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  process.exit(1);
});

let server: ReturnType<ReturnType<typeof buildApp>['listen']> | undefined;

const bootstrap = async (): Promise<void> => {
  try {
    logger.info(
      {
        host: env.HOST,
        port: env.PORT,
      },
      'starting api',
    );

    logger.info('validating Freelancer allowlists');
    validateFreelancerAllowlists();
    logger.info('Freelancer allowlists validated');

    logger.info('connecting to MongoDB');
    await connectMongo();
    logger.info('MongoDB connected');

    logger.info('seeding search profile');
    await seedSearchProfile();
    logger.info('search profile seeded');

    logger.info('starting project monitor');
    monitor.start();
    logger.info('project monitor started');

    logger.info('starting HTTP server');

    const app = buildApp();

    server = app.listen(env.PORT, env.HOST, () => {
      logger.info(
        {
          host: env.HOST,
          port: env.PORT,
        },
        'api listening',
      );
    });

    server.on('error', (error) => {
      logger.fatal({ err: error }, 'HTTP server failed');
      process.exit(1);
    });
  } catch (error) {
    logger.fatal({ err: error }, 'API bootstrap failed');

    try {
      monitor.stop();
      await disconnectMongo();
    } catch (cleanupError) {
      logger.error({ err: cleanupError }, 'bootstrap cleanup failed');
    }

    process.exit(1);
  }
};

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutting down API');

  monitor.stop();

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  await disconnectMongo();

  logger.info('API shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void bootstrap();
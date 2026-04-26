import { type LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';

import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';

import bytes from 'bytes';
import { useContainer } from 'class-validator';
import session from 'express-session';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import { isDefined } from 'twenty-shared/utils';

import { NodeEnvironment } from 'src/engine/core-modules/twenty-config/interfaces/node-environment.interface';

import { setPgDateTypeParser } from 'src/database/pg/set-pg-date-type-parser';
import { LoggerService } from 'src/engine/core-modules/logger/logger.service';
import { getSessionStorageOptions } from 'src/engine/core-modules/session-storage/session-storage.module-factory';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UnhandledExceptionFilter } from 'src/filters/unhandled-exception.filter';

import { AppModule } from './app.module';
import './instrument';

import { settings } from './engine/constants/settings';
import { generateFrontConfig } from './utils/generate-front-config';

const ALLOWED_CORS_METHODS = [
  'GET',
  'HEAD',
  'PUT',
  'PATCH',
  'POST',
  'DELETE',
  'OPTIONS',
];

const ALLOWED_CORS_HEADERS = [
  'Origin',
  'X-Requested-With',
  'Content-Type',
  'Accept',
  'Authorization',
  'x-locale',
  'X-Schema-Version',
  'X-App-Version',
  'apollo-require-preflight',
  'x-apollo-operation-name',
];

const getAllowedCorsOrigins = (twentyConfigService: TwentyConfigService) =>
  [
    twentyConfigService.get('FRONTEND_URL'),
    twentyConfigService.get('SERVER_URL'),
  ]
    .filter(isDefined)
    .map((url) => new URL(url).origin);

const isAllowedCorsOrigin = (
  requestOrigin: string,
  allowedOrigins: string[],
): boolean => allowedOrigins.includes(new URL(requestOrigin).origin);

const buildAccessControlAllowHeadersValue = (
  request: Pick<Request, 'headers'>,
): string => {
  const requestedRaw = request.headers['access-control-request-headers'];
  const requestedParts =
    typeof requestedRaw === 'string' && requestedRaw.length > 0
      ? requestedRaw
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
      : [];

  const byLowerCase = new Map<string, string>();

  for (const allowed of ALLOWED_CORS_HEADERS) {
    byLowerCase.set(allowed.toLowerCase(), allowed);
  }

  for (const requested of requestedParts) {
    const lower = requested.toLowerCase();

    if (!byLowerCase.has(lower)) {
      byLowerCase.set(lower, requested);
    }
  }

  return [...byLowerCase.values()].join(', ');
};

const applyCorsHeaders = (
  request: Pick<Request, 'headers'>,
  response: Response,
  requestOrigin: string,
) => {
  response.header('Access-Control-Allow-Origin', requestOrigin);
  response.header('Access-Control-Allow-Credentials', 'true');
  response.header(
    'Access-Control-Allow-Methods',
    ALLOWED_CORS_METHODS.join(', '),
  );
  response.header(
    'Access-Control-Allow-Headers',
    buildAccessControlAllowHeadersValue(request),
  );
  response.header('Vary', 'Origin');
};

const getNestBootstrapLogLevels = (): LogLevel[] | undefined => {
  if (process.env.NODE_ENV !== NodeEnvironment.PRODUCTION) {
    return undefined;
  }

  // Reduce noisy startup logs in production to avoid provider log throttling.
  return ['error', 'warn'];
};

const getServerPort = (configuredPort: number): number => {
  const railwayPort = Number(process.env.PORT);

  if (!Number.isNaN(railwayPort) && railwayPort > 0) {
    return railwayPort;
  }

  return configuredPort;
};

const SERVER_HOST = '0.0.0.0';

// Trigger
const bootstrap = async () => {
  setPgDateTypeParser();

  console.log(
    `[${new Date().toISOString()}] [bootstrap] BEFORE NestFactory.create()`,
  );

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: getNestBootstrapLogLevels(),
    bufferLogs: process.env.LOGGER_IS_BUFFER_ENABLED === 'true',
    rawBody: true,
    snapshot: process.env.NODE_ENV === NodeEnvironment.DEVELOPMENT,
    ...(process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH
      ? {
          httpsOptions: {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH),
          },
        }
      : {}),
  });

  console.log(
    `[${new Date().toISOString()}] [bootstrap] AFTER NestFactory.create() — AppModule initialized`,
  );

  const logger = app.get(LoggerService);
  const twentyConfigService = app.get(TwentyConfigService);
  const allowedCorsOrigins = getAllowedCorsOrigins(twentyConfigService);

  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestOrigin = request.headers.origin;

    if (
      isDefined(requestOrigin) &&
      isAllowedCorsOrigin(requestOrigin, allowedCorsOrigins)
    ) {
      applyCorsHeaders(request, response, requestOrigin);

      if (request.method === 'OPTIONS') {
        response.sendStatus(204);

        return;
      }
    }

    next();
  });

  app.use(session(getSessionStorageOptions(twentyConfigService)));

  // Apply class-validator container so that we can use injection in validators
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Use our logger
  app.useLogger(logger);

  console.log(
    `[${new Date().toISOString()}] [bootstrap] AFTER app.useLogger()`,
  );

  app.useGlobalFilters(new UnhandledExceptionFilter());

  app.useBodyParser('json', { limit: settings.storage.maxFileSize });
  app.useBodyParser('urlencoded', {
    limit: settings.storage.maxFileSize,
    extended: true,
  });

  // Graphql file upload
  app.use(
    '/graphql',
    graphqlUploadExpress({
      maxFieldSize: bytes(settings.storage.maxFileSize)!,
      maxFiles: 10,
    }),
  );

  app.use(
    '/metadata',
    graphqlUploadExpress({
      maxFieldSize: bytes(settings.storage.maxFileSize)!,
      maxFiles: 10,
    }),
  );

  // Inject the server url in the frontend page
  generateFrontConfig();

  console.log(
    `[${new Date().toISOString()}] [bootstrap] AFTER all middleware/filters applied`,
  );

  const serverPort = getServerPort(twentyConfigService.get('NODE_PORT'));

  console.log(
    `[${new Date().toISOString()}] [bootstrap] BEFORE app.listen() on ${SERVER_HOST}:${serverPort}`,
  );

  await app.listen(serverPort, SERVER_HOST);

  console.log(
    `[${new Date().toISOString()}] [bootstrap] AFTER app.listen() — server is now accepting connections`,
  );
};

bootstrap();

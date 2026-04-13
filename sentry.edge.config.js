// sentry.edge.config.js
// Configuration Sentry Edge Runtime
// Next.js 16 - E-commerce Djibouti
// Activé si middleware Edge ou Edge API routes sont utilisés

import * as Sentry from '@sentry/nextjs';

const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProduction = process.env.NODE_ENV === 'production';

function isValidDSN(dsn) {
  if (!dsn) return false;
  return /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
}

if (sentryDSN && isValidDSN(sentryDSN)) {
  Sentry.init({
    dsn: sentryDSN,
    environment: process.env.NODE_ENV || 'development',
    enabled: isProduction,
    debug: !isProduction,

    // Erreurs uniquement — pas de performance
    tracesSampleRate: 0,

    ignoreErrors: [
      'NEXT_REDIRECT',
      'NEXT_NOT_FOUND',
    ],

    beforeSend(event) {
      // Filtrage minimal côté edge
      if (event.request?.headers) {
        delete event.request.headers.cookie;
        delete event.request.headers.authorization;
      }

      event.tags = {
        ...event.tags,
        project: 'benew-client',
        runtime: 'edge',
        country: 'DJ',
        app_type: 'ecommerce',
      };

      return event;
    },
  });
}

// sentry.server.config.js
// Configuration Sentry Serveur (Node.js)
// Next.js 16 + PostgreSQL + Cloudinary + Resend
// E-commerce Djibouti - 500 utilisateurs/jour
// ERREURS UNIQUEMENT - Pas de logs ni performance

import * as Sentry from '@sentry/nextjs';
import {
  containsSensitiveData,
  filterMessage,
  categorizeError,
  anonymizeUserData,
  anonymizeUrl,
  anonymizeHeaders,
  filterRequestBody,
} from './utils/sentry-utils.js';

// =============================================
// VALIDATION CONFIGURATION
// =============================================

function isValidDSN(dsn) {
  if (!dsn) return false;
  return /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
}

const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

// =============================================
// INITIALISATION SENTRY SERVEUR
// =============================================

if (sentryDSN && isValidDSN(sentryDSN)) {
  Sentry.init({
    dsn: sentryDSN,
    environment,
    release:
      process.env.SENTRY_RELEASE ||
      '1.0.0',

    // ✅ Debug et activation
    debug: !isProduction,
    enabled: isProduction,

    // ===== ERREURS UNIQUEMENT (500 users/jour) =====
    // Pas de performance monitoring
    tracesSampleRate: 0,
    profilesSampleRate: 0,

    // ✅ CRITIQUE : Pas de logs serveur (économie quota)
    enableLogs: false,

    // Pas de session replay (côté serveur n'a pas de replay anyway)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Intégrations minimales
    integrations: [],

    // ===== ERREURS À IGNORER (SERVEUR) =====
    ignoreErrors: [
      // Erreurs PostgreSQL communes (reconnexion auto)
      'Connection terminated',
      'Client has encountered a connection error',
      'Connection timeout',
      'ENOTFOUND',
      'ECONNABORTED',
      'connection not available',
      'Connection pool timeout',
      'too many clients already',

      // Erreurs Next.js serveur (normales)
      'NEXT_REDIRECT',
      'NEXT_NOT_FOUND',
      'Route cancelled',
      'Dynamic server usage',

      // Erreurs réseau serveur (timeouts normaux)
      'ECONNREFUSED',
      'ECONNRESET',
      'socket hang up',
      'ETIMEDOUT',
      'read ECONNRESET',
      'connect ETIMEDOUT',
      'EHOSTUNREACH',

      // Erreurs Cloudinary serveur (normales)
      /cloudinary.*upload.*failed/i,
      /cloudinary.*resource.*not.*found/i,
      /cloudinary.*invalid.*signature/i,
      /cloudinary.*transformation.*failed/i,
      /cloudinary.*upload.*timeout/i,
      /cloudinary.*rate.*limit/i,

      // Erreurs Resend (service email)
      'Email rate limit exceeded',
      'Invalid email address',
      'Recipient rejected',

      // Erreurs paiement mobile (timeouts normaux)
      'Payment timeout',
      'Transaction pending',
    ],

    // ===== FILTRAGE BREADCRUMBS SERVEUR =====
    beforeBreadcrumb(breadcrumb, hint) {
      // Filtrer les breadcrumbs serveur sensibles
      if (['xhr', 'fetch'].includes(breadcrumb.category) && breadcrumb.data) {
        // Anonymiser URL
        if (breadcrumb.data.url) {
          breadcrumb.data.url = anonymizeUrl(breadcrumb.data.url);
        }

        // Filtrer body
        if (breadcrumb.data.body) {
          breadcrumb.data.body = filterRequestBody(breadcrumb.data.body);
        }

        // Anonymiser headers
        if (breadcrumb.data.response_headers) {
          breadcrumb.data.response_headers = anonymizeHeaders(
            breadcrumb.data.response_headers,
          );
        }

        if (breadcrumb.data.request_headers) {
          breadcrumb.data.request_headers = anonymizeHeaders(
            breadcrumb.data.request_headers,
          );
        }
      }

      // Filtrer les logs serveur sensibles
      if (breadcrumb.category === 'console' && breadcrumb.message) {
        if (containsSensitiveData(breadcrumb.message)) {
          return null;
        }
      }

      return breadcrumb;
    },

    // ===== FILTRAGE ÉVÉNEMENTS SERVEUR =====
    beforeSend(event, hint) {
      const error = hint && hint.originalException;

      // ✅ IMPORTANT : FILTRER LES DONNÉES mais GARDER LES ERREURS
      // Routes critiques checkout/payment : filtrer données MAIS envoyer erreur

      // Routes sensibles : filtrer données mais GARDER erreur
      if (event.request?.url) {
        const url = event.request.url;

        // Checkout/Payment/Order = CRITIQUES pour e-commerce
        if (
          url.includes('/checkout') ||
          url.includes('/payment') ||
          url.includes('/order') ||
          url.includes('/api/contact')
        ) {
          // ✅ FILTRER données sensibles
          if (event.request.data) {
            event.request.data = '[SENSITIVE_DATA_FILTERED]';
          }
          if (event.request.query_string) {
            event.request.query_string = '[FILTERED]';
          }
          if (event.request.cookies) {
            event.request.cookies = '[FILTERED]';
          }

          // ✅ MAIS GARDER L'ERREUR (ne pas return null)
          // Marquer comme sensible
          event.tags = {
            ...event.tags,
            sensitive_route: true,
            data_filtered: true,
          };
        }
      }

      // Catégorisation des erreurs serveur
      if (error) {
        event.tags = event.tags || {};
        event.tags.error_category = categorizeError(error);
        event.tags.runtime = 'nodejs';

        // Tags spécifiques au contexte e-commerce
        if (event.request && event.request.url) {
          const url = event.request.url;

          if (url.includes('/api/')) {
            event.tags.page_type = 'api';

            // Sous-catégories API
            if (url.includes('/api/templates')) {
              event.tags.api_type = 'templates';
              event.tags.page_value = 'high';
            } else if (url.includes('/api/order')) {
              event.tags.api_type = 'order';
              event.tags.page_value = 'critical';
            } else if (url.includes('/api/payment')) {
              event.tags.api_type = 'payment';
              event.tags.page_value = 'critical';
            } else if (url.includes('/api/contact')) {
              event.tags.api_type = 'contact';
              event.tags.page_value = 'medium';
            }
          } else if (url.includes('/blog/')) {
            event.tags.page_type = 'blog';
            event.tags.page_value = 'low';
          } else if (url.includes('/templates/')) {
            event.tags.page_type = 'templates';
            event.tags.page_value = 'high';
          }
        }

        // Tags spécifiques par catégorie d'erreur
        const category = event.tags.error_category;

        if (category === 'database') {
          event.tags.infrastructure = 'postgresql';
          event.tags.severity = 'high';
        } else if (category === 'email_service') {
          event.tags.infrastructure = 'resend'; // ✅ Resend, pas EmailJS
          event.tags.severity = 'medium';
        } else if (category === 'cloudinary') {
          event.tags.infrastructure = 'cloudinary';
          event.tags.severity = 'low';
        } else if (category === 'payment') {
          event.tags.infrastructure = 'mobile_payment';
          event.tags.severity = 'critical'; // Paiements = critique
        }
      }

      // Anonymisation serveur
      if (event.request) {
        // Headers
        if (event.request.headers) {
          event.request.headers = anonymizeHeaders(event.request.headers);
        }

        // Cookies
        if (event.request.cookies) {
          event.request.cookies = '[FILTERED]';
        }

        // URL
        if (event.request.url) {
          event.request.url = anonymizeUrl(event.request.url);
        }

        // Body
        if (event.request.data) {
          event.request.data = filterRequestBody(event.request.data);
        }
      }

      // Utilisateur
      if (event.user) {
        event.user = anonymizeUserData(event.user);
      }

      // Filtrer les messages d'erreur sensibles
      if (event.message && containsSensitiveData(event.message)) {
        event.message = filterMessage(event.message);
      }

      // Exception avec message sensible
      if (
        event.exception &&
        event.exception.values &&
        event.exception.values[0]
      ) {
        const exceptionValue = event.exception.values[0];
        if (
          exceptionValue.value &&
          containsSensitiveData(exceptionValue.value)
        ) {
          exceptionValue.value = filterMessage(exceptionValue.value);
        }
      }

      // Tags globaux serveur
      event.tags = {
        ...event.tags,
        project: 'benew-ecommerce',
        stack: 'nextjs16-postgres-cloudinary-resend',
        runtime: 'nodejs',
        country: 'DJ', // Djibouti
        app_type: 'ecommerce',
      };

      return event;
    },
  });

  console.log(
    '✅ Sentry server initialized successfully (errors only, no logs)',
  );
} else {
  if (!isProduction) {
    console.warn('⚠️ Sentry server: Invalid or missing DSN (dev mode)');
  }
}

// =============================================
// API DÉVELOPPEUR - FONCTIONS UTILITAIRES
// =============================================

/**
 * Capture une exception PostgreSQL avec contexte
 * @param {Error} error - L'erreur PostgreSQL
 * @param {Object} context - Contexte de la requête DB
 */
export const captureDatabaseError = (error, context = {}) => {
  Sentry.withScope((scope) => {
    scope.setTag('error_category', 'database');
    scope.setTag('database_type', 'postgresql');

    if (error.code) {
      scope.setTag('postgres_code', error.code);
    }

    if (context.table) {
      scope.setTag('table', context.table);
    }

    if (context.operation) {
      scope.setTag('operation', context.operation);
    }

    // Contexte supplémentaire (filtré)
    if (context.query) {
      // Masquer valeurs sensibles dans requêtes SQL
      const sanitizedQuery = context.query.replace(
        /(password|token|secret|account_number|email)\s*=\s*'[^']*'/gi,
        "$1 = '[FILTERED]'",
      );
      scope.setContext('database', {
        query: sanitizedQuery.substring(0, 500),
      });
    }

    Sentry.captureException(error);
  });
};

/**
 * Capture les erreurs Resend (service email)
 * @param {Error} error - L'erreur Resend
 * @param {Object} context - Contexte de l'email
 */
export const captureEmailError = (error, context = {}) => {
  Sentry.withScope((scope) => {
    scope.setTag('error_category', 'email_service');
    scope.setTag('service', 'resend'); // ✅ Resend, pas EmailJS

    if (context.emailType) {
      scope.setTag('email_type', context.emailType);
    }

    // Ne pas exposer les emails réels
    scope.setContext('email', {
      type: context.emailType || 'contact',
      status: 'failed',
    });

    scope.setLevel('warning');
    Sentry.captureException(error);
  });
};

/**
 * Capture les erreurs de paiement mobile
 * @param {Error} error - L'erreur de paiement
 * @param {Object} context - Contexte du paiement
 */
export const capturePaymentError = (error, context = {}) => {
  Sentry.withScope((scope) => {
    scope.setTag('error_category', 'payment');
    scope.setTag('payment_method', 'mobile_payment');

    if (context.provider) {
      scope.setTag('payment_provider', context.provider);
    }

    // Ne pas exposer les numéros de compte
    scope.setContext('payment', {
      provider: context.provider || 'unknown',
      status: 'failed',
      // PAS de numéro de compte
    });

    scope.setLevel('error'); // Paiements = erreur grave
    Sentry.captureException(error);
  });
};

/**
 * Capture une exception simple avec contexte
 * @param {Error} error - L'erreur à capturer
 * @param {Object} context - Contexte optionnel
 */
export const captureException = (error, context = {}) => {
  Sentry.withScope((scope) => {
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context.level) {
      scope.setLevel(context.level);
    }

    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureException(error);
  });
};

/**
 * Capture un message simple
 * @param {string} message - Le message à capturer
 * @param {string} level - Niveau du message
 */
export const captureMessage = (message, options = {}) => {
  const filteredMessage = containsSensitiveData(message)
    ? filterMessage(message)
    : message;

  const level = typeof options === 'string' ? options : (options.level || 'info');

  Sentry.withScope((scope) => {
    if (typeof options === 'object') {
      if (options.tags) {
        Object.entries(options.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }
      if (options.extra) {
        Object.entries(options.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
    }

    scope.setLevel(level);
    Sentry.captureMessage(filteredMessage);
  });
};

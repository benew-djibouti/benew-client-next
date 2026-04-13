// instrumentation-client.js
// Configuration Sentry Client (Navigateur)
// Next.js 15 - E-commerce Djibouti - 500 visiteurs/jour
// ERREURS UNIQUEMENT - Pas de performance monitoring ni session replay

import * as Sentry from '@sentry/nextjs';
import {
  containsSensitiveData,
  filterMessage,
  isSensitiveRoute,
} from './utils/sentry-utils.js';

// =============================================
// VALIDATION CONFIGURATION
// =============================================

const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

// Validation DSN
function isValidDSN(dsn) {
  if (!dsn) return false;
  return /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
}

// =============================================
// INITIALISATION SENTRY CLIENT
// =============================================

if (sentryDSN && isValidDSN(sentryDSN)) {
  Sentry.init({
    dsn: sentryDSN,
    environment,
    release: process.env.SENTRY_RELEASE || '1.0.0',

    // ✅ CRITIQUE : Actif uniquement en production
    enabled: isProduction,

    // ✅ Debug en développement seulement
    debug: !isProduction,

    // ===== ERREURS UNIQUEMENT (500 users/jour) =====
    // Pas de performance monitoring
    tracesSampleRate: 0,

    // Pas de session replay
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Pas d'intégrations performance/replay
    integrations: [],

    // ===== ERREURS À IGNORER (E-COMMERCE SPÉCIFIQUE) =====
    ignoreErrors: [
      // Erreurs navigateur courantes (bruit)
      'Non-Error promise rejection captured',
      'Script error',
      'Non-Error exception captured',

      // Extensions navigateur
      'chrome-extension',
      'safari-extension',
      'moz-extension',
      'edge-extension',

      // Erreurs réseau client (timeouts normaux)
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'AbortError',
      'TypeError: Failed to fetch',
      'Load failed',

      // Erreurs Next.js/React client (normales)
      'ChunkLoadError',
      'Loading chunk',
      'Loading CSS chunk',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',

      // Erreurs CSP (gérées par headers)
      'Content Security Policy',
      'violated directive',

      // Erreurs Hydration (Next.js 15)
      'Hydration failed',
      'Text content does not match',
      'There was an error while hydrating',

      // Erreurs formulaires (spam bots)
      'Form submission blocked',
      'Captcha validation failed',
    ],

    // ===== URLS À IGNORER =====
    denyUrls: [
      // Extensions navigateur
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /^safari-extension:\/\//i,
      /^edge-extension:\/\//i,

      // Services tiers analytics (éviter bruit)
      /googletagmanager\.com/i,
      /analytics\.google\.com/i,
      /doubleclick\.net/i,
      /facebook\.net/i,
      /connect\.facebook\.com/i,
    ],

    // ===== FILTRAGE BREADCRUMBS =====
    beforeBreadcrumb(breadcrumb) {
      // Filtrer les requêtes sensibles
      if (['xhr', 'fetch'].includes(breadcrumb.category) && breadcrumb.data) {
        // Bloquer breadcrumbs des routes checkout/payment
        if (breadcrumb.data.url) {
          const url = breadcrumb.data.url;

          if (
            url.includes('/checkout') ||
            url.includes('/payment') ||
            url.includes('/order') ||
            url.includes('/api/contact')
          ) {
            return null; // Ignorer complètement
          }
        }

        // Filtrer les données sensibles dans le body
        if (
          breadcrumb.data.body &&
          containsSensitiveData(breadcrumb.data.body)
        ) {
          breadcrumb.data.body = '[FILTERED]';
        }
      }

      // Filtrer les logs console sensibles
      if (breadcrumb.category === 'console' && breadcrumb.message) {
        if (containsSensitiveData(breadcrumb.message)) {
          return null;
        }
      }

      // Filtrer les clics sur éléments sensibles
      if (breadcrumb.category === 'ui.click' && breadcrumb.message) {
        if (
          breadcrumb.message.includes('payment') ||
          breadcrumb.message.includes('checkout') ||
          breadcrumb.message.includes('account')
        ) {
          breadcrumb.message = 'User clicked on [SENSITIVE_ELEMENT]';
        }
      }

      return breadcrumb;
    },

    // ===== FILTRAGE ÉVÉNEMENTS =====
    beforeSend(event) {
      // ⚠️ IMPORTANT : Ne pas bloquer complètement les erreurs critiques
      // Filtrer les DONNÉES sensibles mais GARDER l'erreur

      // Filtrer les données de requête
      if (event.request) {
        // URL
        if (event.request.url && isSensitiveRoute(event.request.url)) {
          // Garder l'erreur mais anonymiser l'URL
          event.request.url = event.request.url.replace(/\/[^/]+$/, '/[SLUG]');
        }

        // Headers
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }

        // Cookies
        if (event.request.cookies) {
          event.request.cookies = '[FILTERED]';
        }

        // Query params sensibles
        if (event.request.query_string) {
          event.request.query_string = event.request.query_string.replace(
            /(email|phone|account|token)=[^&]*/gi,
            '$1=[FILTERED]',
          );
        }

        // Body
        if (event.request.data) {
          if (typeof event.request.data === 'string') {
            if (containsSensitiveData(event.request.data)) {
              event.request.data = '[FILTERED]';
            }
          }
        }
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

      // Context utilisateur (app publique = visiteurs anonymes)
      if (event.user) {
        event.user = {
          id: 'anonymous',
          type: 'visitor',
        };
      }

      // Tags pour e-commerce Djibouti
      event.tags = {
        ...event.tags,
        project: 'benew-client',
        runtime: 'browser',
        country: 'DJ', // Djibouti
        app_type: 'ecommerce',
      };

      // Context page
      if (typeof window !== 'undefined' && window.location) {
        const pathname = window.location.pathname;

        // Catégoriser par type de page
        if (pathname.includes('/templates')) {
          event.tags.page_type = 'templates';
          event.tags.page_value = 'high'; // Page importante
        } else if (pathname.includes('/blog')) {
          event.tags.page_type = 'blog';
          event.tags.page_value = 'low';
        } else if (
          pathname.includes('/checkout') ||
          pathname.includes('/order')
        ) {
          event.tags.page_type = 'checkout';
          event.tags.page_value = 'critical'; // Page critique
        } else if (pathname.includes('/contact')) {
          event.tags.page_type = 'contact';
          event.tags.page_value = 'medium';
        } else if (pathname === '/') {
          event.tags.page_type = 'homepage';
          event.tags.page_value = 'high';
        }
      }

      return event;
    },
  });

  console.log('✅ Sentry client initialized (errors only, production mode)');
} else {
  if (!isProduction) {
    console.warn('⚠️ Sentry client: Invalid or missing DSN (dev mode)');
  }
}

// =============================================
// EXPORTS OPTIONNELS (POUR DEBUGGING)
// =============================================

/**
 * Export pour navigation tracking (optionnel)
 * Utilisé par Sentry pour suivre les transitions de routes
 *
 * Note : Désactivé pour économiser quota (500 users/jour)
 * Décommenter si besoin de tracking navigation
 */
// export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

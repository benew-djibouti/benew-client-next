// backend/rateLimiter.js
// Rate limiting robuste pour Next.js 16 — 500 visiteurs/jour
// Single-process PM2 — architecture Kamatera avec Nginx

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
  limits: {
    public: { requests: 30, window: 60 * 1000 }, // 30 req/min
    api: { requests: 20, window: 60 * 1000 }, // 20 req/min
    contact: { requests: 3, window: 10 * 60 * 1000 }, // 3 req/10min
    order: { requests: 2, window: 5 * 60 * 1000 }, // 2 req/5min
  },

  cache: {
    maxSize: 200,
    cleanupInterval: 10 * 60 * 1000, // 10 minutes
  },

  logging: process.env.NODE_ENV === 'development',
};

// ⚠️ IMPORTANT : Rate limiter en mémoire — single-process uniquement (PM2 instances: 1).
// En multi-process → migrer vers Redis.
// Les données sont perdues au redémarrage du process.

const requestsCache = new Map();
const blockedIPs = new Map();

// Whitelist : IPs internes chargées depuis .env (jamais hardcodées dans le code)
// 127.0.0.1 et ::1 sont EXCLUS car spoofables via x-forwarded-for
// Dans .env : INTERNAL_WHITELIST_IPS=185.237.96.207,185.237.96.20
const WHITELIST_IPS = new Set(
  (process.env.INTERNAL_WHITELIST_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean),
);

// =============================================
// UTILITAIRES
// =============================================

/**
 * Extraction d'IP sécurisée pour architecture Nginx + Next.js
 * Nginx injecte x-real-ip avec $remote_addr — c'est le seul header fiable.
 * x-forwarded-for est supprimé : même avec Nginx, un client peut le forger
 * si la config Nginx utilise $proxy_add_x_forwarded_for au lieu de $remote_addr.
 */
export function getClientIP(request) {
  // x-real-ip est injecté par Nginx avec $remote_addr — seul header fiable
  // x-forwarded-for supprimé : spoofable par le client même avec Nginx
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  return '127.0.0.1';
}

/**
 * Extraction d'IP pour Server Actions (utilise next/headers)
 */
export async function getClientIPFromAction() {
  try {
    const headersList = await headers();
    // x-real-ip est injecté par Nginx avec $remote_addr — seul header fiable
    const realIP = headersList.get('x-real-ip');
    if (realIP) return realIP;
    return '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

/**
 * Anonymisation IP pour les logs
 */
function anonymizeIP(ip) {
  if (!ip) return 'unknown';

  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }

  return ip.substring(0, 8) + 'xxx';
}

/**
 * Log conditionnel (développement uniquement)
 */
function log(message, data = {}) {
  if (CONFIG.logging) {
    console.log(`[Rate Limit] ${message}`, data);
  }
}

// =============================================
// LOGIQUE PRINCIPALE
// =============================================

/**
 * Vérification de rate limit
 */
function checkRateLimit(ip, limit) {
  const now = Date.now();
  const windowStart = now - limit.window;

  let userData = requestsCache.get(ip);
  if (!userData) {
    userData = { requests: [] };
    requestsCache.set(ip, userData);
  }

  // Nettoyer les timestamps expirés
  userData.requests = userData.requests.filter((ts) => ts > windowStart);

  if (userData.requests.length >= limit.requests) {
    log(`Rate limit exceeded: ${anonymizeIP(ip)}`, {
      requests: userData.requests.length,
      limit: limit.requests,
      window: limit.window / 1000 + 's',
    });
    return false;
  }

  userData.requests.push(now);
  return true;
}

/**
 * Vérification si une IP est bloquée
 */
function isIPBlocked(ip) {
  const blockInfo = blockedIPs.get(ip);
  if (!blockInfo) return false;

  if (Date.now() > blockInfo.until) {
    blockedIPs.delete(ip);
    return false;
  }

  return true;
}

/**
 * Bloquer une IP temporairement
 */
function blockIP(ip, duration = 15 * 60 * 1000) {
  blockedIPs.set(ip, {
    until: Date.now() + duration,
    reason: 'Rate limit exceeded multiple times',
  });

  log(`IP blocked: ${anonymizeIP(ip)}`, { duration: duration / 1000 + 's' });
}

// =============================================
// MIDDLEWARE PRINCIPAL
// =============================================

/**
 * Crée un middleware de rate limiting pour les routes Next.js
 */
export function createRateLimit(limitType = 'public') {
  const limit = CONFIG.limits[limitType] || CONFIG.limits.public;

  return async function rateLimit(request) {
    const ip = getClientIP(request);
    const path = request.nextUrl?.pathname || request.url || '';

    try {
      // Whitelist — IPs internes Kamatera uniquement
      if (WHITELIST_IPS.has(ip)) {
        log(`Whitelisted IP: ${anonymizeIP(ip)}`);
        return null;
      }

      // IP bloquée
      if (isIPBlocked(ip)) {
        const blockInfo = blockedIPs.get(ip);
        const remainingTime = Math.ceil((blockInfo.until - Date.now()) / 1000);

        return NextResponse.json(
          {
            error: 'Accès temporairement bloqué',
            message: 'Veuillez réessayer plus tard',
            retryAfter: remainingTime,
          },
          {
            status: 429,
            headers: {
              'Retry-After': remainingTime.toString(),
              'X-RateLimit-Limit': limit.requests.toString(),
              'X-RateLimit-Remaining': '0',
            },
          },
        );
      }

      // Rate limit dépassé
      if (!checkRateLimit(ip, limit)) {
        const userData = requestsCache.get(ip);

        // Récidiviste → bloquer temporairement
        if (userData && userData.requests.length > limit.requests * 2) {
          blockIP(ip);
          return NextResponse.json(
            {
              error: 'Accès bloqué pour abus',
              message: 'Trop de tentatives. Accès temporairement restreint.',
            },
            { status: 429 },
          );
        }

        const resetTime = Math.ceil((Date.now() + limit.window) / 1000);

        return NextResponse.json(
          {
            error: 'Trop de requêtes',
            message: getContextualMessage(path),
            retryAfter: Math.ceil(limit.window / 1000),
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil(limit.window / 1000).toString(),
              'X-RateLimit-Limit': limit.requests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': resetTime.toString(),
            },
          },
        );
      }

      // Requête autorisée
      const userData = requestsCache.get(ip);
      const remaining = Math.max(0, limit.requests - userData.requests.length);
      log(`Allowed: ${anonymizeIP(ip)} → ${path}`, { remaining });

      return null;
    } catch (error) {
      log('Rate limit error:', { error: error.message });
      return null; // fail open
    }
  };
}

/**
 * Messages contextualisés par endpoint
 */
function getContextualMessage(path) {
  if (path.includes('/contact'))
    return 'Trop de messages envoyés. Veuillez patienter avant de renvoyer.';
  if (path.includes('/order'))
    return 'Trop de tentatives de commande. Veuillez patienter.';
  if (path.includes('/blog'))
    return 'Trop de requêtes sur le blog. Veuillez ralentir.';
  if (path.includes('/templates'))
    return 'Trop de requêtes sur les templates. Veuillez patienter.';
  return 'Trop de requêtes. Veuillez réessayer plus tard.';
}

// =============================================
// MIDDLEWARES PRÉ-CONFIGURÉS
// =============================================

export const publicRateLimit = createRateLimit('public');
export const apiRateLimit = createRateLimit('api');
export const contactRateLimit = createRateLimit('contact');
export const orderRateLimit = createRateLimit('order');

// =============================================
// RATE LIMITING POUR SERVER ACTIONS
// =============================================

/**
 * Rate limiting pour Server Actions Next.js
 * Retourne un objet simple au lieu de NextResponse
 *
 * @param {string} identifier - IP, email ou user ID
 * @param {string} limitType  - 'contact' | 'order' | 'api' | 'public'
 * @returns {Promise<{success: boolean, reset: number, message?: string}>}
 */
export async function checkServerActionRateLimit(
  identifier,
  limitType = 'api',
) {
  if (!identifier) {
    return { success: true, reset: 0 };
  }

  const limit = CONFIG.limits[limitType] || CONFIG.limits.api;
  const now = Date.now();

  try {
    // Whitelist IPs internes
    if (WHITELIST_IPS.has(identifier)) {
      return { success: true, reset: 0 };
    }

    // Identifiant bloqué
    if (isIPBlocked(identifier)) {
      const blockInfo = blockedIPs.get(identifier);
      const remainingTime = Math.ceil((blockInfo.until - now) / 1000);
      return {
        success: false,
        reset: remainingTime,
        message: 'Accès temporairement bloqué',
        code: 'BLOCKED',
      };
    }

    // Rate limit dépassé
    if (!checkRateLimit(identifier, limit)) {
      const userData = requestsCache.get(identifier);

      // Récidiviste → bloquer
      if (userData && userData.requests.length > limit.requests * 2) {
        blockIP(identifier);
        return {
          success: false,
          reset: 900,
          message: 'Accès bloqué pour abus',
          code: 'BLOCKED_ABUSE',
        };
      }

      // FIX: resetTime minimum 1 seconde (évite les retry immédiats)
      const oldestRequest = userData.requests[0];
      const resetTime = Math.max(
        1,
        Math.ceil((oldestRequest + limit.window - now) / 1000),
      );

      return {
        success: false,
        reset: resetTime,
        message: 'Trop de requêtes',
        code: 'RATE_LIMITED',
      };
    }

    // Autorisé
    const userData = requestsCache.get(identifier);
    const remaining = Math.max(0, limit.requests - userData.requests.length);

    return { success: true, reset: 0, remaining };
  } catch (error) {
    log('Rate limit error:', { error: error.message });
    return { success: true, reset: 0 }; // fail open
  }
}

// =============================================
// UTILITAIRES D'ADMINISTRATION
// =============================================

export function getStats() {
  return {
    cache: {
      totalIPs: requestsCache.size,
      blockedIPs: blockedIPs.size,
      maxSize: CONFIG.cache.maxSize,
      usage: `${Math.round((requestsCache.size / CONFIG.cache.maxSize) * 100)}%`,
    },
    config: {
      environment: process.env.NODE_ENV,
      logging: CONFIG.logging,
    },
    timestamp: new Date().toISOString(),
  };
}

export function addToWhitelist(ip) {
  WHITELIST_IPS.add(ip);
}
export function removeFromWhitelist(ip) {
  WHITELIST_IPS.delete(ip);
}
export function unblockIP(ip) {
  blockedIPs.delete(ip);
}
export function resetCache() {
  requestsCache.clear();
  blockedIPs.clear();
}

// =============================================
// NETTOYAGE AUTOMATIQUE
// =============================================

// FIX: .unref() évite que ce timer bloque le graceful shutdown du process
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  const windowMax = Math.max(
    ...Object.values(CONFIG.limits).map((l) => l.window),
  );
  let cleaned = 0;

  // Supprimer les IPs bloquées expirées
  for (const [ip, blockInfo] of blockedIPs.entries()) {
    if (now > blockInfo.until) {
      blockedIPs.delete(ip);
      cleaned++;
    }
  }

  // FIX: supprimer d'abord les entrées dont TOUS les timestamps sont expirés
  // (évite de remettre à zéro des IPs actives en cours de rate limiting)
  if (requestsCache.size > CONFIG.cache.maxSize) {
    for (const [ip, userData] of requestsCache.entries()) {
      if (userData.requests.every((ts) => now - ts > windowMax)) {
        requestsCache.delete(ip);
        cleaned++;
      }
      // Pas de break — parcourir toutes les entrées expirées
    }

    // Si toujours trop grand, supprimer les plus anciennes en dernier recours
    if (requestsCache.size > CONFIG.cache.maxSize) {
      const entries = Array.from(requestsCache.entries());
      const toDelete = entries.slice(0, entries.length - CONFIG.cache.maxSize);
      toDelete.forEach(([ip]) => {
        requestsCache.delete(ip);
        cleaned++;
      });
    }
  }

  if (cleaned > 0) {
    log(`Cleanup: ${cleaned} entries removed`);
  }
}, CONFIG.cache.cleanupInterval);

// FIX: ne pas bloquer le graceful shutdown
cleanupTimer.unref();

// =============================================
// EXPORT PAR DÉFAUT
// =============================================

export default {
  createRateLimit,
  publicRateLimit,
  apiRateLimit,
  contactRateLimit,
  orderRateLimit,
  checkServerActionRateLimit,
  getStats,
  addToWhitelist,
  removeFromWhitelist,
  unblockIP,
  resetCache,
};

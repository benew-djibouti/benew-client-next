// utils/sentry-utils.js
// Utilitaires Sentry - Version complète et adaptée
// E-commerce Djibouti - Paiement mobile - 500 users/jour
// Next.js 15 + Resend + PostgreSQL

// =============================================
// DÉTECTION DONNÉES SENSIBLES
// =============================================

/**
 * Détecte les données sensibles critiques
 * @param {string} str - La chaîne à analyser
 * @returns {boolean} - True si des données sensibles critiques sont détectées
 */
export function containsSensitiveData(str) {
  if (!str || typeof str !== 'string') return false;

  // Patterns critiques pour e-commerce Djibouti
  const criticalPatterns = [
    // Mots de passe et secrets
    /password/i,
    /mot\s*de\s*passe/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,

    // Numéros de compte mobile Djiboutien
    // Format: 77XXXXXX ou 0025377XXXXXX
    /\b(?:00253\s*)?77\s*\d{6}\b/gi,

    // Informations personnelles
    /email/i,
    /e-mail/i,
    /courriel/i,

    // Données de paiement mobile
    /account[_-]?number/i,
    /num[ée]ro[_\s]de[_\s]compte/i,
    /payment[_-]?method/i,
    /moyen[_\s]de[_\s]paiement/i,

    // Identifiants personnels
    /carte[_\s]d'identit[ée]/i,
    /passport/i,
    /passeport/i,
  ];

  return criticalPatterns.some((pattern) => pattern.test(str));
}

/**
 * Filtre un message en masquant les parties sensibles
 * @param {string} message - Le message à filtrer
 * @returns {string} - Message filtré
 */
export function filterMessage(message) {
  if (!message || typeof message !== 'string') return message;

  let filteredMessage = message;

  // Patterns de remplacement pour données sensibles
  const replacements = [
    // Authentification
    { pattern: /password[=:]\s*[^\s]+/gi, replacement: 'password=[FILTERED]' },
    { pattern: /token[=:]\s*[^\s]+/gi, replacement: 'token=[FILTERED]' },
    { pattern: /secret[=:]\s*[^\s]+/gi, replacement: 'secret=[FILTERED]' },
    {
      pattern: /api[_-]?key[=:]\s*[^\s]+/gi,
      replacement: 'api_key=[FILTERED]',
    },

    // Emails (multiples formats)
    {
      pattern: /email[=:]\s*[^\s@]+@[^\s,}"]+/gi,
      replacement: 'email=[FILTERED]',
    },
    {
      pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      replacement: '[EMAIL_FILTERED]',
    },

    // Numéros de compte mobile Djiboutien
    {
      pattern: /\b(?:00253\s*)?77\s*\d{6}\b/gi,
      replacement: '[ACCOUNT_NUMBER_FILTERED]',
    },

    // Numéros de téléphone internationaux
    {
      pattern:
        /(\+\d{1,3}[-\s]?)?\(?\d{2,4}\)?[-\s]?\d{2,4}[-\s]?\d{2,4}[-\s]?\d{2,4}/g,
      replacement: '[PHONE_FILTERED]',
    },
  ];

  replacements.forEach(({ pattern, replacement }) => {
    filteredMessage = filteredMessage.replace(pattern, replacement);
  });

  // Tronquer si trop long après filtrage
  if (filteredMessage.length > 250) {
    filteredMessage = `${filteredMessage.substring(0, 250)}... [TRUNCATED]`;
  }

  return filteredMessage;
}

// =============================================
// CATÉGORISATION ERREURS
// =============================================

/**
 * Catégorise une erreur selon son type
 * @param {Error} error - L'erreur à catégoriser
 * @returns {string} - Catégorie de l'erreur
 */
export function categorizeError(error) {
  if (!error) return 'unknown';

  const errorString = error.toString().toLowerCase();
  const errorMessage = (error.message || '').toLowerCase();
  const errorStack = (error.stack || '').toLowerCase();

  // Erreurs PostgreSQL
  if (
    error.code ||
    errorString.includes('postgres') ||
    errorString.includes('pg') ||
    errorMessage.includes('database') ||
    errorMessage.includes('connection')
  ) {
    return 'database';
  }

  // Erreurs Cloudinary
  if (
    errorString.includes('cloudinary') ||
    errorMessage.includes('upload') ||
    errorMessage.includes('image')
  ) {
    return 'cloudinary';
  }

  // Erreurs Email (Resend)
  if (
    errorString.includes('resend') ||
    errorString.includes('email') ||
    errorMessage.includes('send')
  ) {
    return 'email_service';
  }

  // Erreurs réseau
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound')
  ) {
    return 'network';
  }

  // Erreurs validation (Yup)
  if (
    error.name === 'ValidationError' ||
    errorString.includes('validation') ||
    errorMessage.includes('yup')
  ) {
    return 'validation';
  }

  // Erreurs Next.js
  if (
    errorMessage.includes('next_redirect') ||
    errorMessage.includes('next_not_found')
  ) {
    return 'nextjs_routing';
  }

  // Erreurs paiement mobile
  if (
    errorMessage.includes('payment') ||
    errorMessage.includes('paiement') ||
    errorMessage.includes('transaction')
  ) {
    return 'payment';
  }

  // Erreurs React/UI
  if (
    errorStack.includes('react') ||
    errorMessage.includes('render') ||
    errorMessage.includes('hydration')
  ) {
    return 'react_ui';
  }

  return 'application';
}

// =============================================
// ANONYMISATION DONNÉES
// =============================================

/**
 * Anonymise les données utilisateur
 * @param {Object} user - Données utilisateur
 * @returns {Object} - Données anonymisées
 */
export function anonymizeUserData(user) {
  if (!user || typeof user !== 'object') return null;

  // Pour app publique sans auth : minimal
  return {
    id: user.id || 'anonymous',
    type: 'visitor',
    // Pas d'email, pas de nom, rien de personnel
  };
}

/**
 * Anonymise une URL en masquant les données sensibles
 * @param {string} url - L'URL à anonymiser
 * @returns {string} - URL anonymisée
 */
export function anonymizeUrl(url) {
  if (!url || typeof url !== 'string') return url;

  let anonymizedUrl = url;

  // Masquer les IDs dans les URLs
  anonymizedUrl = anonymizedUrl.replace(/\/\d+(?=\/|$)/g, '/[ID]');

  // Masquer les slugs/identifiants après certains paths
  anonymizedUrl = anonymizedUrl.replace(
    /\/(templates|blog|order)\/[^/?]+/gi,
    '/$1/[SLUG]',
  );

  // Masquer les paramètres de query sensibles
  const sensitiveParams = [
    'email',
    'token',
    'key',
    'password',
    'account',
    'phone',
    'tel',
  ];

  sensitiveParams.forEach((param) => {
    const regex = new RegExp(`([?&]${param}=)[^&]*`, 'gi');
    anonymizedUrl = anonymizedUrl.replace(regex, `$1[FILTERED]`);
  });

  // Masquer les numéros de compte Djiboutiens dans URL
  anonymizedUrl = anonymizedUrl.replace(
    /\b(?:00253\s*)?77\s*\d{6}\b/gi,
    '[ACCOUNT_FILTERED]',
  );

  return anonymizedUrl;
}

/**
 * Anonymise les headers HTTP
 * @param {Object} headers - Headers HTTP
 * @returns {Object} - Headers anonymisés
 */
export function anonymizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;

  const anonymized = { ...headers };

  // Headers à masquer complètement
  const headersToFilter = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-csrf-token',
    'x-session-id',
    'set-cookie',
  ];

  headersToFilter.forEach((header) => {
    const lowerHeader = header.toLowerCase();
    Object.keys(anonymized).forEach((key) => {
      if (key.toLowerCase() === lowerHeader) {
        anonymized[key] = '[FILTERED]';
      }
    });
  });

  // Headers à tronquer (garder début seulement)
  const headersToTruncate = ['user-agent', 'referer', 'origin'];

  headersToTruncate.forEach((header) => {
    const lowerHeader = header.toLowerCase();
    Object.keys(anonymized).forEach((key) => {
      if (key.toLowerCase() === lowerHeader && anonymized[key]) {
        const value = String(anonymized[key]);
        if (value.length > 100) {
          anonymized[key] = `${value.substring(0, 100)}...`;
        }
      }
    });
  });

  return anonymized;
}

/**
 * Filtre le body d'une requête
 * @param {string|Object} body - Body de la requête
 * @returns {string|Object} - Body filtré
 */
export function filterRequestBody(body) {
  if (!body) return body;

  // Si c'est une string, filtrer comme un message
  if (typeof body === 'string') {
    return filterMessage(body);
  }

  // Si c'est un objet, filtrer récursivement
  if (typeof body === 'object') {
    const filtered = Array.isArray(body) ? [] : {};

    Object.keys(body).forEach((key) => {
      const lowerKey = key.toLowerCase();

      // Champs sensibles à masquer complètement
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('key') ||
        lowerKey === 'account_number' ||
        lowerKey === 'numero_compte'
      ) {
        filtered[key] = '[FILTERED]';
      }
      // Emails à filtrer
      else if (lowerKey.includes('email') || lowerKey.includes('mail')) {
        filtered[key] = '[EMAIL_FILTERED]';
      }
      // Téléphones/comptes à filtrer
      else if (
        lowerKey.includes('phone') ||
        lowerKey.includes('tel') ||
        lowerKey.includes('mobile') ||
        lowerKey.includes('account')
      ) {
        filtered[key] = '[CONTACT_FILTERED]';
      }
      // Récursion pour objets imbriqués
      else if (typeof body[key] === 'object' && body[key] !== null) {
        filtered[key] = filterRequestBody(body[key]);
      }
      // Valeurs normales
      else {
        filtered[key] = body[key];
      }
    });

    return filtered;
  }

  return body;
}

// =============================================
// UTILITAIRES COMPLÉMENTAIRES
// =============================================

/**
 * Valide un DSN Sentry
 * @param {string} dsn - Le DSN à valider
 * @returns {boolean} - True si le DSN est valide
 */
export function isValidDSN(dsn) {
  if (!dsn) return false;
  return /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
}

/**
 * Vérifie si une URL contient des routes sensibles
 * @param {string} url - L'URL à vérifier
 * @returns {boolean} - True si l'URL est sensible
 */
export function isSensitiveRoute(url) {
  if (!url) return false;

  const sensitiveRoutes = [
    '/api/contact',
    '/api/order',
    '/api/payment',
    '/api/checkout',
    '/contact',
    '/order',
    '/checkout',
    '/admin',
  ];

  return sensitiveRoutes.some((route) => url.includes(route));
}

/**
 * Formate une erreur pour le logging
 * @param {Error} error - L'erreur à formater
 * @returns {Object} - Erreur formatée
 */
export function formatError(error) {
  if (!error) return null;

  return {
    name: error.name || 'Unknown',
    message: containsSensitiveData(error.message)
      ? filterMessage(error.message)
      : error.message,
    stack: error.stack ? error.stack.substring(0, 500) : null,
    category: categorizeError(error),
  };
}

/**
 * Crée un contexte d'erreur sécurisé pour Sentry
 * @param {Object} context - Contexte original
 * @returns {Object} - Contexte sécurisé
 */
export function createSecureContext(context = {}) {
  const secure = {
    tags: context.tags || {},
    extra: {},
  };

  // Filtrer les extras
  if (context.extra) {
    Object.keys(context.extra).forEach((key) => {
      const value = context.extra[key];

      if (typeof value === 'string' && containsSensitiveData(value)) {
        secure.extra[key] = filterMessage(value);
      } else if (typeof value === 'object') {
        secure.extra[key] = filterRequestBody(value);
      } else {
        secure.extra[key] = value;
      }
    });
  }

  return secure;
}

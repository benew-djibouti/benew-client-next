// utils/sanitizers/orderSanitizer.js
// Sanitization production-ready pour 500 utilisateurs/jour
// Optimisé, sécurisé, support CASH

import { captureException } from '../../sentry.server.config';

// =============================
// PATTERNS DE SÉCURITÉ
// =============================

// Patterns dangereux à bloquer
const DANGEROUS_PATTERNS = {
  script: /<script[^>]*>.*?<\/script>/gi,
  sql: /(\b(DROP|DELETE|INSERT|UPDATE|SELECT|UNION|EXEC|EXECUTE)\b)/gi,
  xss: /[<>'"]/g,
  nullByte: /\0/g,
};

// =============================
// SANITIZATION DE BASE
// =============================

/**
 * Nettoie une chaîne de caractères
 * @param {string} input - Texte à nettoyer
 * @param {number} maxLength - Longueur maximale
 * @returns {string}
 */
function cleanString(input, maxLength = 200) {
  if (!input || typeof input !== 'string') return '';

  return (
    input
      .trim()
      // Supprimer les caractères dangereux
      .replace(DANGEROUS_PATTERNS.xss, '')
      .replace(DANGEROUS_PATTERNS.nullByte, '')
      .substring(0, maxLength)
  );
}

/**
 * Nettoie un email
 * @param {string} email - Email à nettoyer
 * @returns {string}
 */
function cleanEmail(email) {
  if (!email || typeof email !== 'string') return '';

  return email
    .trim()
    .toLowerCase()
    .replace(/[<>'"]/g, '')
    .substring(0, 100);
}

/**
 * Nettoie un numéro de téléphone
 * @param {string} phone - Téléphone à nettoyer
 * @returns {string}
 */
function cleanPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';

  // Garder seulement chiffres, +, -, (), espaces
  return phone
    .trim()
    .replace(/[^0-9+\-() ]/g, '')
    .substring(0, 20);
}

/**
 * Nettoie un nom (support caractères accentués)
 * @param {string} name - Nom à nettoyer
 * @returns {string}
 */
function cleanName(name) {
  if (!name || typeof name !== 'string') return '';

  // Autoriser lettres (avec accents), espaces, apostrophes, tirets
  return name
    .trim()
    .replace(/[^a-zA-ZÀ-ÿ\s'\-]/g, '')
    .substring(0, 100);
}

// =============================
// SANITIZATION PRINCIPALE
// =============================

/**
 * Sanitize les données de commande - PRODUCTION-READY
 * @param {Object} orderData - Données à sanitizer
 * @returns {{success: boolean, sanitized: Object|null, issues?: string[]}}
 */
export function sanitizeOrderData(orderData) {
  try {
    if (!orderData || typeof orderData !== 'object') {
      return {
        success: false,
        sanitized: null,
        issues: ['Données invalides'],
      };
    }

    const issues = [];

    // Sanitizer les IDs de plateformes
    const rawPaymentMethods = Array.isArray(orderData.paymentMethods)
      ? orderData.paymentMethods
      : [];

    const sanitizedPaymentMethods = rawPaymentMethods
      .map((id) => cleanString(id, 50))
      .filter((id) => id.length > 0);

    const sanitized = {
      name: cleanName(orderData.name),
      email: cleanEmail(orderData.email),
      phone: cleanPhone(orderData.phone),
      paymentMethods: sanitizedPaymentMethods,
      hasCashPayment: Boolean(orderData.hasCashPayment),
      applicationId: cleanString(orderData.applicationId, 50),
      applicationFee: Number(orderData.applicationFee) || 0,
    };

    if (!sanitized.name || sanitized.name.length < 3) {
      issues.push('Nom complet invalide');
    }

    if (!sanitized.email || !sanitized.email.includes('@')) {
      issues.push('Email invalide');
    }

    if (!sanitized.phone || sanitized.phone.replace(/\D/g, '').length < 8) {
      issues.push('Téléphone invalide');
    }

    if (sanitized.paymentMethods.length === 0) {
      issues.push('Au moins une méthode de paiement est requise');
    }

    if (sanitized.applicationFee <= 0) {
      issues.push('Montant invalide');
    }

    return {
      success: issues.length === 0,
      sanitized: issues.length === 0 ? sanitized : null,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (error) {
    captureException(error, {
      tags: { component: 'order_sanitizer', operation: 'sanitize' },
    });

    return {
      success: false,
      sanitized: null,
      issues: ['Erreur de sanitization'],
    };
  }
}

// =============================
// VALIDATION MÉTIER
// =============================

/**
 * Validation des règles métier
 * @param {Object} sanitizedData - Données déjà sanitizées
 * @returns {{valid: boolean, violations: string[]}}
 */
// Par :
export function validateBusinessRules(sanitizedData) {
  if (!sanitizedData) {
    return {
      valid: false,
      violations: ['Données manquantes'],
    };
  }

  const violations = [];

  if (
    sanitizedData.applicationFee < 1 ||
    sanitizedData.applicationFee > 100000
  ) {
    violations.push('Montant hors limites (1-100,000)');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitizedData.email)) {
    violations.push('Format email invalide');
  }

  const phoneDigits = sanitizedData.phone.replace(/\D/g, '');
  if (phoneDigits.length < 8) {
    violations.push('Téléphone trop court');
  }

  if (sanitizedData.name.length < 3) {
    violations.push('Nom trop court');
  }

  if (
    !Array.isArray(sanitizedData.paymentMethods) ||
    sanitizedData.paymentMethods.length === 0
  ) {
    violations.push('Au moins une méthode de paiement est requise');
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

// =============================
// VÉRIFICATION DE SÉCURITÉ
// =============================

/**
 * Vérification de sécurité finale
 * @param {Object} sanitizedData - Données sanitizées
 * @returns {{safe: boolean, threats?: string[]}}
 */
export function validateSanitizedDataSafety(sanitizedData) {
  if (!sanitizedData) {
    return { safe: false, threats: ['Données nulles'] };
  }

  const threats = [];
  const allValues = Object.values(sanitizedData).join(' ');

  // Vérifier les patterns dangereux
  if (DANGEROUS_PATTERNS.script.test(allValues)) {
    threats.push('Script détecté');
  }

  if (DANGEROUS_PATTERNS.sql.test(allValues)) {
    threats.push('SQL injection détecté');
  }

  // Vérifier les caractères suspects
  if (/<|>/.test(allValues)) {
    threats.push('Caractères HTML détectés');
  }

  if (/\0/.test(allValues)) {
    threats.push('Null byte détecté');
  }

  // Log en cas de menace détectée
  if (threats.length > 0) {
    captureException(new Error('Security threats detected'), {
      tags: { component: 'order_sanitizer', operation: 'safety_check' },
      extra: { threats, data: sanitizedData },
    });
  }

  return {
    safe: threats.length === 0,
    threats: threats.length > 0 ? threats : undefined,
  };
}

// =============================
// UTILITAIRES DE VALIDATION
// =============================

/**
 * Valide un UUID v4
 * @param {string} uuid - UUID à valider
 * @returns {boolean}
 */
export function isValidUUID(uuid) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof uuid === 'string' && uuidRegex.test(uuid);
}

/**
 * Valide un montant
 * @param {number} amount - Montant à valider
 * @returns {boolean}
 */
export function isValidAmount(amount) {
  return (
    typeof amount === 'number' &&
    amount > 0 &&
    amount <= 100000 &&
    Number.isFinite(amount)
  );
}

/**
 * Détecte les tentatives d'injection
 * @param {string} input - Texte à vérifier
 * @returns {boolean}
 */
export function hasInjectionAttempt(input) {
  if (typeof input !== 'string') return false;

  return (
    DANGEROUS_PATTERNS.script.test(input) ||
    DANGEROUS_PATTERNS.sql.test(input) ||
    /\0/.test(input)
  );
}

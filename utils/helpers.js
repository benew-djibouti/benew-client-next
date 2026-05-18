// utils/helpers.js

/**
 * Formate un montant sans devise (juste les espaces)
 * Utile pour les calculs ou affichages intermédiaires
 *
 * @param {number|string} amount - Montant à formater
 * @returns {string} Montant formaté avec espaces
 */
export function formatAmount(amount) {
  let numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount) || numAmount == null || numAmount < 0) return '0';
  return Math.round(numAmount).toLocaleString('fr-FR', {
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Formate un prix avec séparateurs de milliers et devise FDJ
 * Exemples:
 *   66000.00 → "66 000 FDJ"
 *   5500.00  → "5 500 FDJ"
 *   1200     → "1 200 FDJ"
 *   500      → "500 FDJ"
 *
 * @param {number|string} price - Prix à formater
 * @returns {string} Prix formaté avec espaces et devise
 */
export const formatPrice = (price) => {
  const formatted = formatAmount(price);
  return formatted === '0' ? '0 FDJ' : `${formatted} FDJ`;
};

/**
 * Retourne le label complet d'un niveau d'application
 * @param {number} level - Niveau d'application (1-5)
 * @returns {object} { short: string, long: string }
 */
export function getApplicationLevelLabel(level) {
  const levels = {
    1: {
      short: 'MS',
      long: 'Magasin Simplifié',
    },
    2: {
      short: 'MS+',
      long: 'Magasin Standard',
    },
    3: {
      short: 'MS2+',
      long: 'Magasin Supérieur',
    },
    4: {
      short: 'MS*',
      long: 'Magasin Sophistiqué',
    },
    5: {
      short: 'MP',
      long: 'Magasin Premium',
    },
  };

  return levels[level] || { short: 'MS', long: 'MS / Magasin Simplifié' };
}

/**
 * Tronque un texte à une longueur donnée
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string}
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Formatte une date en français
 * @param {string|Date} date - Date à formatter
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '';

  const d = new Date(date);

  if (isNaN(d.getTime())) return ''; // date invalide

  return d.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Africa/Djibouti', // UTC+3, explicite
  });
}

/**
 * Génère un ID unique côté client
 * @returns {string}
 */
// export function generateClientId() {
//   return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
// }

/**
 * Vérifie si une URL est valide
 * @param {string} url - URL à vérifier
 * @returns {boolean}
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retourne le nom de la plateforme de paiement formaté
 * @param {object} platform - Objet plateforme
 * @returns {string}
 */
export function getPlatformDisplayName(platform) {
  if (!platform) return '';

  if (platform.is_cash_payment) {
    return 'Paiement en Espèces (CASH)';
  }

  return platform.platform_name;
}

/**
 * Vérifie si un objet est vide
 * @param {object} obj - Objet à vérifier
 * @returns {boolean}
 */
export function isEmptyObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return Object.keys(obj).length === 0;
}

/**
 * Formate un prix avec décimales (si nécessaire)
 * @param {number|string} price - Prix à formater
 * @param {number} decimals - Nombre de décimales (défaut: 2)
 * @returns {string} Prix formaté
 */
export function formatPriceWithDecimals(price, decimals = 2) {
  let numPrice = typeof price === 'string' ? parseFloat(price) : price;

  if (
    isNaN(numPrice) ||
    numPrice === null ||
    numPrice === undefined ||
    numPrice < 0
  ) {
    return '0.00 FDJ';
  }

  const formattedNumber = numPrice.toLocaleString('fr-FR', {
    useGrouping: true,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${formattedNumber} FDJ`;
}

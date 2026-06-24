// lib/metaCAPI.js
import crypto from 'crypto';
import { captureException, captureMessage } from '../sentry.server.config';

// =============================
// CONFIGURATION
// =============================
const PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CONVERSIONS_API_TOKEN;
const API_VERSION = 'v22.0';
const API_URL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

// =============================
// UTILITAIRES
// =============================

/**
 * Hashe une donnée en SHA-256 (obligatoire par Meta)
 */
function hashData(value) {
  if (!value || typeof value !== 'string') return null;
  return crypto
    .createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex');
}

/**
 * Formate un numéro djiboutien pour Meta
 * Meta attend le format international sans + : 25377xxxxxx
 */
function formatPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  // Ajouter l'indicatif Djibouti si absent
  if (digits.startsWith('253')) return digits;
  return `253${digits}`;
}

// =============================
// ENVOI ÉVÉNEMENT CAPI
// =============================

/**
 * Envoie un événement Purchase à Meta via CAPI
 * Appelé côté serveur uniquement (server action)
 *
 * @param {Object} params
 * @param {string} params.orderId         - ID unique de la commande (event_id pour déduplication)
 * @param {string} params.email           - Email du client
 * @param {string} params.phone           - Téléphone du client
 * @param {number} params.amount          - Montant de la commande
 * @param {string} params.applicationName - Nom de l'application commandée
 * @param {string} params.clientIp        - IP du client (depuis les headers)
 * @param {string} params.clientUserAgent - User-Agent du client (depuis les headers)
 * @param {string} [params.fbp]           - Cookie _fbp (Facebook Browser ID)
 * @param {string} [params.fbc]           - Cookie _fbc (Facebook Click ID)
 */
export async function sendPurchaseEventToCAPI({
  orderId,
  email,
  phone,
  amount,
  applicationName,
  clientIp,
  clientUserAgent,
  fbp = null,
  fbc = null,
}) {
  // Ne pas envoyer si les variables d'environnement manquent
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[MetaCAPI] Variables manquantes — envoi ignoré');
    }
    return { success: false, code: 'MISSING_CONFIG' };
  }

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: orderId, // ← même ID que côté Pixel pour déduplication
        event_source_url: 'https://benew-dj.com',
        action_source: 'website',
        user_data: {
          em: email ? [hashData(email)] : [],
          ph: phone ? [hashData(formatPhone(phone))] : [],
          client_ip_address: clientIp || null,
          client_user_agent: clientUserAgent || null,
          ...(fbp && { fbp }), // cookie _fbp — améliore l'EMQ
          ...(fbc && { fbc }), // cookie _fbc — améliore l'EMQ
        },
        custom_data: {
          currency: 'DJF',
          value: amount,
          content_name: applicationName || 'Application Benew',
          content_type: 'product',
        },
      },
    ],
    test_event_code: TEST73708,
  };

  try {
    const response = await fetch(`${API_URL}?access_token=${ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      captureException(new Error('Meta CAPI error'), {
        tags: { component: 'meta_capi', operation: 'purchase_event' },
        extra: { result, orderId },
      });
      return { success: false, code: 'API_ERROR', details: result };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[MetaCAPI] Purchase envoyé:', result);
    }

    captureMessage('Meta CAPI Purchase sent', {
      level: 'info',
      tags: { component: 'meta_capi', operation: 'purchase_event' },
      extra: { orderId, eventsReceived: result.events_received },
    });

    return { success: true, eventsReceived: result.events_received };
  } catch (error) {
    captureException(error, {
      tags: { component: 'meta_capi', operation: 'purchase_event' },
      extra: { orderId },
    });
    return { success: false, code: 'NETWORK_ERROR', error: error.message };
  }
}

// actions/sendContactEmail.js
// ✅ MODIFICATIONS : Bot detection amélioré + DB storage + messages erreur spécifiques

'use server';

import { Resend } from 'resend';
import {
  formatContactValidationErrors,
  validateContactEmail,
} from '@/utils/schemas/contactEmailSchema';
import {
  checkServerActionRateLimit,
  getClientIPFromAction, // ← utilisé ci-dessous
} from '@/backend/rateLimiter';
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../sentry.server.config';
import { withTimeout } from '@/utils/asyncUtils';
// ← import Sentry et headers SUPPRIMÉS

const resend = new Resend(process.env.RESEND_API_KEY);

// =============================
// ✅ LISTE DISPOSABLE EMAILS
// =============================
const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail',
  'guerrillamail',
  '10minutemail',
  'mailinator',
  'throwaway',
  'trashmail',
  'fakeinbox',
  'sharklasers',
  'grr.la',
  'maildrop',
  'yopmail',
];

// =============================
// ✅ BOT DETECTION AMÉLIORÉ
// =============================
function detectBot(data, metadata = {}) {
  let riskScore = 0;
  const reasons = [];

  // Check 1: FillTime trop rapide (< 3 secondes)
  if (metadata.fillTime && metadata.fillTime < 1500) {
    riskScore += 3;
    reasons.push(`fillTime_too_fast: ${metadata.fillTime}ms`);
  }

  // Check 2: Email suspect (test@test, admin@admin)
  const emailLower = (data.email || '').toLowerCase();
  if (
    emailLower.includes('test@test') ||
    emailLower.includes('admin@admin') ||
    emailLower.includes('example@example')
  ) {
    riskScore += 3;
    reasons.push('suspicious_email_pattern');
  }

  // Check 3: Disposable email domains
  const emailDomain = emailLower.split('@')[1] || '';
  if (DISPOSABLE_EMAIL_DOMAINS.some((domain) => emailDomain.includes(domain))) {
    riskScore += 4;
    reasons.push(`disposable_email_domain: ${emailDomain}`);
  }

  // Check 4: Honeypot rempli
  if (metadata.honeypotFilled) {
    riskScore += 10;
    reasons.push('honeypot_filled');
  }

  const isSuspicious = riskScore >= 7;

  if (isSuspicious && process.env.NODE_ENV === 'development') {
    console.log('[Bot Detection]', {
      riskScore,
      reasons,
      isSuspicious,
      email: data.email,
    });
  }

  return {
    riskScore,
    isSuspicious,
    reasons,
  };
}

// =============================
// ✅ ANTI-DOUBLONS EN MÉMOIRE
// =============================
// ⚠️ IMPORTANT : Anti-doublons en mémoire locale au worker.
// Fonctionne correctement en single-process uniquement.
// En multi-process, un doublon envoyé sur deux workers différents
// quasi-simultanément peut passer. Protection principale = rate limiter.
// Si passage en multi-process → migrer vers vérification PostgreSQL.
const recentEmails = new Map();
const RECENT_EMAILS_MAX_SIZE = 500; // ~500 users/jour, large margin

function checkDuplicate(email, subject) {
  const key = `${email}:${subject}`;
  const now = Date.now();

  // Nettoyage des anciens (> 5 minutes)
  if (recentEmails.size > 0) {
    for (const [k, timestamp] of recentEmails.entries()) {
      if (now - timestamp > 5 * 60 * 1000) {
        recentEmails.delete(k);
      }
    }
  }

  // Sécurité : si la Map est encore trop grande après nettoyage
  // (rafale de bots avec sujets variés), vider les entrées les plus anciennes
  if (recentEmails.size >= RECENT_EMAILS_MAX_SIZE) {
    const overflow = recentEmails.size - RECENT_EMAILS_MAX_SIZE + 1;
    const keys = recentEmails.keys();
    for (let i = 0; i < overflow; i++) {
      recentEmails.delete(keys.next().value);
    }
  }

  if (recentEmails.has(key)) {
    const lastSubmission = recentEmails.get(key);
    const timeLeft = Math.ceil((5 * 60 * 1000 - (now - lastSubmission)) / 1000);
    return { isDuplicate: true, waitTime: timeLeft };
  }

  recentEmails.set(key, now);
  return { isDuplicate: false };
}

// Ajouter en tête du fichier, avec les autres utilitaires
function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;') // ← en premier, sinon les & des autres remplacements sont doublés
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// =============================
// ✅ RETRY LOGIC AVEC BACKOFF
// =============================
async function executeWithRetry(operation, maxAttempts = 2) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Erreurs non-retriables : inutile de réessayer
      const statusCode = error.statusCode || error.status;
      const isNonRetriable =
        statusCode === 429 || // Quota dépassé — retry aggrave le problème
        (statusCode >= 400 && statusCode < 500); // Erreurs client (4xx)

      if (isNonRetriable) {
        throw error; // Sortir immédiatement sans retry
      }

      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        captureMessage(`Retry email send (attempt ${attempt}/${maxAttempts})`, {
          level: 'info',
          tags: { component: 'contact_email', retry: true },
          extra: { attempt, maxAttempts, errorMessage: error.message },
        });
      }
    }
  }

  throw lastError;
}

// =============================
// ✅ CAPTURE ERREUR EMAIL
// =============================
function captureEmailError(error, context = {}) {
  const errorType = error.name || 'UnknownError';
  const errorMessage = error.message || 'No error message';

  const tags = {
    component: 'contact_email',
    error_type: errorType,
    ...context.tags,
  };

  const extra = {
    errorMessage,
    statusCode: error.statusCode,
    ...context.extra,
  };

  captureException(error, { tags, extra });
}

// =============================
// ✅ ENREGISTREMENT DB
// =============================
async function saveContactSubmission(data, metadata = {}) {
  let client;

  try {
    client = await getClient();

    const query = `
      INSERT INTO admin.contact_submissions (
        name, email, subject, message,
        status, resend_email_id,
        bot_detected, bot_risk_score,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, created_at
    `;

    const values = [
      data.name,
      data.email,
      data.subject,
      data.message,
      metadata.status || 'sent',
      metadata.resendEmailId || null,
      metadata.botDetected || false,
      metadata.botRiskScore || 0,
    ];

    const result = await withTimeout(
      client.query(query, values),
      5000,
      'Contact submission save timeout',
    );

    if (process.env.NODE_ENV === 'development') {
      console.log('[DB] Contact saved:', result.rows[0]);
    }

    return {
      success: true,
      submissionId: result.rows[0].id,
      createdAt: result.rows[0].created_at,
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'contact_db',
        operation: 'save_submission',
      },
      extra: {
        emailDomain: data.email?.split('@')[1] || 'unknown',
        errorMessage: error.message,
        pgErrorCode: error.code,
      },
    });

    return {
      success: false,
      error: error.message,
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

// =============================
// ✅ ACTION PRINCIPALE
// =============================
export async function sendContactEmail(formData) {
  // ← Plus de Sentry.withServerActionInstrumentation
  // ← Plus de headers()

  // 1. Vérification config env
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_TO_EMAIL ||
    !process.env.RESEND_FROM_EMAIL
  ) {
    captureMessage('Resend configuration incomplete', {
      level: 'error',
      tags: { component: 'contact_email', config: true },
    });

    return {
      success: false,
      message:
        "Le service d'envoi d'emails est temporairement indisponible. Contactez-nous par téléphone au 77.86.00.64.",
      code: 'EMAIL_CONFIG_ERROR',
    };
  }

  // 2. Rate limiting — email comme identifiant
  const rawIdentifier = formData.get('email') || 'anonymous';
  const identifier =
    typeof rawIdentifier === 'string'
      ? rawIdentifier.trim().substring(0, 100)
      : 'anonymous';
  const rateLimitResult = await checkServerActionRateLimit(
    identifier,
    'contact',
  );

  if (!rateLimitResult.success) {
    const waitMinutes = Math.ceil(rateLimitResult.reset / 60);
    const waitSeconds = rateLimitResult.reset;

    let message;
    if (waitMinutes < 1) {
      message = `Trop de tentatives. Veuillez réessayer dans ${waitSeconds} seconde${waitSeconds > 1 ? 's' : ''}.`;
    } else {
      message = `Trop de tentatives. Veuillez réessayer dans ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`;
    }

    return {
      success: false,
      message,
      code: rateLimitResult.code || 'RATE_LIMITED',
    };
  }

  // 3. Récupération IP — maintenant utilisée
  const ipAddress = await getClientIPFromAction();

  // 4. Extraction données
  const data = {
    name: formData.get('name') || '',
    email: formData.get('email') || '',
    subject: formData.get('subject') || '',
    message: formData.get('message') || '',
  };

  const parsedFillTime = parseInt(formData.get('_fillTime') || '0', 10);
  const metadata = {
    fillTime: Number.isNaN(parsedFillTime) ? 0 : parsedFillTime,
    honeypotFilled: !!(formData.get('website') || '').trim(),
  };

  // 5. Validation Yup
  const validation = await validateContactEmail(data);

  if (!validation.success) {
    return {
      success: false,
      message: formatContactValidationErrors(validation.errors),
      code: 'VALIDATION_ERROR',
    };
  }

  // 6. Bot detection
  const botCheck = detectBot(data, metadata);

  if (botCheck.isSuspicious) {
    captureMessage('Bot detected in contact form', {
      level: 'warning',
      tags: { component: 'contact_email', bot_detection: true },
      extra: {
        emailDomain: data.email?.split('@')[1] || 'unknown',
        riskScore: botCheck.riskScore,
        reasons: botCheck.reasons,
      },
    });

    await saveContactSubmission(data, {
      status: 'blocked_bot',
      ipAddress, // ← maintenant rempli
      botDetected: true,
      botRiskScore: botCheck.riskScore,
      fillTime: metadata.fillTime,
    });

    return {
      success: false,
      message:
        "Votre message n'a pas pu être envoyé. Veuillez réessayer ou nous contacter directement.",
      code: 'SUSPICIOUS_ACTIVITY',
    };
  }

  // 7. Anti-doublons
  const duplicateCheck = checkDuplicate(data.email, data.subject);

  if (duplicateCheck.isDuplicate) {
    return {
      success: false,
      message: `Vous avez déjà envoyé un message similaire. Attendez ${duplicateCheck.waitTime} secondes avant de réessayer.`,
      code: 'DUPLICATE_SUBMISSION',
    };
  }

  // 8. Envoi email avec retry
  try {
    const emailResult = await executeWithRetry(async () => {
      return await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: process.env.RESEND_TO_EMAIL,
        subject: `[Contact Benew] ${data.subject.replace(/[\r\n]/g, ' ')}`,
        html: `
          <h2>Nouveau message de contact</h2>
          <p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Djibouti' })}</p>
          <h3>Expéditeur</h3>
          <ul>
            <li><strong>Nom:</strong> ${escapeHtml(data.name)}</li>
            <li><strong>Email:</strong> ${escapeHtml(data.email)}</li>
            <li><strong>Sujet:</strong> ${escapeHtml(data.subject)}</li>
          </ul>
          <h3>Message</h3>
          <p>${escapeHtml(data.message).replace(/\n/g, '<br>')}</p>
        `,
        headers: {
          'X-Contact-Source': 'benew-website',
          'X-Contact-Version': '1.0',
          'X-Contact-Timestamp': new Date().toISOString(),
        },
      });
    });

    // 9. Enregistrement DB après succès
    const dbResult = await saveContactSubmission(data, {
      status: 'sent',
      resendEmailId: emailResult.id,
      ipAddress, // ← maintenant rempli
      botDetected: false,
      botRiskScore: botCheck.riskScore,
      fillTime: metadata.fillTime,
    });

    if (!dbResult.success) {
      captureMessage('Email sent but DB save failed', {
        level: 'warning',
        tags: { component: 'contact_email', db_save: true },
        extra: {
          emailDomain: data.email?.split('@')[1] || 'unknown',
          resendEmailId: emailResult.id,
          dbError: dbResult.error,
        },
      });
    }

    return {
      success: true,
      message:
        'Votre message a été envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.',
      code: 'EMAIL_SENT',
    };
  } catch (error) {
    let userMessage =
      "Une erreur s'est produite lors de l'envoi. Veuillez réessayer.";
    let errorCode = 'UNKNOWN_ERROR';

    if (error.statusCode === 429) {
      userMessage =
        "Quota d'envoi dépassé. Contactez-nous par téléphone au 77.86.00.64.";
      errorCode = 'QUOTA_EXCEEDED';
    } else if (error.name === 'ResendAPIError') {
      userMessage =
        "Service d'email temporairement indisponible. Essayez dans quelques minutes ou contactez-nous au 77.86.00.64.";
      errorCode = 'API_ERROR';
    } else if (error.message?.toLowerCase().includes('timeout')) {
      userMessage = "L'envoi a pris trop de temps. Veuillez réessayer.";
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.message?.toLowerCase().includes('network')) {
      userMessage =
        'Problème de connexion. Vérifiez votre connexion internet et réessayez.';
      errorCode = 'NETWORK_ERROR';
    }

    captureEmailError(error, {
      tags: { error_code: errorCode },
      extra: {
        emailDomain: data.email?.split('@')[1] || 'unknown',
        subjectLength: data.subject?.length || 0,
      },
    });

    await saveContactSubmission(data, {
      status: 'failed',
      ipAddress, // ← maintenant rempli
      botDetected: false,
      botRiskScore: botCheck.riskScore,
      fillTime: metadata.fillTime,
    });

    return {
      success: false,
      message: userMessage,
      code: errorCode,
    };
  }
}

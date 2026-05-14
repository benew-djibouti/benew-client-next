'use server';

import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../sentry.server.config';
import {
  validateOrderServer,
  prepareOrderDataFromFormData,
  formatValidationErrors,
} from '@/utils/schemas/schema';
import { isValidUUID, isValidAmount } from '@/utils/validation';
import {
  sanitizeOrderData,
  validateBusinessRules,
  validateSanitizedDataSafety,
  hasInjectionAttempt,
} from '@/utils/sanitizers/orderSanitizer';
import { checkServerActionRateLimit } from '@/backend/rateLimiter';
import { withTimeout } from '@/utils/asyncUtils';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';

// =============================
// CRÉATION DE COMMANDE
// =============================

/**
 * Crée une nouvelle commande - PRODUCTION-READY
 * Optimisé pour 500 utilisateurs/jour avec support CASH
 *
 * @param {FormData} formData - Données du formulaire
 * @param {string} applicationId - ID de l'application
 * @param {number} applicationFee - Montant de l'application
 * @param {boolean} isCashPayment - Mode CASH ou non
 * @returns {Promise<Object>} - Résultat de la création
 */
export async function createOrder(formData, applicationId, applicationFee) {
  return Sentry.withServerActionInstrumentation(
    'createOrder',
    {
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      let client = null;
      const startTime = Date.now();

      try {
        // =============================
        // ÉTAPE 1: RATE LIMITING
        // =============================

        // Extraire l'email ou le téléphone comme identifiant
        // (FormData n'est pas encore parsé, donc on le fait ici)
        const rawIdentifier =
          formData.get('email') || formData.get('phone') || 'anonymous';
        const emailIdentifier =
          typeof rawIdentifier === 'string'
            ? rawIdentifier.trim().substring(0, 100)
            : 'anonymous';

        const rateLimitResult = await checkServerActionRateLimit(
          emailIdentifier,
          'order',
        );

        if (!rateLimitResult.success) {
          const waitMinutes = Math.ceil(rateLimitResult.reset / 60);
          const waitSeconds = rateLimitResult.reset;

          // Message adapté selon la durée et le code d'erreur
          let message;

          if (
            rateLimitResult.code === 'BLOCKED' ||
            rateLimitResult.code === 'BLOCKED_ABUSE'
          ) {
            message =
              'Accès temporairement bloqué suite à un usage abusif. Réessayez plus tard.';
          } else if (waitMinutes < 1) {
            message = `Trop de tentatives de commande. Veuillez réessayer dans ${waitSeconds} seconde${waitSeconds > 1 ? 's' : ''}.`;
          } else {
            message = `Trop de tentatives de commande. Veuillez réessayer dans ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`;
          }

          return {
            success: false,
            message,
            code: rateLimitResult.code || 'RATE_LIMITED',
          };
        }

        // =============================
        // ÉTAPE 2: VALIDATION PRÉLIMINAIRE
        // =============================

        // Convertir applicationFee en number si c'est une string
        const numericFee =
          typeof applicationFee === 'string'
            ? parseFloat(applicationFee)
            : applicationFee;

        // Vérifier que applicationId et applicationFee sont valides
        if (!isValidUUID(applicationId)) {
          return {
            success: false,
            message: "ID d'application invalide.",
            code: 'INVALID_APPLICATION_ID',
          };
        }

        if (!isValidAmount(numericFee)) {
          return {
            success: false,
            message: 'Montant invalide.',
            code: 'INVALID_AMOUNT',
          };
        }

        // =============================
        // ÉTAPE 3: PRÉPARATION ET SANITIZATION
        // =============================

        // Par :
        const rawData = prepareOrderDataFromFormData(
          formData,
          applicationId,
          numericFee,
        );

        // Détection précoce d'injection
        const dataString = JSON.stringify(rawData);
        if (hasInjectionAttempt(dataString)) {
          captureException(new Error('Injection attempt detected'), {
            tags: { component: 'order_actions', severity: 'high' },
            extra: { applicationId },
          });

          return {
            success: false,
            message: 'Données suspectes détectées.',
            code: 'SECURITY_VIOLATION',
          };
        }

        // Sanitization
        const sanitizationResult = sanitizeOrderData(rawData);
        if (!sanitizationResult.success) {
          return {
            success: false,
            message:
              'Données invalides: ' +
              (sanitizationResult.issues?.join(', ') || 'Erreur'),
            code: 'SANITIZATION_FAILED',
          };
        }

        // =============================
        // ÉTAPE 4: VALIDATION YUP
        // =============================

        const yupValidation = await validateOrderServer(
          sanitizationResult.sanitized,
        );

        if (!yupValidation.success) {
          return {
            success: false,
            message:
              'Validation échouée: ' +
              formatValidationErrors(yupValidation.errors),
            code: 'VALIDATION_FAILED',
            errors: yupValidation.errors,
          };
        }

        // =============================
        // ÉTAPE 5: VALIDATION MÉTIER
        // =============================

        const businessRulesValidation = validateBusinessRules(
          yupValidation.data,
        );
        if (!businessRulesValidation.valid) {
          return {
            success: false,
            message:
              'Critères métier non respectés: ' +
              businessRulesValidation.violations.join(', '),
            code: 'BUSINESS_RULES_FAILED',
          };
        }

        // =============================
        // ÉTAPE 6: VÉRIFICATION DE SÉCURITÉ FINALE
        // =============================

        const safetyCheck = validateSanitizedDataSafety(yupValidation.data);
        if (!safetyCheck.safe) {
          captureException(new Error('Security check failed'), {
            tags: { component: 'order_actions', severity: 'critical' },
            extra: { threats: safetyCheck.threats },
          });

          return {
            success: false,
            message: 'Erreur de sécurité détectée.',
            code: 'SAFETY_CHECK_FAILED',
          };
        }

        // =============================
        // ÉTAPE 7: INSERTION EN BASE DE DONNÉES
        // =============================

        client = await getClient();
        await client.query('BEGIN');

        let appCheck, platformCheck, insertResult;
        try {
          appCheck = await withTimeout(
            client.query(
              'SELECT application_name, application_fee FROM catalog.applications WHERE application_id = $1 AND is_active = true',
              [yupValidation.data.applicationId],
            ),
            5000,
            'Application check timeout',
          );

          if (appCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return {
              success: false,
              message: "L'application sélectionnée n'est pas disponible.",
              code: 'APPLICATION_NOT_FOUND',
            };
          }

          const platformIds = [...new Set(yupValidation.data.paymentMethods)];
          platformCheck = await withTimeout(
            client.query(
              `SELECT platform_id, platform_name, is_cash_payment
                FROM admin.platforms
                WHERE platform_id = ANY($1) AND is_active = true`,
              [platformIds],
            ),
            5000,
            'Platform check timeout',
          );

          if (platformCheck.rows.length !== platformIds.length) {
            await client.query('ROLLBACK');
            return {
              success: false,
              message:
                'Une ou plusieurs méthodes de paiement ne sont pas disponibles.',
              code: 'PLATFORM_NOT_FOUND',
            };
          }

          const expectedFee = parseFloat(appCheck.rows[0].application_fee);
          if (
            Math.abs(yupValidation.data.applicationFee - expectedFee) > 0.01
          ) {
            await client.query('ROLLBACK');
            captureException(new Error('Price manipulation attempt'), {
              tags: { component: 'order_actions', severity: 'high' },
              extra: {
                expected: expectedFee,
                received: yupValidation.data.applicationFee,
              },
            });
            return {
              success: false,
              message: 'Erreur de montant. Veuillez actualiser la page.',
              code: 'PRICE_MISMATCH',
            };
          }

          insertResult = await withTimeout(
            client.query(
              `INSERT INTO admin.orders (
                order_client_name,
                order_client_email,
                order_client_phone,
                order_platform_ids,
                order_application_id,
                order_price,
                order_payment_status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING order_id, order_created, order_payment_status`,
              [
                yupValidation.data.name,
                yupValidation.data.email,
                yupValidation.data.phone,
                platformIds,
                yupValidation.data.applicationId,
                yupValidation.data.applicationFee,
                'unpaid',
              ],
            ),
            5000,
            'Order insert timeout',
          );

          await client.query('COMMIT');
        } catch (txError) {
          await client.query('ROLLBACK');
          throw txError;
        }

        const newOrder = insertResult?.rows[0];
        const hasCashPayment = platformCheck.rows.some(
          (p) => p.is_cash_payment,
        );
        const platformNames = platformCheck.rows.map((p) => p.platform_name);

        if (!newOrder?.order_id) {
          return {
            success: false,
            message: 'Erreur lors de la création de la commande.',
            code: 'INSERT_FAILED',
          };
        }

        // Log du temps de traitement
        const processingTime = Date.now() - startTime;
        if (processingTime > 5000) {
          captureMessage('Slow order creation', {
            level: 'warning',
            tags: { component: 'order_actions', operation: 'create_order' },
            extra: { processingTime, orderId: newOrder.order_id },
          });
        }

        return {
          success: true,
          message: 'Commande créée avec succès',
          orderId: newOrder.order_id,
          orderDetails: {
            id: newOrder.order_id,
            status: newOrder.order_payment_status,
            created: newOrder.order_created,
            applicationName: appCheck.rows[0].application_name,
            amount: yupValidation.data.applicationFee,
            platforms: platformNames,
            hasCashPayment,
          },
        };
      } catch (error) {
        // =============================
        // GESTION D'ERREURS ROBUSTE
        // =============================

        // Log détaillé de l'erreur
        captureException(error, {
          tags: { component: 'order_actions', operation: 'create_order' },
          extra: {
            processingTime: Date.now() - startTime,
            errorCode: error.code,
          },
        });

        // Messages d'erreur contextualisés
        let errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
        let errorCode = 'SYSTEM_ERROR';

        // Erreurs de base de données
        if (error.code === '23505') {
          // Duplicate key
          errorMessage = 'Cette commande existe déjà.';
          errorCode = 'DUPLICATE_ORDER';
        } else if (error.code === '23503') {
          // Foreign key violation
          errorMessage = 'Référence invalide. Veuillez actualiser la page.';
          errorCode = 'INVALID_REFERENCE';
        } else if (error.code === '23514') {
          // Check constraint violation
          errorMessage = 'Données invalides détectées.';
          errorCode = 'CONSTRAINT_VIOLATION';
        } else if (/timeout|timed out/i.test(error.message)) {
          errorMessage = 'Délai dépassé. Veuillez réessayer.';
          errorCode = 'TIMEOUT';
        } else if (/connection|pool/i.test(error.message)) {
          errorMessage = 'Problème de connexion. Veuillez patienter.';
          errorCode = 'CONNECTION_ERROR';
        } else if (error.name === 'ValidationError') {
          errorMessage = 'Erreur de validation des données.';
          errorCode = 'VALIDATION_ERROR';
        }

        return {
          success: false,
          message: errorMessage,
          code: errorCode,
          error:
            process.env.NODE_ENV === 'production' ? undefined : error.message,
        };
      } finally {
        // =============================
        // NETTOYAGE
        // =============================
        if (client) {
          try {
            await client.release();
          } catch (releaseError) {
            captureException(releaseError, {
              tags: { component: 'order_actions', operation: 'client_release' },
            });
          }
        }
      }
    },
  );
}

// =============================
// CRÉATION DEPUIS OBJET
// =============================

/**
 * Crée une commande depuis un objet (fallback)
 * @param {Object} data - Données de commande
 * @returns {Promise<Object>}
 */
export async function createOrderFromObject(data) {
  if (!data || typeof data !== 'object') {
    return {
      success: false,
      message: 'Données manquantes.',
      code: 'INVALID_DATA',
    };
  }

  if (!data.applicationId || !data.applicationFee) {
    return {
      success: false,
      message: 'Données de commande incomplètes.',
      code: 'MISSING_FIELDS',
    };
  }

  try {
    const formData = new FormData();

    ['name', 'email', 'phone'].forEach((field) => {
      if (data[field] !== undefined && data[field] !== null) {
        formData.append(field, String(data[field]));
      }
    });

    // paymentMethods est un tableau — append chaque ID séparément
    const paymentMethods = Array.isArray(data.paymentMethods)
      ? data.paymentMethods
      : [];
    paymentMethods.forEach((id) => formData.append('paymentMethods', id));
    formData.append('hasCashPayment', String(Boolean(data.hasCashPayment)));

    return await createOrder(formData, data.applicationId, data.applicationFee);
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'order_actions',
        operation: 'create_order_from_object',
      },
    });

    return {
      success: false,
      message: 'Erreur lors du traitement des données.',
      code: 'OBJECT_CONVERSION_ERROR',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    };
  }
}

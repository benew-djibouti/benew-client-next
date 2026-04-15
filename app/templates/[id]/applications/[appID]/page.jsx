// app/templates/[id]/applications/[appID]/page.jsx
// ✅ SERVER COMPONENT OPTIMISÉ POUR 500 USERS/DAY
// ✅ Next.js 15 + PostgreSQL + Sécurité renforcée + Performance maximale

import { Suspense, cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import SingleApplication from '@/components/templates/SingleApplication';
import { getClient } from '@/backend/dbConnect';
import {
  captureException,
  captureMessage,
} from '../../../../../sentry.server.config';
import { sanitizeAndValidateUUID } from '@/utils/validation';
import Loading from './loading';
import ReloadButton from '@/components/reloadButton';

// =============================
// ✅ CONFIGURATION OPTIMISÉE
// =============================
const CONFIG = {
  cache: {
    revalidate: 300, // 5 minutes ISR
    errorRevalidate: 60, // 1 minute pour erreurs
  },
  performance: {
    slowQueryThreshold: 1000, // Alerte si > 1s
    queryTimeout: 5000, // Timeout 5s (réduit de 8s)
  },
  retry: {
    maxAttempts: 2,
    baseDelay: 100,
  },
};

// =============================
// ✅ TYPES D'ERREURS
// =============================
const ERROR_TYPES = {
  NOT_FOUND: 'not_found',
  DATABASE_ERROR: 'database_error',
  TIMEOUT: 'timeout',
  CONNECTION_ERROR: 'connection_error',
  VALIDATION_ERROR: 'validation_error',
  UNKNOWN_ERROR: 'unknown_error',
};

// =============================
// ✅ CODES ERREURS POSTGRESQL
// =============================
const PG_ERROR_CODES = {
  CONNECTION_FAILURE: '08001',
  CONNECTION_EXCEPTION: '08000',
  QUERY_CANCELED: '57014',
  UNDEFINED_TABLE: '42P01',
  INSUFFICIENT_PRIVILEGE: '42501',
};

/**
 * ✅ Classification intelligente des erreurs
 */
function classifyError(error) {
  if (!error) {
    return {
      type: ERROR_TYPES.UNKNOWN_ERROR,
      shouldRetry: false,
      httpStatus: 500,
    };
  }

  const code = error.code;
  const message = error.message?.toLowerCase() || '';

  // Erreurs de connexion (temporaires)
  if (
    [
      PG_ERROR_CODES.CONNECTION_FAILURE,
      PG_ERROR_CODES.CONNECTION_EXCEPTION,
    ].includes(code)
  ) {
    return {
      type: ERROR_TYPES.CONNECTION_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'Service temporairement indisponible.',
    };
  }

  // Timeout
  if (code === PG_ERROR_CODES.QUERY_CANCELED || message.includes('timeout')) {
    return {
      type: ERROR_TYPES.TIMEOUT,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'La requête a pris trop de temps.',
    };
  }

  // Application non trouvée
  if (
    message.includes('not found') ||
    message.includes('introuvable') ||
    message.includes('application not found')
  ) {
    return {
      type: ERROR_TYPES.NOT_FOUND,
      shouldRetry: false,
      httpStatus: 404,
      userMessage: 'Application introuvable.',
    };
  }

  // Erreur générique
  return {
    type: ERROR_TYPES.DATABASE_ERROR,
    shouldRetry: false,
    httpStatus: 500,
    userMessage: 'Erreur lors du chargement.',
  };
}

/**
 * ✅ Promise avec timeout
 */
function withTimeout(promise, timeoutMs, errorMessage = 'Timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error(errorMessage);
        timeoutError.name = 'TimeoutError';
        reject(timeoutError);
      }, timeoutMs);
    }),
  ]);
}

/**
 * ✅ Retry logic avec backoff exponentiel
 */
async function executeWithRetry(
  operation,
  maxAttempts = CONFIG.retry.maxAttempts,
) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorInfo = classifyError(error);

      if (!errorInfo.shouldRetry || attempt === maxAttempts) {
        throw error;
      }

      const delay = CONFIG.retry.baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      captureMessage(
        `Retry application fetch (attempt ${attempt}/${maxAttempts})`,
        {
          level: 'info',
          tags: { component: 'single_application', retry: true },
          extra: { attempt, maxAttempts, errorType: errorInfo.type },
        },
      );
    }
  }

  throw lastError;
}

/**
 * ✅ Validation robuste des IDs
 */
function validateIds(appId, templateId) {
  const cleanApplicationId = sanitizeAndValidateUUID(appId);
  if (!cleanApplicationId) {
    return {
      isValid: false,
      error: 'Application ID invalide',
      field: 'applicationId',
      errorType: ERROR_TYPES.VALIDATION_ERROR,
    };
  }

  const cleanTemplateId = sanitizeAndValidateUUID(templateId);
  if (!cleanTemplateId) {
    return {
      isValid: false,
      error: 'Template ID invalide',
      field: 'templateId',
      errorType: ERROR_TYPES.VALIDATION_ERROR,
    };
  }

  return {
    isValid: true,
    applicationId: cleanApplicationId,
    templateId: cleanTemplateId,
  };
}

/**
 * ✅ FONCTION PRINCIPALE OPTIMISÉE
 * Récupère les données de l'application avec performance et sécurité maximales
 */
const getApplicationData = cache(
  async function getApplicationData(applicationId, templateId) {
    const startTime = performance.now();

    try {
      return await executeWithRetry(async () => {
        const client = await getClient();

        try {
          // ✅ QUERY OPTIMISÉE - Une seule requête avec tous les JOIN nécessaires
          const queryPromise = client.query(
            `SELECT
            -- ✅ Application complète
            a.application_id,
            a.application_name,
            a.application_link,
            a.application_admin_link,
            a.application_description,
            a.application_category,
            a.application_fee,
            a.application_rent,
            a.application_images,
            a.application_other_versions,
            a.application_level,
            a.sales_count as application_sales,

            -- ✅ Template parent
            t.template_id,
            t.template_name,

            -- ✅ Stats template
            (SELECT COUNT(*)
             FROM catalog.applications
             WHERE application_template_id = t.template_id
               AND is_active = true
            ) as template_total_applications,

            -- ✅ Plateformes de paiement (JSON aggregation avec toutes les colonnes)
            (SELECT COALESCE(json_agg(
              json_build_object(
                'platform_id', p.platform_id,
                'platform_name', p.platform_name,
                'is_cash_payment', COALESCE(p.is_cash_payment, false),
                'account_name', p.account_name,
                'account_number', p.account_number,
                'description', p.description
              ) ORDER BY p.platform_name ASC
            ), '[]'::json)
             FROM admin.platforms p
             WHERE p.is_active = true
            ) as platforms

          FROM catalog.applications a
          JOIN catalog.templates t
            ON a.application_template_id = t.template_id
          WHERE a.application_id = $1
            AND a.application_template_id = $2
            AND a.is_active = true
            AND t.is_active = true`,
            [applicationId, templateId],
          );

          const result = await withTimeout(
            queryPromise,
            CONFIG.performance.queryTimeout,
            'Database query timeout',
          );

          const queryDuration = performance.now() - startTime;

          // ✅ Log performance si lent
          if (queryDuration > CONFIG.performance.slowQueryThreshold) {
            captureMessage('Slow application query', {
              level: 'warning',
              tags: { component: 'single_application', performance: true },
              extra: {
                applicationId,
                templateId,
                duration: queryDuration,
                timeout: CONFIG.performance.queryTimeout,
              },
            });
          }

          // ✅ Log succès en dev
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[Application] Query: ${Math.round(queryDuration)}ms (timeout: ${CONFIG.performance.queryTimeout}ms)`,
            );
          }

          // ✅ Application non trouvée
          if (result.rows.length === 0) {
            return {
              application: null,
              template: null,
              platforms: [],
              success: false,
              errorType: ERROR_TYPES.NOT_FOUND,
              httpStatus: 404,
              userMessage: 'Application introuvable.',
            };
          }

          const data = result.rows[0];

          // ✅ Parse JSON aggregations
          const parseJsonAgg = (value) => {
            if (Array.isArray(value)) return value; // driver a déjà parsé → tableau JS
            if (typeof value === 'string') {
              try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : []; // string JSON → parser
              } catch {
                return []; // JSON invalide → tableau vide
              }
            }
            return []; // null, undefined, objet inattendu
          };

          const platforms = parseJsonAgg(data.platforms);

          // ✅ Construire l'objet application
          const application = {
            application_id: data.application_id,
            application_name: data.application_name,
            application_link: data.application_link,
            application_admin_link: data.application_admin_link,
            application_description: data.application_description,
            application_category: data.application_category,
            application_fee: data.application_fee,
            application_rent: data.application_rent,
            application_images: data.application_images,
            application_other_versions: data.application_other_versions,
            application_level: data.application_level,
            application_sales: data.application_sales,
          };

          const template = {
            template_id: data.template_id,
            template_name: data.template_name,
            template_total_applications: data.template_total_applications,
          };

          // ✅ Succès
          return {
            application,
            template,
            platforms,
            success: true,
            queryDuration,
          };
        } finally {
          client.release();
        }
      });
    } catch (error) {
      const errorInfo = classifyError(error);
      const queryDuration = performance.now() - startTime;

      // ✅ Log erreur détaillé
      captureException(error, {
        tags: {
          component: 'single_application',
          error_type: errorInfo.type,
          should_retry: errorInfo.shouldRetry.toString(),
          http_status: errorInfo.httpStatus.toString(),
        },
        extra: {
          applicationId,
          templateId,
          queryDuration,
          pgErrorCode: error.code,
          errorMessage: error.message,
        },
      });

      return {
        application: null,
        template: null,
        platforms: [],
        success: false,
        errorType: errorInfo.type,
        httpStatus: errorInfo.httpStatus,
        userMessage: errorInfo.userMessage,
        shouldRetry: errorInfo.shouldRetry,
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      };
    }
  },
);

/**
 * ✅ Composant d'erreur réutilisable
 */

/**
 * Composant d'erreur pour les pannes DB/timeout sur SingleApplicationPage.
 * Rendu côté serveur — pas de 'use client'.
 *
 * Architecture :
 * - <Link> utilisé à la place de <a> pour la navigation côté client Next.js
 * - <ReloadButton> est un Client Component ('use client') importé ici intentionnellement.
 *   Il crée un boundary client minimal autour du bouton reload uniquement.
 *   Le reste du composant reste Server-rendered HTML statique.
 *   Voir : components/reloadButton/index.jsx
 */
function ApplicationError({
  errorType,
  userMessage,
  shouldRetry,
  templateId,
  applicationId,
}) {
  return (
    <div className="application-error-page">
      <section className="first">
        <div className="error-content">
          {errorType === ERROR_TYPES.NOT_FOUND ? (
            <div className="not-found-error">
              <div className="error-icon">🔍</div>
              <h1 className="error-code">404</h1>
              <h2 className="error-title">Application introuvable</h2>
              <p className="error-message">
                L&apos;application demandée n&apos;existe pas ou a été
                supprimée.
              </p>
              <div className="error-actions">
                <Link
                  href={`/templates/${templateId}`}
                  className="cta-button primary"
                >
                  🔙 Retour au template
                </Link>
                <Link href="/templates" className="cta-button secondary">
                  📋 Tous les templates
                </Link>
                <Link href="/" className="cta-button outline">
                  🏠 Accueil
                </Link>
              </div>
            </div>
          ) : (
            <div className="server-error">
              <div className="error-icon">
                {errorType === ERROR_TYPES.TIMEOUT ? '⏱️' : '⚠️'}
              </div>
              <h1 className="error-code">
                {errorType === ERROR_TYPES.TIMEOUT ? '503' : '500'}
              </h1>
              <h2 className="error-title">
                {shouldRetry ? 'Erreur temporaire' : 'Erreur technique'}
              </h2>
              <p className="error-message">{userMessage}</p>
              <div className="error-actions">
                {shouldRetry && <ReloadButton className="cta-button primary" />}
                <Link
                  href={`/templates/${templateId}`}
                  className="cta-button secondary"
                >
                  🔙 Retour
                </Link>
                <Link href="/templates" className="cta-button outline">
                  📋 Templates
                </Link>
              </div>
            </div>
          )}

          {process.env.NODE_ENV === 'development' && (
            <div className="debug-section">
              <details className="debug-details">
                <summary>Debug</summary>
                <div className="debug-content">
                  <p>
                    <strong>Type:</strong> {errorType}
                  </p>
                  <p>
                    <strong>App ID:</strong> {applicationId}
                  </p>
                  <p>
                    <strong>Template ID:</strong> {templateId}
                  </p>
                  <p>
                    <strong>Retry:</strong> {shouldRetry ? 'Oui' : 'Non'}
                  </p>
                </div>
              </details>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * ✅ COMPOSANT PRINCIPAL - Page Server Component
 */
export default async function SingleApplicationPage({ params }) {
  const { id: templateId, appID: appId } = await params;

  // ✅ Validation robuste
  const validation = validateIds(appId, templateId);
  if (!validation.isValid) {
    captureMessage('Invalid ID format', {
      level: 'info',
      tags: { component: 'single_application', validation: true },
      extra: {
        rawAppId: appId,
        rawTemplateId: templateId,
        validationError: validation.error,
      },
    });

    notFound();
  }

  // ✅ Récupérer les données
  const data = await getApplicationData(
    validation.applicationId,
    validation.templateId,
  );

  // ✅ Gestion des erreurs
  if (!data.success) {
    if (data.errorType === ERROR_TYPES.NOT_FOUND) {
      notFound();
    }

    return (
      <ApplicationError
        errorType={data.errorType}
        userMessage={data.userMessage}
        shouldRetry={data.shouldRetry}
        templateId={validation.templateId}
        applicationId={validation.applicationId}
      />
    );
  }

  if (!data.application) {
    notFound();
  }

  // ✅ Rendu avec Suspense
  return (
    <Suspense fallback={<Loading />}>
      <SingleApplication
        application={data.application}
        template={data.template}
        platforms={data.platforms}
        context={{
          templateId: validation.templateId,
          applicationId: validation.applicationId,
        }}
      />
    </Suspense>
  );
}

/**
 * ✅ METADATA OPTIMISÉE
 */
// Remplace toute la fonction generateMetadata par :
export async function generateMetadata({ params }) {
  const { id: templateId, appID: appId } = await params;

  const validation = validateIds(appId, templateId);
  if (!validation.isValid) {
    return {
      title: 'Application non trouvée - Benew',
      description: "L'application demandée n'existe pas.",
      robots: { index: false, follow: false },
    };
  }

  // Réutilise getApplicationData — résultat en cache si SingleApplicationPage
  // s'est exécuté avant, sinon exécute la requête et met en cache pour lui
  const data = await getApplicationData(
    validation.applicationId,
    validation.templateId,
  );

  if (!data.success || !data.application) {
    return {
      title: 'Application - Benew',
      description: 'Découvrez cette application sur Benew.',
      openGraph: {
        title: 'Application Benew',
        url: `/templates/${validation.templateId}/applications/${validation.applicationId}`,
      },
    };
  }

  const { application, template } = data;

  return {
    title: `${application.application_name} - ${template.template_name} | Benew`,
    description:
      application.application_description ||
      `Découvrez ${application.application_name} sur Benew.`,
    keywords: [
      application.application_name,
      template.template_name,
      application.application_category,
      'e-commerce',
      'Benew',
      'Djibouti',
    ],
    openGraph: {
      title: `${application.application_name} - ${template.template_name}`,
      description:
        application.application_description ||
        `Application ${application.application_name}.`,
      images:
        application.application_images?.length > 0
          ? [application.application_images[0]]
          : [],
      url: `/templates/${validation.templateId}/applications/${validation.applicationId}`,
    },
    alternates: {
      canonical: `/templates/${validation.templateId}/applications/${validation.applicationId}`,
    },
  };
}

// ✅ Configuration ISR Next.js 15
export const revalidate = 300;

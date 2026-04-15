// app/templates/[id]/page.jsx
// ✅ MODIFICATION 1: Fusion Query 1 + Query 2 (pas Query 3 platforms)

import { Suspense, cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import SingleTemplateShops from '@/components/templates/SingleTemplateShops';
import { getClient } from '@/backend/dbConnect';
import {
  captureException,
  captureMessage,
} from '../../../sentry.server.config';
import { sanitizeAndValidateUUID } from '@/utils/validation';
import Loading from './loading';
import ReloadButton from '@/components/reloadButton';

// =============================
// CONFIGURATION
// =============================
const CONFIG = {
  cache: {
    revalidate: 300,
    errorRevalidate: 60,
  },
  performance: {
    slowQueryThreshold: 1000,
    queryTimeout: 8000,
  },
  retry: {
    maxAttempts: 2,
    baseDelay: 100,
  },
};

// =============================
// TYPES D'ERREURS
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
// CODES ERREURS POSTGRESQL
// =============================
const PG_ERROR_CODES = {
  CONNECTION_FAILURE: '08001',
  CONNECTION_EXCEPTION: '08000',
  QUERY_CANCELED: '57014',
  UNDEFINED_TABLE: '42P01',
  INSUFFICIENT_PRIVILEGE: '42501',
};

/**
 * Classification des erreurs
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

  if (code === PG_ERROR_CODES.QUERY_CANCELED || message.includes('timeout')) {
    return {
      type: ERROR_TYPES.TIMEOUT,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'La requête a pris trop de temps.',
    };
  }

  if (
    message.includes('not found') ||
    message.includes('introuvable') ||
    message.includes('template not found')
  ) {
    return {
      type: ERROR_TYPES.NOT_FOUND,
      shouldRetry: false,
      httpStatus: 404,
      userMessage: 'Template introuvable.',
    };
  }

  return {
    type: ERROR_TYPES.DATABASE_ERROR,
    shouldRetry: false,
    httpStatus: 500,
    userMessage: 'Erreur lors du chargement.',
  };
}

/**
 * Promise avec timeout
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
 * Retry logic avec backoff exponentiel
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
        `Retry template fetch (attempt ${attempt}/${maxAttempts})`,
        {
          level: 'info',
          tags: { component: 'single_template', retry: true },
          extra: { attempt, maxAttempts, errorType: errorInfo.type },
        },
      );
    }
  }

  throw lastError;
}

/**
 * Validation robuste de l'ID
 */
function validateTemplateId(templateId) {
  const cleanTemplateId = sanitizeAndValidateUUID(templateId);
  if (!cleanTemplateId) {
    return {
      isValid: false,
      error: 'Template ID invalide',
      errorType: ERROR_TYPES.VALIDATION_ERROR,
    };
  }

  return {
    isValid: true,
    templateId: cleanTemplateId,
  };
}

/**
 * ✅ MODIFICATION 1: FUSION Query 1 + Query 2 en une seule requête
 * Récupère template + applications en un seul appel
 */
const getTemplateData = cache(async function getTemplateData(templateId) {
  const startTime = performance.now();

  try {
    return await executeWithRetry(async () => {
      const client = await getClient();

      try {
        // ✅ QUERY FUSIONNÉE - Template + Applications en un seul LEFT JOIN
        const queryPromise = client.query(
          `SELECT
            -- Template info
            t.template_id,
            t.template_name,

            -- Applications (peut être NULL si pas d'apps)
            a.application_id,
            a.application_name,
            a.application_category,
            a.application_fee,
            a.application_rent,
            a.application_images,
            a.application_other_versions,
            a.application_level,
            a.sales_count

          FROM catalog.templates t
          LEFT JOIN catalog.applications a
            ON a.application_template_id = t.template_id
            AND a.is_active = true
          WHERE t.template_id = $1
            AND t.is_active = true
          ORDER BY a.application_level ASC, a.created_at DESC`,
          [templateId],
        );

        // Query platforms séparée (comme avant)
        const platformsQueryPromise = client.query(
          `SELECT platform_id, platform_name, account_name, account_number, is_cash_payment, description
           FROM admin.platforms
           WHERE is_active = true
           ORDER BY CASE WHEN is_cash_payment = true THEN 0 ELSE 1 END, platform_name ASC`,
        );

        const [result, platformsResult] = await Promise.all([
          withTimeout(
            queryPromise,
            CONFIG.performance.queryTimeout,
            'Database query timeout',
          ),
          withTimeout(
            platformsQueryPromise,
            CONFIG.performance.queryTimeout,
            'Platforms query timeout',
          ),
        ]);

        const queryDuration = performance.now() - startTime;

        if (queryDuration > CONFIG.performance.slowQueryThreshold) {
          captureMessage('Slow template query', {
            level: 'warning',
            tags: { component: 'single_template', performance: true },
            extra: {
              templateId,
              duration: queryDuration,
              timeout: CONFIG.performance.queryTimeout,
            },
          });
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[Template] Query: ${Math.round(queryDuration)}ms (timeout: ${CONFIG.performance.queryTimeout}ms)`,
          );
        }

        // Template non trouvé
        if (result.rows.length === 0) {
          return {
            template: null,
            applications: [],
            platforms: [],
            success: false,
            errorType: ERROR_TYPES.NOT_FOUND,
            httpStatus: 404,
            userMessage: 'Template introuvable.',
          };
        }

        // Extraire template (première ligne)
        const firstRow = result.rows[0];
        const template = {
          template_id: firstRow.template_id,
          template_name: firstRow.template_name,
        };

        // Extraire applications (si application_id != null)
        const applications = result.rows
          .filter((row) => row.application_id !== null)
          .map((row) => ({
            application_id: row.application_id,
            application_name: row.application_name,
            application_category: row.application_category,
            application_fee: row.application_fee,
            application_rent: row.application_rent,
            application_images: row.application_images,
            application_other_versions: row.application_other_versions,
            application_level: row.application_level,
            sales_count: row.sales_count,
          }));

        const platforms = platformsResult.rows;

        return {
          template,
          applications,
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

    captureException(error, {
      tags: {
        component: 'single_template',
        error_type: errorInfo.type,
        should_retry: errorInfo.shouldRetry.toString(),
        http_status: errorInfo.httpStatus.toString(),
      },
      extra: {
        templateId,
        queryDuration,
        pgErrorCode: error.code,
        errorMessage: error.message,
      },
    });

    return {
      template: null,
      applications: [],
      platforms: [],
      success: false,
      errorType: errorInfo.type,
      httpStatus: errorInfo.httpStatus,
      userMessage: errorInfo.userMessage,
      shouldRetry: errorInfo.shouldRetry,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }
});

/**
 * Composant d'erreur réutilisable
 */
function TemplateError({ errorType, userMessage, shouldRetry, templateId }) {
  return (
    <div className="template-error-page">
      <section className="first">
        <div className="error-content">
          {errorType === ERROR_TYPES.NOT_FOUND ? (
            <div className="not-found-error">
              <div className="error-icon">🔍</div>
              <h1 className="error-code">404</h1>
              <h2 className="error-title">Template introuvable</h2>
              <p className="error-message">
                Le template demandé n&apos;existe pas ou a été supprimé.
              </p>
              <div className="error-actions">
                <Link href="/templates" className="cta-button primary">
                  📋 Tous les templates
                </Link>
                <Link href="/" className="cta-button secondary">
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
                <Link href="/templates" className="cta-button secondary">
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
 * Composant principal
 */
export default async function SingleTemplatePage({ params }) {
  const { id: templateId } = await params;

  const validation = validateTemplateId(templateId);
  if (!validation.isValid) {
    captureMessage('Invalid template ID format', {
      level: 'info',
      tags: { component: 'single_template', validation: true },
      extra: {
        rawTemplateId: templateId,
        validationError: validation.error,
      },
    });

    notFound();
  }

  const data = await getTemplateData(validation.templateId);

  if (!data.success) {
    if (data.errorType === ERROR_TYPES.NOT_FOUND) {
      notFound();
    }

    return (
      <TemplateError
        errorType={data.errorType}
        userMessage={data.userMessage}
        shouldRetry={data.shouldRetry}
        templateId={validation.templateId}
      />
    );
  }

  if (!data.template) {
    notFound();
  }

  return (
    <Suspense fallback={<Loading />}>
      <SingleTemplateShops
        templateID={templateId}
        applications={data.applications}
        template={data.template}
        platforms={data.platforms}
      />
    </Suspense>
  );
}

/**
 * Metadata
 */
export async function generateMetadata({ params }) {
  const { id: templateId } = await params;

  const validation = validateTemplateId(templateId);
  if (!validation.isValid) {
    return {
      title: 'Template non trouvé - Benew',
      description: "Le template demandé n'existe pas.",
      robots: { index: false, follow: false },
    };
  }

  // Réutilise getTemplateData — déjà en cache si SingleTemplatePage s'est exécuté avant
  // Ou exécute la requête si generateMetadata s'exécute en premier — résultat mis en cache
  const data = await getTemplateData(validation.templateId);

  if (!data.success || !data.template) {
    return {
      title: 'Template - Benew',
      description: 'Découvrez ce template sur Benew.',
    };
  }

  const template = data.template;

  return {
    title: `${template.template_name} - Templates | Benew`,
    description: `Découvrez les applications basées sur ${template.template_name} sur Benew.`,
    keywords: [
      template.template_name,
      'template',
      'applications',
      'e-commerce',
      'Benew',
      'Djibouti',
    ],
    openGraph: {
      title: `${template.template_name} - Applications`,
      description: `Explorez les applications du template ${template.template_name}.`,
      images:
        data.applications?.[0]?.application_images?.length > 0
          ? [data.applications[0].application_images[0]]
          : [],
      url: `/templates/${validation.templateId}`,
    },
    alternates: {
      canonical: `/templates/${validation.templateId}`,
    },
  };
}

export const revalidate = 300;

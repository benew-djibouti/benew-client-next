// app/templates/page.jsx
// Server Component optimisé pour liste des templates e-commerce
// Next.js 15 + PostgreSQL + Monitoring complet + Gestion d'erreurs avancée + Query Timeout

import { Suspense } from 'react';
import Link from 'next/link';

import TemplatesList from '@/components/templates/TemplatesList';
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../../sentry.server.config';
import Loading from './loading';
import ReloadButton from '@/components/reloadButton';
import { classifyError, ERROR_TYPES } from '@/utils/errorUtils';
import { withTimeout, executeWithRetry } from '@/utils/asyncUtils';

// Configuration étendue avec gestion d'erreurs avancée
const CONFIG = {
  performance: {
    slowQueryThreshold: 1500, // Alerte pour queries lentes
    queryTimeout: 5000, // 5 secondes timeout
  },
  retry: {
    maxAttempts: 2,
    baseDelay: 100,
  },
};

/**
 * Fonction principale avec gestion d'erreurs avancée et retry
 */
async function getTemplates() {
  const startTime = Date.now();

  try {
    return await executeWithRetry(
      async () => {
        const client = await getClient();

        try {
          // Query avec timeout intégré - ✅ CORRIGÉ: template_images (pluriel)
          const queryPromise = client.query(`
          SELECT
            t.template_id,
            t.template_name,
            t.template_images,
            t.template_has_web,
            t.template_has_mobile,
            COUNT(a.application_id) as applications_count
          FROM catalog.templates t
          LEFT JOIN catalog.applications a
            ON a.application_template_id = t.template_id
            AND a.is_active = true
          WHERE t.is_active = true
          GROUP BY
            t.template_id,
            t.template_name,
            t.template_images,
            t.template_has_web,
            t.template_has_mobile
          ORDER BY t.template_added DESC
        `);

          const result = await withTimeout(
            queryPromise,
            CONFIG.performance.queryTimeout,
            'Database query timeout',
          );

          const queryDuration = Date.now() - startTime;

          // Log performance avec monitoring complet
          if (queryDuration > CONFIG.performance.slowQueryThreshold) {
            captureMessage('Slow templates query detected', {
              level: 'warning',
              tags: {
                component: 'templates_page',
                performance: true,
              },
              extra: {
                duration: queryDuration,
                templatesCount: result.rows.length,
                queryTimeout: CONFIG.performance.queryTimeout,
              },
            });
          }

          // Log de succès en dev
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[Templates] Query exécutée en ${Math.round(queryDuration)}ms (timeout: ${CONFIG.performance.queryTimeout}ms)`,
            );
          }

          // Succès
          return {
            templates: result.rows,
            success: true,
            queryDuration,
          };
        } finally {
          client.release();
        }
      },
      CONFIG.retry.maxAttempts,
      CONFIG.retry.baseDelay,
      classifyError,
    );
  } catch (error) {
    const errorInfo = classifyError(error);
    const queryDuration = Date.now() - startTime;

    // Log détaillé pour monitoring avec tous les contextes
    captureException(error, {
      tags: {
        component: 'templates_page',
        error_type: errorInfo.type,
        should_retry: errorInfo.shouldRetry.toString(),
        http_status: errorInfo.httpStatus.toString(),
      },
      extra: {
        queryDuration,
        pgErrorCode: error.code,
        errorType: errorInfo.type,
        timeout: CONFIG.performance.queryTimeout,
      },
    });

    return {
      templates: [],
      success: false,
      errorType: errorInfo.type,
      httpStatus: errorInfo.httpStatus,
      userMessage: errorInfo.userMessage,
      shouldRetry: errorInfo.shouldRetry,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }
}

/**
 * Composant d'erreur réutilisable avec design cohérent
 */
function TemplatesError({ errorType, userMessage, shouldRetry }) {
  return (
    <div className="templates-error-page">
      <section className="first">
        <div className="error-content">
          <div className="server-error">
            <div className="error-icon">
              {errorType === ERROR_TYPES.TIMEOUT
                ? '⏱️'
                : errorType === ERROR_TYPES.IMAGE_LOADING_ERROR
                  ? '🖼️'
                  : errorType === ERROR_TYPES.NETWORK_ERROR
                    ? '🌐'
                    : '⚠️'}
            </div>
            <h1 className="error-code">
              {errorType === ERROR_TYPES.TIMEOUT ? '503' : '500'}
            </h1>
            <h2 className="error-title">
              {shouldRetry
                ? 'Service temporairement indisponible'
                : 'Erreur technique'}
            </h2>
            <p className="error-message">{userMessage}</p>
            <div className="error-actions">
              {shouldRetry && <ReloadButton className="cta-button primary" />}
              <Link href="/" className="cta-button secondary">
                🏠 Retour à l&apos;accueil
              </Link>
            </div>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="debug-section">
              <details className="debug-details">
                <summary className="debug-summary">
                  Informations de débogage
                </summary>
                <div className="debug-content">
                  <p>
                    <strong>Type d&apos;erreur:</strong> {errorType}
                  </p>
                  <p>
                    <strong>Peut réessayer:</strong>{' '}
                    {shouldRetry ? 'Oui' : 'Non'}
                  </p>
                  <p>
                    <strong>Page:</strong> templates (liste)
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
 * Composant principal avec gestion d'erreurs différenciée
 */
export default async function TemplatesPage() {
  // Récupérer les données avec gestion d'erreurs avancée
  const data = await getTemplates();

  // Gestion différenciée des erreurs
  if (!data.success) {
    return (
      <TemplatesError
        errorType={data.errorType}
        userMessage={data.userMessage}
        shouldRetry={data.shouldRetry}
      />
    );
  }

  // Cas spécial : pas de templates (valide pour e-commerce en démarrage)
  if (!data.templates || data.templates.length === 0) {
    return (
      <div className="templates-empty-state">
        <section className="first">
          <div className="empty-content">
            <div className="empty-card">
              <div className="empty-icon">📋</div>
              <h1 className="empty-title">Aucun template disponible</h1>
              <p className="empty-message">
                Nos templates sont en cours de préparation.
              </p>
              <p className="empty-submessage">
                Revenez bientôt pour découvrir notre collection de templates
                professionnels.
              </p>
              <div className="empty-actions">
                <Link href="/" className="cta-button primary">
                  🏠 Retour à l&apos;accueil
                </Link>
                <Link href="/contact" className="cta-button secondary">
                  📞 Nous contacter
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Rendu normal avec Suspense - Error Boundary géré par error.jsx
  return (
    <Suspense fallback={<Loading />}>
      <TemplatesList templates={data.templates} />
    </Suspense>
  );
}

// Metadata pour SEO e-commerce avec monitoring en cas d'erreur
export const metadata = {
  title: 'Templates - Benew | Solutions E-commerce',
  description:
    'Découvrez notre collection de templates e-commerce professionnels. Solutions complètes pour votre boutique en ligne.',
  keywords: [
    'templates e-commerce',
    'boutique en ligne',
    'solutions e-commerce',
    'templates professionnels',
    'Benew',
    'Djibouti',
  ],
  openGraph: {
    title: 'Templates E-commerce Benew',
    description:
      'Collection de templates professionnels pour votre boutique en ligne.',
    url: `/templates`,
  },
  alternates: {
    canonical: `/templates`,
  },
};

// Configuration ISR Next.js 15
export const revalidate = 300;

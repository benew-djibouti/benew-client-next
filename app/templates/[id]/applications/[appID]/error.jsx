'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import './error.scss';
// Ajouter l'import :
import * as Sentry from '@sentry/nextjs';
import { trackEvent } from '@/utils/analytics'; // ← utiliser trackEvent comme les autres, pas window.dataLayer directement

/**
 * ✅ ERROR BOUNDARY OPTIMISÉ
 * - Gestion d'erreurs robuste
 * - Retry avec backoff exponentiel
 * - Analytics tracking
 * - Production-ready pour 500 users/day
 */
export default function ApplicationDetailError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const params = useParams();
  const templateId = params?.id;
  const appId = params?.appID;
  const MAX_RETRIES = 3;

  // ✅ Tracking analytics (simple et sécurisé)

  // useEffect Sentry — capture une seule fois
  useEffect(() => {
    if (!error) return;

    Sentry.captureException(error, {
      tags: {
        component: 'application_detail_error_boundary',
        page: 'application_detail',
        error_type: 'client_side_error',
        template_id: templateId || 'unknown',
        app_id: appId || 'unknown',
      },
      extra: {
        errorName: error?.name || 'Unknown',
        errorMessage: error?.message || 'No message',
        errorStack: error?.stack?.substring(0, 500),
        templateId,
        appId,
      },
      level: 'error',
    });
  }, [error, templateId, appId]); // retryCount absent intentionnellement

  // useEffect Analytics — séparé
  useEffect(() => {
    if (!error) return;

    try {
      trackEvent('error_boundary_shown', {
        event_category: 'errors',
        event_label: 'application_detail_error',
        error_name: error?.name || 'Unknown',
        error_message: error?.message?.substring(0, 100) || 'No message',
        template_id: templateId || 'unknown',
        app_id: appId || 'unknown',
        page: 'application_detail',
      });
    } catch (analyticsError) {
      console.warn(
        '[Analytics] Error tracking error boundary:',
        analyticsError,
      );
    }
  }, [error, templateId, appId]);

  /**
   * ✅ RETRY AVEC BACKOFF EXPONENTIEL
   */
  const handleRetry = async () => {
    if (retryCount >= MAX_RETRIES || isRetrying) return;

    setIsRetrying(true);
    const currentRetry = retryCount + 1;
    setRetryCount(currentRetry);

    // Analytics
    try {
      trackEvent('error_retry_attempt', {
        event_category: 'errors',
        event_label: 'application_detail_retry',
        retry_number: currentRetry,
        template_id: templateId,
        app_id: appId,
      });
    } catch (e) {
      console.warn('[Analytics] Retry tracking failed:', e);
    }

    // ✅ Backoff exponentiel: 1s, 2s, 4s
    const delay = Math.min(1000 * Math.pow(2, retryCount), 4000);

    setTimeout(() => {
      setIsRetrying(false);
      reset();
    }, delay);
  };

  const canRetry = retryCount < MAX_RETRIES;
  const isMaxRetriesReached = retryCount >= MAX_RETRIES;

  return (
    <section className="first">
      <div className="application-detail-error">
        <div className="error-container">
          {/* Icône */}
          <div className="error-icon">⚠️</div>

          {/* Titre */}
          <h2 className="error-title">Erreur de chargement</h2>

          {/* Message */}
          <p className="error-message">
            Nous rencontrons des difficultés pour charger cette application.
            {canRetry
              ? ' Veuillez réessayer ou revenir plus tard.'
              : ' Veuillez revenir plus tard.'}
          </p>

          {/* Indicateur tentatives */}
          {retryCount > 0 && (
            <div className="retry-indicator">
              {isMaxRetriesReached ? (
                <span className="max-retries">
                  Maximum de tentatives atteint ({MAX_RETRIES})
                </span>
              ) : (
                <span className="retry-count">
                  Tentative {retryCount} / {MAX_RETRIES}
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="error-actions">
            {canRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="retry-button"
                aria-label={`Réessayer${retryCount > 0 ? ` (${MAX_RETRIES - retryCount} restantes)` : ''}`}
              >
                {isRetrying ? (
                  <>
                    <span className="spinner" aria-hidden="true"></span>
                    Nouvelle tentative...
                  </>
                ) : (
                  <>
                    🔄 Réessayer
                    {retryCount > 0 && ` (${MAX_RETRIES - retryCount})`}
                  </>
                )}
              </button>
            )}

            <Link href={`/templates/${templateId}`} className="template-button">
              🔙 Retour au template
            </Link>

            <Link href="/templates" className="templates-button">
              📋 Tous les templates
            </Link>

            <Link href="/" className="home-button">
              🏠 Accueil
            </Link>
          </div>

          {/* Aide */}
          <div className="help-text">
            <p>
              Si le problème persiste,{' '}
              <Link href="/contact" className="contact-link">
                contactez-nous
              </Link>
              .
            </p>
          </div>

          {/* Debug (dev uniquement) */}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="debug-info">
              <summary>Debug</summary>
              <div className="debug-content">
                <p>
                  <strong>Erreur:</strong> {error.name}
                </p>
                <p>
                  <strong>Message:</strong> {error.message}
                </p>
                <p>
                  <strong>Template:</strong> {templateId}
                </p>
                <p>
                  <strong>App:</strong> {appId}
                </p>
                <p>
                  <strong>Tentatives:</strong> {retryCount}/{MAX_RETRIES}
                </p>
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}

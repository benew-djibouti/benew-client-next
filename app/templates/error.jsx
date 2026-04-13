'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { trackEvent } from '@/utils/analytics';
import './error.scss';

/**
 * Error Boundary pour la page des templates
 * Intégré avec Sentry côté client et système analytics centralisé
 * Respect de la classification d'erreurs du server component
 */
export default function TemplatesError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const MAX_RETRIES = 3;

  // useEffect Sentry — se déclenche une seule fois quand error apparaît
  useEffect(() => {
    if (!error) return;

    Sentry.captureException(error, {
      tags: {
        component: 'templates_error_boundary',
        page: 'templates_list',
        error_type: 'client_side_error',
      },
      extra: {
        errorName: error?.name || 'Unknown',
        errorMessage: error?.message || 'No message',
        errorStack: error?.stack?.substring(0, 500),
        // retryCount retiré — toujours 0 ici de toute façon
      },
      level: 'error',
    });
  }, [error]); // ← uniquement error

  // useEffect Analytics — se déclenche à l'affichage initial uniquement
  useEffect(() => {
    if (!error) return;

    try {
      trackEvent('error_boundary_shown', {
        event_category: 'errors',
        event_label: 'templates_list_error',
        error_name: error?.name || 'Unknown',
        error_message: error?.message?.substring(0, 100) || 'No message',
        page: 'templates_list',
      });
    } catch (analyticsError) {
      console.warn(
        '[Analytics] Error tracking error boundary:',
        analyticsError,
      );
    }
  }, [error]); // ← uniquement error

  const handleRetry = async () => {
    if (retryCount >= MAX_RETRIES || isRetrying) return;

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    try {
      trackEvent('error_retry_attempt', {
        event_category: 'errors',
        event_label: 'templates_list_retry',
        retry_number: retryCount + 1,
        max_retries: MAX_RETRIES,
        page: 'templates_list',
      });
    } catch (error) {
      console.warn('[Analytics] Error tracking retry:', error);
    }

    const delay = Math.min(1000 * (retryCount + 1), 3000);

    setTimeout(() => {
      setIsRetrying(false);
      reset();
    }, delay);
  };

  const handleGoHome = () => {
    try {
      trackEvent('error_recovery_home', {
        event_category: 'errors',
        event_label: 'templates_list_home',
        retry_count: retryCount,
      });
    } catch (error) {
      console.warn('[Analytics] Error tracking home button:', error);
    }
  };

  const canRetry = retryCount < MAX_RETRIES;
  const isMaxRetriesReached = retryCount >= MAX_RETRIES;

  const errorType = error?.name || 'Unknown';
  const isNetworkError =
    errorType.includes('Network') ||
    errorType.includes('Fetch') ||
    error?.message?.includes('fetch');
  const isTimeoutError =
    errorType.includes('Timeout') || error?.message?.includes('timeout');

  const getErrorMessage = () => {
    if (isTimeoutError) {
      return 'Le chargement des templates prend trop de temps. Le serveur est peut-être surchargé.';
    }
    if (isNetworkError) {
      return 'Problème de connexion réseau. Vérifiez votre connexion internet et réessayez.';
    }
    return 'Nous rencontrons des difficultés pour charger les templates.';
  };

  return (
    <section className="first">
      <div className="templates-error">
        <div className="error-container">
          <div className="error-icon">
            {isTimeoutError ? '⏱️' : isNetworkError ? '🌐' : '⚠️'}
          </div>

          <h2 className="error-title">Oops ! Une erreur est survenue</h2>

          <p className="error-message">
            {getErrorMessage()}
            {canRetry
              ? ' Veuillez réessayer ou revenir plus tard.'
              : ' Veuillez revenir plus tard ou contacter le support.'}
          </p>

          {retryCount > 0 && (
            <div className="retry-indicator">
              {isMaxRetriesReached ? (
                <div className="max-retries-exhausted">
                  <span className="max-retries">
                    Nombre maximum de tentatives atteint ({MAX_RETRIES})
                  </span>
                  <p className="exhausted-message">
                    {isNetworkError
                      ? 'Vérifiez votre connexion internet puis réessayez dans quelques minutes.'
                      : isTimeoutError
                        ? 'Nos serveurs semblent surchargés. Réessayez dans quelques minutes.'
                        : 'Une interruption technique est en cours. Notre équipe a été notifiée.'}
                  </p>
                  <Link
                    href="/contact"
                    className="contact-link exhausted-contact"
                  >
                    Nous contacter si le problème persiste
                  </Link>
                </div>
              ) : (
                <span className="retry-count">
                  Tentative {retryCount} sur {MAX_RETRIES}
                </span>
              )}
            </div>
          )}

          <div className="error-actions">
            {canRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="retry-button"
                aria-label={`Réessayer${retryCount > 0 ? ` (${MAX_RETRIES - retryCount} tentatives restantes)` : ''}`}
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

            <Link href="/" className="home-button" onClick={handleGoHome}>
              🏠 Accueil
            </Link>
          </div>

          <div className="help-text">
            <p>
              Si le problème persiste, vous pouvez{' '}
              <Link href="/contact" className="contact-link">
                nous contacter
              </Link>{' '}
              pour obtenir de l&apos;aide.
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && error && (
            <details className="debug-info">
              <summary>Informations techniques (dev)</summary>
              <div className="debug-content">
                <p>
                  <strong>Type :</strong> {errorType}
                </p>
                <p>
                  <strong>Message :</strong> {error.message}
                </p>
                <p>
                  <strong>Page :</strong> templates (liste)
                </p>
                <p>
                  <strong>Tentatives :</strong> {retryCount}/{MAX_RETRIES}
                </p>
                <p>
                  <strong>Network Error :</strong>{' '}
                  {isNetworkError ? 'Oui' : 'Non'}
                </p>
                <p>
                  <strong>Timeout Error :</strong>{' '}
                  {isTimeoutError ? 'Oui' : 'Non'}
                </p>
                {error.stack && (
                  <p>
                    <strong>Stack :</strong>
                    <pre
                      style={{
                        fontSize: '0.7rem',
                        overflow: 'auto',
                        maxHeight: '150px',
                        marginTop: '0.5rem',
                        padding: '0.5rem',
                        background: 'rgba(0,0,0,0.1)',
                        borderRadius: '4px',
                      }}
                    >
                      {error.stack.substring(0, 500)}
                    </pre>
                  </p>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}

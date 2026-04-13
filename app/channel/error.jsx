'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { trackEvent } from '@/utils/analytics';
import './error.scss';

/**
 * Error Boundary pour la page de la chaîne
 * Même pattern que app/templates/error.jsx
 */
export default function ChannelError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const timeoutRef = useRef(null);
  const MAX_RETRIES = 3;

  // Sentry — se déclenche une seule fois à l'apparition de l'erreur
  useEffect(() => {
    if (!error) return;

    Sentry.captureException(error, {
      tags: {
        component: 'channel_error_boundary',
        page: 'channel',
        error_type: 'client_side_error',
      },
      extra: {
        errorName: error?.name || 'Unknown',
        errorMessage: error?.message || 'No message',
        errorStack: error?.stack?.substring(0, 500),
        // retryCount retiré — toujours 0 ici
      },
      level: 'error',
    });
  }, [error]); // ← uniquement error

  // Analytics — séparé
  useEffect(() => {
    if (!error) return;

    trackEvent('error_boundary_shown', {
      event_category: 'errors',
      event_label: 'channel_error',
      error_name: error?.name || 'Unknown',
      error_message: error?.message?.substring(0, 100) || 'No message',
      page: 'channel',
    });
  }, [error]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleRetry = () => {
    if (retryCount >= MAX_RETRIES || isRetrying) return;

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    trackEvent('error_retry_attempt', {
      event_category: 'errors',
      event_label: 'channel_retry',
      retry_number: retryCount + 1,
      max_retries: MAX_RETRIES,
      page: 'channel',
    });

    const delay = Math.min(1000 * (retryCount + 1), 3000);

    timeoutRef.current = setTimeout(() => {
      setIsRetrying(false);
      reset();
    }, delay);
  };

  const handleGoHome = () => {
    trackEvent('error_recovery_home', {
      event_category: 'errors',
      event_label: 'channel_home',
      retry_count: retryCount,
    });
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
    if (isTimeoutError)
      return 'Le chargement de la chaîne prend trop de temps.';
    if (isNetworkError)
      return 'Problème de connexion réseau. Vérifiez votre connexion internet.';
    return 'Nous rencontrons des difficultés pour charger la chaîne.';
  };

  return (
    <section className="first">
      <div className="channel-error">
        <div className="error-container">
          <div className="error-icon">
            {isTimeoutError ? '⏱️' : isNetworkError ? '🌐' : '🎬'}
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
                <span className="max-retries">
                  Nombre maximum de tentatives atteint ({MAX_RETRIES})
                </span>
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
                  <strong>Page :</strong> channel
                </p>
                <p>
                  <strong>Tentatives :</strong> {retryCount}/{MAX_RETRIES}
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

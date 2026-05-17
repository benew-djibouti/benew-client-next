'use client';

import { useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import './error.scss';
// Manquant en tête du fichier
import { trackEvent } from '@/utils/analytics';

/**
 * Error Boundary simplifié pour la page de présentation
 * Se concentre uniquement sur l'interface utilisateur et les interactions de base
 * Le monitoring et la classification d'erreurs sont gérés côté server component
 */
export default function PresentationError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const MAX_RETRIES = 3;

  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    try {
      Sentry.captureException(error, {
        tags: {
          component: 'presentation_error_boundary',
          page: 'presentation',
          error_type: 'client_side_error',
        },
        extra: {
          errorName: error?.name || 'Unknown',
          errorMessage: error?.message || 'No message',
          errorStack: error?.stack?.substring(0, 500),
        },
        level: 'error',
      });
    } catch (sentryError) {
      console.warn('[Sentry] Failed to capture exception:', sentryError);
    }
  }, [error]);

  // Log simple pour suivi des interactions utilisateur (tracking uniquement)
  useEffect(() => {
    if (!error) return;
    try {
      trackEvent('error_boundary_shown', {
        // ← nom correct
        event_category: 'errors',
        event_label: 'presentation_error',
        page: 'presentation',
        error_name: error?.name || 'Unknown',
      });
    } catch (e) {
      console.warn('[Analytics] Error tracking failed:', e);
    }
  }, [error]);

  /**
   * Gestion du retry avec délai simple
   */
  const handleRetry = () => {
    if (retryCount >= MAX_RETRIES || isRetrying) return;

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    try {
      trackEvent('error_retry_attempt', {
        page: 'presentation',
        retry_number: retryCount + 1,
      });
    } catch (e) {
      console.warn('[Analytics] Retry tracking failed:', e);
    }

    const delay = Math.min(1000 * (retryCount + 1), 3000);

    timeoutRef.current = setTimeout(() => {
      setIsRetrying(false);
      reset();
    }, delay);
  };

  const canRetry = retryCount < MAX_RETRIES;
  const isMaxRetriesReached = retryCount >= MAX_RETRIES;

  return (
    <section className="first">
      <div className="presentation-error">
        <div className="error-container">
          {/* Icône d'erreur */}
          <div className="error-icon">📋</div>

          {/* Titre principal */}
          <h2 className="error-title">Problème de présentation</h2>

          {/* Message principal */}
          <p className="error-message">
            Nous rencontrons des difficultés pour afficher la présentation
            complète.
            {canRetry
              ? ' Veuillez réessayer ou consulter une version simplifiée.'
              : ' Veuillez consulter une version simplifiée ou revenir plus tard.'}
          </p>

          {/* Indicateur de tentatives */}
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

          {/* Actions utilisateur */}
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

            <Link href="/" className="home-button">
              🏠 Accueil
            </Link>
          </div>

          {/* Informations alternatives */}
          <div className="alternative-content">
            <h3 className="alternative-title">En attendant, découvrez :</h3>
            <div className="alternative-links">
              <Link href="/templates" className="alternative-link">
                🎨 Nos Templates
              </Link>
              <Link href="/contact" className="alternative-link">
                📞 Nous Contacter
              </Link>
              <Link href="/" className="alternative-link">
                🏠 Accueil
              </Link>
            </div>
          </div>

          {/* Debug info (dev uniquement) */}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="debug-info">
              <summary>Informations techniques (dev)</summary>
              <div className="debug-content">
                <p>
                  <strong>Erreur :</strong> {error.name}
                </p>
                <p>
                  <strong>Message :</strong> {error.message}
                </p>
                <p>
                  <strong>Page :</strong> presentation
                </p>
                <p>
                  <strong>Tentatives :</strong> {retryCount}/{MAX_RETRIES}
                </p>
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}

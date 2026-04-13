'use client';

import { useEffect, useRef, useState } from 'react';
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

  // Log simple pour suivi des interactions utilisateur (tracking uniquement)
  useEffect(() => {
    if (error) {
      trackEvent('error_boundary_shown', {
        page: 'presentation',
        error_name: error?.name || 'Unknown',
      });
    }
  }, [error]);

  /**
   * Gestion du retry avec délai simple
   */
  const handleRetry = async () => {
    if (retryCount >= MAX_RETRIES || isRetrying) return;

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    trackEvent('error_retry_attempt', {
      page: 'presentation',
      retry_number: retryCount + 1,
    });

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

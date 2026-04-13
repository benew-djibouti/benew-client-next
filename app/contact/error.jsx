'use client';

import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '@/utils/analytics';
import Link from 'next/link';
import './error.scss';

/**
 * Error Boundary simplifié pour la page de contact
 * Se concentre uniquement sur l'interface utilisateur et les interactions de base
 * Le monitoring et la classification d'erreurs sont gérés côté server component
 */
export default function ContactError({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const timeoutRef = useRef(null);
  const MAX_RETRIES = 3;

  // Log simple pour suivi des interactions utilisateur (tracking uniquement)
  useEffect(() => {
    if (error) {
      trackEvent('error_boundary_shown', {
        page: 'contact',
        error_name: error?.name || 'Unknown',
      });
    }
  }, [error]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /**
   * Gestion du retry avec délai simple
   */
  const handleRetry = async () => {
    if (retryCount >= MAX_RETRIES || isRetrying) return;

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'error_retry_attempt',
        page: 'contact',
        retry_number: retryCount + 1,
      });
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
      <div className="contact-error">
        <div className="error-container">
          {/* Icône d'erreur */}
          <div className="error-icon">📞</div>

          {/* Titre principal */}
          <h2 className="error-title">Problème avec le formulaire</h2>

          {/* Message principal */}
          <p className="error-message">
            Nous rencontrons des difficultés avec le formulaire de contact.
            {canRetry
              ? ' Veuillez réessayer ou nous contacter autrement.'
              : " Veuillez nous contacter par d'autres moyens."}
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

          {/* Alternatives de contact */}
          <div className="alternatives-list">
            <div className="alternative-item">
              <span className="alternative-icon">📱</span>
              <span className="alternative-text">Téléphone : 77.86.00.64</span>
            </div>
            <div className="alternative-item">
              <span className="alternative-icon">📱</span>
              <span className="alternative-text">Téléphone : 77.19.68.18</span>
            </div>
            <div className="alternative-item">
              <span className="alternative-icon">💬</span>
              <span className="alternative-text">WhatsApp : 77.19.68.18</span>
            </div>
            <div className="alternative-item">
              <span className="alternative-icon">📧</span>
              <span className="alternative-text">benew-tech@benew-dj.com</span>
            </div>
            <div className="alternative-item">
              <span className="alternative-icon">📧</span>
              <span className="alternative-text">
                service-client@benew-dj.com
              </span>
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
                  <strong>Page :</strong> contact
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

// app/channel/page.jsx
// Server Component — chaîne vidéo Benew
// Même pattern que app/templates/page.jsx

import Link from 'next/link';

import './page.scss'; // ← importé dans le Server Component

import ChannelList from '@/components/channel/ChannelList';
import { getVideos } from '@/lib/channelQueries';
import { captureMessage } from '../../sentry.server.config';
import Loading from './loading';
import ReloadButton from '@/components/reloadButton';

// =============================
// CONFIGURATION
// =============================

const CONFIG = {
  performance: {
    slowQueryThreshold: 1500,
  },
};

// =============================
// COMPOSANT ERREUR INLINE
// =============================

function ChannelErrorDisplay({ errorType, userMessage, shouldRetry }) {
  return (
    <div className="channel-error-page">
      <section className="first">
        <div className="channel-error-content">
          <div className="server-error">
            <div className="error-icon">
              {errorType === ERROR_TYPES.TIMEOUT
                ? '⏱️'
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
            <details className="debug-details">
              <summary>Informations de débogage</summary>
              <div className="debug-content">
                <p>
                  <strong>Type :</strong> {errorType}
                </p>
                <p>
                  <strong>Peut réessayer :</strong>{' '}
                  {shouldRetry ? 'Oui' : 'Non'}
                </p>
              </div>
            </details>
          )}
        </div>
      </section>
    </div>
  );
}

// =============================
// PAGE PRINCIPALE
// =============================

export default async function ChannelPage() {
  const startTime = Date.now();

  const data = await getVideos();

  const pageLoadDuration = Date.now() - startTime;

  if (pageLoadDuration > CONFIG.performance.slowQueryThreshold) {
    captureMessage('Slow channel page load', {
      extra: { pageLoadDuration, videosCount: data.videos?.length },
    });
  }

  // Erreur DB
  if (!data.success) {
    const errorInfo = classifyError({
      message: data.error || 'Unknown error',
      code: data.errorCode || null,
    });

    if (process.env.NODE_ENV === 'production') {
      return (
        <ChannelErrorDisplay
          errorType={errorInfo.type}
          userMessage={errorInfo.userMessage}
          shouldRetry={errorInfo.shouldRetry}
        />
      );
    }

    return (
      <ChannelErrorDisplay
        errorType={errorInfo.type}
        userMessage={data.error || errorInfo.userMessage}
        shouldRetry={errorInfo.shouldRetry}
      />
    );
  }

  // Aucune vidéo disponible
  if (!data.videos || data.videos.length === 0) {
    return (
      <div className="channel-empty-state">
        <section className="first">
          <div className="empty-content">
            <div className="empty-card">
              <div className="empty-icon">🎬</div>
              <h1 className="empty-title">Aucune vidéo disponible</h1>
              <p className="empty-message">
                Notre chaîne est en cours de préparation.
              </p>
              <p className="empty-submessage">
                Revenez bientôt pour découvrir nos tutoriels et présentations.
              </p>
              <div className="empty-actions">
                <Link href="/" className="cta-button primary">
                  🏠 Retour à l&apos;accueil
                </Link>
                <Link href="/templates" className="cta-button secondary">
                  📋 Voir nos templates
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return <ChannelList videos={data.videos} />;
}

// =============================
// METADATA SEO
// =============================

export const metadata = {
  title: 'Chaîne - Benew | Tutoriels & Présentations',
  description:
    'Découvrez nos tutoriels, démonstrations et présentations vidéo. Apprenez à utiliser nos templates et applications e-commerce.',
  keywords: [
    'tutoriels',
    'vidéos',
    'chaîne benew',
    'démonstrations',
    'e-commerce',
    'Djibouti',
  ],
  openGraph: {
    title: 'Chaîne Benew — Tutoriels & Vidéos',
    description:
      'Tutoriels, démonstrations et présentations pour maîtriser nos solutions e-commerce.',
    url: `/channel`,
  },
  alternates: {
    canonical: `/channel`,
  },
};

export const revalidate = 120;

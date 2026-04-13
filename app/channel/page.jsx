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
  cache: {
    revalidate: 120, // 2 minutes — les vidéos changent moins souvent que les templates
  },
  performance: {
    slowQueryThreshold: 1500,
  },
};

// Types d'erreurs (même pattern que templates)
const ERROR_TYPES = {
  DATABASE_ERROR: 'database_error',
  TIMEOUT: 'timeout',
  CONNECTION_ERROR: 'connection_error',
  PERMISSION_ERROR: 'permission_error',
  NETWORK_ERROR: 'network_error',
  UNKNOWN_ERROR: 'unknown_error',
};

const PG_ERROR_CODES = {
  CONNECTION_FAILURE: '08001',
  CONNECTION_EXCEPTION: '08000',
  QUERY_CANCELED: '57014',
  ADMIN_SHUTDOWN: '57P01',
  CRASH_SHUTDOWN: '57P02',
  CANNOT_CONNECT: '57P03',
  UNDEFINED_TABLE: '42P01',
  INSUFFICIENT_PRIVILEGE: '42501',
  AUTHENTICATION_FAILED: '28000',
  INVALID_PASSWORD: '28P01',
};

// =============================
// CLASSIFICATION D'ERREURS
// =============================

function classifyError(error) {
  if (!error) {
    return {
      type: ERROR_TYPES.UNKNOWN_ERROR,
      shouldRetry: false,
      httpStatus: 500,
      userMessage: 'Une erreur inattendue est survenue.',
    };
  }

  const code = error.code;
  const message = (error.message || '').toLowerCase();

  if (
    [
      PG_ERROR_CODES.CONNECTION_FAILURE,
      PG_ERROR_CODES.CONNECTION_EXCEPTION,
      PG_ERROR_CODES.CANNOT_CONNECT,
      PG_ERROR_CODES.ADMIN_SHUTDOWN,
      PG_ERROR_CODES.CRASH_SHUTDOWN,
    ].includes(code)
  ) {
    return {
      type: ERROR_TYPES.CONNECTION_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage:
        'Service temporairement indisponible. Veuillez réessayer dans quelques instants.',
    };
  }

  if (code === PG_ERROR_CODES.QUERY_CANCELED || message.includes('timeout')) {
    return {
      type: ERROR_TYPES.TIMEOUT,
      shouldRetry: true,
      httpStatus: 503,
      userMessage:
        'Le chargement a pris trop de temps. Le serveur est peut-être surchargé.',
    };
  }

  if (
    [
      PG_ERROR_CODES.INSUFFICIENT_PRIVILEGE,
      PG_ERROR_CODES.AUTHENTICATION_FAILED,
      PG_ERROR_CODES.INVALID_PASSWORD,
    ].includes(code)
  ) {
    return {
      type: ERROR_TYPES.PERMISSION_ERROR,
      shouldRetry: false,
      httpStatus: 500,
      userMessage: 'Erreur de configuration serveur.',
    };
  }

  if (code === PG_ERROR_CODES.UNDEFINED_TABLE) {
    return {
      type: ERROR_TYPES.DATABASE_ERROR,
      shouldRetry: false,
      httpStatus: 500,
      userMessage: 'Erreur de configuration serveur.',
    };
  }

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('econnrefused')
  ) {
    return {
      type: ERROR_TYPES.NETWORK_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'Problème de connexion réseau.',
    };
  }

  return {
    type: ERROR_TYPES.DATABASE_ERROR,
    shouldRetry: false,
    httpStatus: 500,
    userMessage:
      'Une erreur inattendue est survenue lors du chargement des vidéos.',
  };
}

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
  const startTime = performance.now();

  const data = await getVideos();

  const queryDuration = performance.now() - startTime;

  if (queryDuration > CONFIG.performance.slowQueryThreshold) {
    captureMessage('Slow channel page load', {
      level: 'warning',
      tags: { component: 'channel_page', performance: true },
      extra: { queryDuration, videosCount: data.videos?.length },
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

// components/channel/ChannelList.jsx
'use client';

import { useState, useEffect, useCallback, memo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { CldImage } from 'next-cloudinary';
import * as Sentry from '@sentry/nextjs';
import { trackEvent } from '@/utils/analytics';
import PageTracker from '../analytics/PageTracker';
import './channelStyles/index.scss';

import ParallaxSkeleton from '../layouts/parallax/ParallaxSkeleton';

// =============================
// IMPORTS DYNAMIQUES (ssr:false obligatoire)
// =============================

// react-player accède au DOM au chargement → crash SSR si import statique
const ReactVideoPlayer = dynamic(() => import('./ReactVideoPlayer'), {
  ssr: false,
  loading: () => (
    <div
      className="video-modal__player-loading"
      aria-label="Chargement du lecteur…"
    />
  ),
});

const Parallax = dynamic(() => import('components/layouts/parallax'), {
  loading: () => <ParallaxSkeleton />,
});

// =============================
// UTILITAIRES
// =============================

function formatDate(dateString) {
  if (!dateString) return '';

  const d = new Date(dateString);

  if (isNaN(d.getTime())) return '';

  return d.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Africa/Djibouti',
  });
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

const CATEGORY_COLORS = [
  'category-color-1',
  'category-color-2',
  'category-color-3',
  'category-color-4',
  'category-color-5',
];

function getCategoryConfig(category) {
  if (!category) return { label: null, color: null };

  // Hash simple et stable basé sur les caractères de la string
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) % CATEGORY_COLORS.length;
  }

  return {
    label: category,
    color: CATEGORY_COLORS[hash],
  };
}

// =============================
// MODAL LECTEUR VIDÉO
// =============================

const VideoModal = memo(({ video, onClose }) => {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [playerError, setPlayerError] = useState(false);

  const handlePlayerError = useCallback(
    (e) => {
      Sentry.captureException(new Error('Video playback error'), {
        tags: { component: 'video_modal', video_id: video.video_id },
        extra: { error: String(e), videoTitle: video.video_title },
      });
      setPlayerError(true);
    },
    [video.video_id, video.video_title],
  );

  // Focus management — ouverture et fermeture
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    modalRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Effect 1 — overflow uniquement
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []); // ← [] car la modal est montée/démontée entière, pas toggleée

  // Escape + focus trap + overflow
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableSelectors = [
        'button',
        'a[href]',
        'input',
        'textarea',
        'select',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      const focusableElements = Array.from(
        modalRef.current?.querySelectorAll(focusableSelectors) || [],
      ).filter((el) => !el.disabled);

      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="video-modal-overlay" onClick={onClose}>
      <div
        className="video-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Lecteur : ${video.video_title}`}
        tabIndex={-1} // ← permet focus programmatique
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton fermer */}
        <button
          className="video-modal__close"
          onClick={onClose}
          aria-label="Fermer le lecteur"
          type="button"
        >
          ✕
        </button>

        {/* Lecteur react-player */}
        {/* key={video.video_id} force un remontage propre à chaque vidéo */}
        <div className="video-modal__player">
          {playerError ? (
            <div className="video-modal__player-error">
              <p>Impossible de lire cette vidéo.</p>
              <button onClick={onClose}>Fermer</button>
            </div>
          ) : (
            <ReactVideoPlayer
              key={video.video_id}
              src={video.video_cloudinary_id}
              poster={video.video_thumbnail_id}
              autoPlay={true}
              controls
              onError={handlePlayerError}
            />
          )}
        </div>

        {/* Infos sous le lecteur */}
        <div className="video-modal__info">
          <h2 className="video-modal__title">{video.video_title}</h2>
          <div className="video-modal__meta">
            <span className="video-modal__date">
              Publiée le {formatDate(video.created_at)}
            </span>
          </div>
          {video.video_description && (
            <p className="video-modal__description">
              {video.video_description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

VideoModal.displayName = 'VideoModal';

// =============================
// CARTE VIDÉO
// =============================

const VideoCard = memo(({ video, onPlay }) => {
  const catConfig = getCategoryConfig(video.video_category);
  const duration = formatDuration(video.video_duration_seconds);

  return (
    <div className="video-card">
      <div className="video-card__inner">
        <div className="video-card__thumbnail">
          {video.video_thumbnail_id ? (
            <CldImage
              src={video.video_thumbnail_id}
              alt={video.video_title}
              width={520}
              height={293}
              className="video-card__thumb-img"
              loading="lazy"
              quality="auto"
              format="auto"
              crop={{ type: 'fill', gravity: 'auto' }}
            />
          ) : (
            <div className="video-card__thumb-placeholder">
              <span className="video-card__thumb-icon" aria-hidden="true">
                🎬
              </span>
            </div>
          )}

          <button
            className="video-card__play-btn"
            onClick={() => onPlay(video)}
            aria-label={`Lire ${video.video_title}`}
            type="button"
          >
            <span className="video-card__play-icon" aria-hidden="true">
              ▶
            </span>
          </button>

          {duration && <span className="video-card__duration">{duration}</span>}
        </div>

        <div className="video-card__info">
          <div className="video-card__info-top">
            {catConfig.label && (
              <span className={`video-card__category ${catConfig.color}`}>
                {catConfig.label}
              </span>
            )}
          </div>
          <h3 className="video-card__title">{video.video_title}</h3>
          {video.video_description && (
            <p className="video-card__description">{video.video_description}</p>
          )}
          <div className="video-card__meta">
            <span className="video-card__date">
              {formatDate(video.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

VideoCard.displayName = 'VideoCard';

// =============================
// COMPOSANT PRINCIPAL
// =============================

const ChannelList = ({ videos: initialVideos = [] }) => {
  const [activeVideo, setActiveVideo] = useState(null);

  useEffect(() => {
    if (initialVideos.length > 0) {
      try {
        trackEvent('page_view', {
          event_category: 'channel',
          event_label: 'channel_list',
          videos_count: initialVideos.length,
        });
      } catch (e) {
        console.warn('[Analytics] Error tracking channel page view:', e);
      }
    }
  }, []);

  const handleVideoPlay = useCallback((video) => {
    setActiveVideo(video);

    try {
      trackEvent('video_play', {
        event_category: 'channel',
        event_label: video.video_title,
        video_id: video.video_id,
        video_category: video.video_category,
      });
    } catch (e) {
      console.warn('[Analytics] Error tracking video play:', e);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveVideo(null);
  }, []);

  return (
    <div className="channel-container">
      <PageTracker pageName="channel_list" />

      <section className="first">
        <Parallax bgColor="#0c0c1d" title="Chaîne Tuto" planets="/sun.png" />
      </section>

      <div className="channel-grid" role="list">
        {initialVideos.map((video) => (
          <section
            key={video.video_id}
            className="others projectSection"
            role="listitem"
          >
            <VideoCard video={video} onPlay={handleVideoPlay} />
          </section>
        ))}
      </div>

      {activeVideo && (
        <VideoModal video={activeVideo} onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default ChannelList;

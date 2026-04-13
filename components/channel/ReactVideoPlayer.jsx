// components/channel/ReactVideoPlayer.jsx
// Wrapper react-player pour Next.js 15 App Router
// react-player doit être chargé côté client uniquement (SSR crash sinon)
// On utilise next/dynamic avec ssr:false dans ChannelList.jsx
'use client';

// =============================
// CONSTANTE URL CDN — masque le nom du service de stockage
// =============================

const CDN_BASE = process.env.NEXT_PUBLIC_CDN_BASE_URL;

function buildVideoUrl(publicId) {
  if (!publicId) return null;
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    return publicId;
  }
  if (!CDN_BASE) {
    console.warn('[ReactVideoPlayer] NEXT_PUBLIC_CDN_BASE_URL is not defined');
    return null;
  }
  // Ajouter .mp4 si pas déjà d'extension
  const withExt = publicId.includes('.') ? publicId : `${publicId}.mp4`;
  return `${CDN_BASE}/video/upload/${withExt}`;
}

function buildPosterUrl(thumbnailId) {
  if (!thumbnailId) return null;
  if (thumbnailId.startsWith('http://') || thumbnailId.startsWith('https://')) {
    return thumbnailId;
  }
  if (!CDN_BASE) {
    return null; // Pas de warning ici — buildVideoUrl l'a déjà émis
  }
  return `${CDN_BASE}/image/upload/f_auto,q_auto,w_1280/${thumbnailId}`;
}

// =============================
// COMPOSANT REACTVIDEOPLAYER
// Importé dynamiquement (ssr:false) depuis ChannelList.jsx
// =============================

import ReactPlayer from 'react-player';

/**
 * @param {string}   props.src       - public_id ou URL directe
 * @param {string}   [props.poster]  - public_id thumbnail ou URL directe
 * @param {boolean}  [props.autoPlay]
 * @param {boolean}  [props.controls]
 * @param {string}   [props.className]
 * @param {Function} [props.onReady]
 * @param {Function} [props.onPlay]
 * @param {Function} [props.onPause]
 * @param {Function} [props.onEnded]
 */
const ReactVideoPlayer = ({
  src,
  poster,
  autoPlay = false,
  controls = true,
  className = '',
  onPlay,
  onPause,
  onEnded,
  onError, // ← prop existante, maintenant utilisée
}) => {
  const videoUrl = buildVideoUrl(src);
  const posterUrl = poster ? buildPosterUrl(poster) : null;

  if (!videoUrl) return null;

  const handleError = (e) => {
    console.warn('[ReactVideoPlayer] Error:', e);
    if (onError) onError(e); // ← remonter au parent
  };

  return (
    <div className={`react-video-wrapper ${className}`}>
      <ReactPlayer
        src={videoUrl}
        playing={autoPlay}
        controls={controls}
        width="100%"
        height="100%"
        style={{ display: 'block' }}
        config={{
          file: {
            attributes: {
              poster: posterUrl || undefined,
              preload: 'metadata',
              playsInline: true,
            },
          },
        }}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        onError={handleError}
      />
    </div>
  );
};

export default ReactVideoPlayer;

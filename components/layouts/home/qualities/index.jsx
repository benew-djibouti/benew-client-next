'use client';

import './index.scss';
import { useState, useRef, useCallback, useEffect } from 'react';
import { MdPlayArrow, MdPause } from 'react-icons/md';

const QualitiesHome = () => {
  const [playing, setPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef(null);
  const isTransitioning = useRef(false);
  const transitionTimerRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: coarse)');

    const checkDevice = () => {
      setIsMobile(mediaQuery.matches);
    };

    // Exécution initiale
    checkDevice();

    // matchMedia a son propre listener — pas besoin de debounce
    // car il ne se déclenche qu'une fois quand le type de pointeur change
    mediaQuery.addEventListener('change', checkDevice);

    return () => {
      mediaQuery.removeEventListener('change', checkDevice);
    };
  }, []);

  const handlePlayPause = useCallback(async () => {
    const video = videoRef.current;
    if (!video || isTransitioning.current) return;

    isTransitioning.current = true;

    try {
      if (playing) {
        video.pause();
        setPlaying(false);
      } else {
        if (!video.paused) video.pause();
        await video.play();
        setPlaying(true);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setPlaying(!video.paused);
      } else if (error.name === 'NotAllowedError') {
        setPlaying(false);
      } else {
        console.error('[VideoPlayer] Erreur:', error);
        setPlaying(false);
      }
    } finally {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => {
        isTransitioning.current = false;
      }, 300);
    }
  }, [playing]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    isTransitioning.current = false;
  }, []);

  const handleNativePlay = useCallback(() => setPlaying(true), []);
  const handleNativePause = useCallback(() => setPlaying(false), []);

  return (
    <>
      {/* BLOC TITRE — desktop uniquement, au-dessus de la vidéo */}
      <div className="services-title-block services-title-block--desktop">
        <h1 className="section-main-title">nos magasins en ligne</h1>
      </div>

      {/* BLOC VIDÉO — contient aussi le titre sur mobile/tablette */}
      <div className="services-video-block">
        <div className="video-wrapper">
          <video
            ref={videoRef}
            src="/video/Qualities (1).mp4"
            preload="none"
            playsInline
            // Contrôles natifs sur mobile/tablette, aucun sur desktop
            controls={isMobile}
            controlsList="noplaybackrate nodownload"
            onEnded={handleEnded}
            onPlay={handleNativePlay}
            onPause={handleNativePause}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Overlay + bouton personnalisé uniquement sur desktop */}
          {!isMobile && (
            <div
              className={`video-overlay ${playing ? 'video-overlay--playing' : 'video-overlay--paused'}`}
            >
              <button
                className={`video-play-btn video-play-btn--ready ${playing ? 'video-play-btn--playing' : ''}`}
                onClick={handlePlayPause}
                aria-label={playing ? 'Mettre en pause' : 'Lancer la vidéo'}
                type="button"
              >
                {playing ? (
                  <MdPause className="video-play-btn__icon" />
                ) : (
                  <MdPlayArrow className="video-play-btn__icon" />
                )}
              </button>
            </div>
          )}
        </div>
        {/* TITRE mobile/tablette — sous la vidéo */}
        <div className="services-title-block services-title-block--mobile">
          <h1 className="section-main-title">nos magasins en ligne</h1>
        </div>
      </div>
    </>
  );
};

export default QualitiesHome;

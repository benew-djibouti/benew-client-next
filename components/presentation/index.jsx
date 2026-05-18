'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef, useEffect } from 'react';
import './index.scss';
import Image from 'next/image';

import ParallaxSkeleton from '../layouts/parallax/ParallaxSkeleton';
// Import dynamique des composants
const Parallax = dynamic(() => import('components/layouts/parallax'), {
  loading: () => <ParallaxSkeleton />,
});

// components/presentation/index.jsx
import { categoryContents, categories } from '@/lib/presentation';

import PresentationModal from 'components/modal/PresentationModal';
import PageTracker from '../analytics/PageTracker';
import { trackEvent } from '@/utils/analytics';

const PresentationComponent = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  const closeTimerRef = useRef(null);

  // Ouvrir le modal pour la carte "SKY IS THE LIMIT"
  const handleCardClick = useCallback(() => {
    try {
      trackEvent('presentation_modal_open', {
        event_category: 'presentation',
        event_label: 'sky_is_the_limit',
        modal_type: 'vision',
        page_section: 'main_card',
      });
    } catch (e) {
      console.warn('[Analytics] Error tracking card click:', e);
    }
    setModalContent(categoryContents.vision);
    setIsModalOpen(true);
  }, []);

  // Ouvrir le modal pour une catégorie spécifique
  const handleCategoryClick = useCallback((category) => {
    try {
      trackEvent('presentation_category_click', {
        event_category: 'presentation',
        event_label: category.id,
        category_type: category.id,
        page_section: 'categories',
      });
    } catch (e) {
      console.warn('[Analytics] Error tracking category click:', e);
    }
    setModalContent(categoryContents[category.contentKey]);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    try {
      trackEvent('presentation_modal_close', {
        event_category: 'presentation',
        event_label: modalContent?.title || 'unknown',
        modal_type: modalContent?.title || 'unknown',
      });
    } catch (e) {
      console.warn('[Analytics] Error tracking modal close:', e);
    }
    setIsModalOpen(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setModalContent(null), 300);
  }, [modalContent]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <>
      {/* ⭐ PAGETRACKER */}
      <PageTracker
        pageName="presentation"
        pageType="informational"
        sections={[
          'hero_parallax',
          'presentation_card',
          'categories_grid',
          'modal_interaction',
        ]}
      />

      {/* SECTION 1: Parallax */}
      <section className="first">
        <Parallax bgColor="#0c0c1d" title="Presentation" planets="/sun.png" />
      </section>

      {/* SECTION 2: Carte SKY IS THE LIMIT */}
      <section className="others">
        {/* ✅ BACKGROUNDS OPTIMISÉS avec Next.js Image */}
        <div className="planets-background-container" aria-hidden="true">
          <Image
            src="/planets.png"
            alt=""
            fill
            priority={false}
            loading="lazy"
            quality={75}
            style={{ objectFit: 'cover', objectPosition: 'bottom' }}
          />
        </div>

        <div className="stars-container" aria-hidden="true">
          <Image
            src="/stars.png"
            alt=""
            fill
            priority={false}
            loading="lazy"
            quality={60}
            style={{ objectFit: 'cover', objectPosition: 'bottom' }}
          />
        </div>

        {/* Contenu principal */}
        <div className="presentation-content">
          {/* Titre BENEW */}
          <h1 className="benew-title">BENEW</h1>

          {/* Carte centrale cliquable */}
          <button
            className="sky-limit-card"
            onClick={handleCardClick}
            aria-label="Lire notre vision : Sky is the limit"
          >
            <h2 className="sky-limit-text">SKY IS THE LIMIT</h2>
            <p className="card-hint">Lire →</p>
          </button>
        </div>
      </section>

      {/* SECTION 3: Grille des catégories - CLASSE SUPPLÉMENTAIRE */}
      <section className="others categories-section">
        {/* Backgrounds réutilisés */}
        <div className="planets-background-container" aria-hidden="true">
          <Image
            src="/planets.png"
            alt=""
            fill
            loading="lazy"
            priority={false}
            quality={75}
            style={{
              objectFit: 'cover',
              objectPosition: 'bottom',
            }}
          />
        </div>

        <div className="stars-container" aria-hidden="true">
          <Image
            src="/stars.png"
            alt=""
            fill
            loading="lazy"
            priority={false}
            quality={60}
            style={{
              objectFit: 'cover',
              objectPosition: 'bottom',
            }}
          />
        </div>

        {/* Contenu catégories */}
        <div className="categories-content">
          <div className="categories-grid">
            {categories.map((category) => (
              <button
                key={category.id}
                className="category-card"
                onClick={() => handleCategoryClick(category)}
                aria-label={`Lire : ${category.title}`}
              >
                <div className="category-icon" aria-hidden="true">
                  {category.icon}
                </div>
                <h3 className="category-title">{category.title}</h3>
              </button>
            ))}
          </div>
        </div>
      </section>

      <PresentationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        content={modalContent}
      />
    </>
  );
};

export default PresentationComponent;

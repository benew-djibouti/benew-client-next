// components/templates/SingleTemplateShops.jsx
'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  FaDollarSign,
  FaImages,
  FaEye,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';
import { FaX } from 'react-icons/fa6';
import './shopsStyles/index.scss';

import ParallaxSkeleton from '../layouts/parallax/ParallaxSkeleton';
const Parallax = dynamic(() => import('components/layouts/parallax'), {
  loading: () => <ParallaxSkeleton />,
});

import { formatPrice, getApplicationLevelLabel } from '@/utils/helpers';
import { trackEvent } from '@/utils/analytics';
import PageTracker from '../analytics/PageTracker';
import AppImage from './AppImage';

const OrderModal = dynamic(() => import('../modal/OrderModal'), {
  loading: () => (
    <div className="modal-loading-overlay">
      <div className="modal-loading-spinner" aria-label="Chargement..." />
    </div>
  ),
});

// =============================
// COMPOSANT GALLERYMODAL AVEC IMAGES COMBINÉES
// =============================
const GalleryModal = memo(({ isOpen, onClose, images, applicationName }) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedImage(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        modalRef.current?.querySelectorAll(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) || [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !images || images.length <= 1) return;

    const interval = setInterval(() => {
      setSelectedImage((prev) => (prev + 1) % images.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, images]);

  if (!isOpen || !images || images.length === 0) return null;

  return (
    <div className="gallery-modal-overlay" onClick={onClose}>
      <div
        className="gallery-modal-content"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="gallery-close-btn"
          onClick={onClose}
          aria-label="Fermer la galerie"
        >
          <FaX className="close-icon" />
        </button>

        <div className="gallery-header">
          <div className="gallery-header-left">
            <h3 id="gallery-modal-title">{applicationName} - Galerie</h3>
            <p className="gallery-counter">
              {selectedImage + 1} / {images.length}
            </p>
          </div>
        </div>

        <div className="gallery-body">
          <div className="gallery-thumbnails">
            {images.map((img, index) => (
              <button
                key={index}
                className={`gallery-thumb ${index === selectedImage ? 'active' : ''}`}
                onClick={() => setSelectedImage(index)}
                aria-label={`Aller à l'image ${index + 1}`}
              >
                <AppImage
                  src={img}
                  alt={`${applicationName} - Miniature ${index + 1}`}
                  width={120}
                  height={120}
                  className="gallery-image"
                />
              </button>
            ))}
          </div>

          <div className="gallery-image-container">
            <AppImage
              src={images[selectedImage]}
              alt={`${applicationName} - Version ${selectedImage + 1}`}
              width={800}
              height={600}
              className="gallery-image"
              crop={{ type: 'fit', gravity: 'center' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

GalleryModal.displayName = 'GalleryModal';

// =============================
// CARTE D'APPLICATION
// =============================
const ApplicationCard = memo(
  ({
    app,
    templateID,
    onOrderClick,
    onViewClick,
    onGalleryClick,
    hasPaymentMethods,
  }) => {
    const firstImage = useMemo(() => {
      if (app.application_images && app.application_images.length > 0) {
        return app.application_images[0];
      }
      return '/placeholder-application.png';
    }, [app.application_images]);

    const allImages = useMemo(() => {
      const mainImages = app.application_images || [];
      const otherVersions = app.application_other_versions || [];
      const combined = [...mainImages, ...otherVersions];
      const unique = [...new Set(combined)].filter(Boolean);
      return unique.length > 0 ? unique : ['/placeholder-application.png'];
    }, [app.application_images, app.application_other_versions]);

    const hasMultipleImages = allImages.length > 1;

    return (
      <div
        className="application-card"
        data-app-id={app.application_id}
        data-app-name={app.application_name}
      >
        <div className="card-image">
          <AppImage
            src={firstImage}
            alt={app.application_name}
            width={400}
            height={200}
            className="app-image"
            loading="lazy"
          />
        </div>

        <div className="card-content">
          <h3 className="app-title">{app.application_name}</h3>

          <p className="app-meta">
            <span className="level">
              {getApplicationLevelLabel(app.application_level).long}
            </span>
            <span className="separator">•</span>
            <span className="category">{app.application_category}</span>
          </p>

          <div className="price-section">
            <div className="price-item">
              <span className="price-label">Frais d&apos;acquisition</span>
              <span className="price">{formatPrice(app.application_fee)}</span>
            </div>
            <div className="price-item">
              <span className="price-label">
                Frais de gestion (hors charges)
              </span>
              <span className="rent-price">
                {formatPrice(app.application_rent)}/mois
              </span>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className="btn btn-cart"
              onClick={() => onOrderClick(app)}
              disabled={!hasPaymentMethods}
              aria-label={`Commander ${app.application_name}`}
            >
              <FaDollarSign size={16} />
              <span className="btn-text">Commander</span>
            </button>

            {hasMultipleImages && (
              <button
                className="btn btn-gallery"
                onClick={() => onGalleryClick(app, allImages)}
                aria-label={`Voir la galerie de ${app.application_name}`}
              >
                <FaImages size={16} />
                <span className="btn-text">Galerie</span>
              </button>
            )}

            <Link
              href={`/templates/${templateID}/applications/${app.application_id}`}
              className="btn btn-preview"
              onClick={() => onViewClick(app)}
              aria-label={`Voir détails de ${app.application_name}`}
            >
              <FaEye />
              <span className="btn-text">Voir +</span>
            </Link>
          </div>
        </div>
      </div>
    );
  },
);

ApplicationCard.displayName = 'ApplicationCard';

// =============================
// ✅ CAROUSEL AVEC FLÈCHES (PC) ET DOTS (MOBILE/TABLETTE) - MODIFIÉ
// =============================
const ApplicationsCarousel = memo(
  ({
    applications,
    templateID,
    hasPaymentMethods,
    onOrderClick,
    onViewClick,
    onGalleryClick,
    isModalOpen, // ✅ NOUVEAU
    isGalleryOpen, // ✅ NOUVEAU
  }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAutoScrolling, setIsAutoScrolling] = useState(true);
    // Ajouter avec les autres états :
    const isTransitioningRef = useRef(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const setIsTransitioningSync = useCallback((value) => {
      isTransitioningRef.current = value;
      setIsTransitioning(value);
    }, []); // ← stable, jamais recréé

    const handleSlideChange = useCallback(
      (newIndex) => {
        if (isTransitioningRef.current) return; // ← lit la ref, pas le state
        setIsTransitioningSync(true);
        setCurrentIndex(newIndex);
        setTimeout(() => {
          setIsTransitioningSync(false);
        }, 600);
      },
      [setIsTransitioningSync], // ← stable
    );

    // ✅ MODIFICATION : Arrêter l'auto-scroll si modal ou galerie ouverte
    useEffect(() => {
      if (
        !isAutoScrolling ||
        applications.length <= 1 ||
        isTransitioning ||
        isModalOpen ||
        isGalleryOpen
      ) {
        return;
      }

      const interval = setInterval(() => {
        handleSlideChange((currentIndex + 1) % applications.length);
      }, 6000);

      return () => clearInterval(interval);
    }, [
      isAutoScrolling,
      applications.length,
      currentIndex,
      isTransitioning, // ← garde pour la condition d'arrêt visuelle
      isModalOpen,
      isGalleryOpen,
      handleSlideChange, // ← stable maintenant
    ]);

    useEffect(() => {
      if (!isAutoScrolling) {
        const timeout = setTimeout(() => {
          setIsAutoScrolling(true);
        }, 3000);
        return () => clearTimeout(timeout);
      }
    }, [isAutoScrolling]);

    const goToSlide = useCallback(
      (index) => {
        if (index === currentIndex || isTransitioning) return;
        setIsAutoScrolling(false);
        handleSlideChange(index);

        try {
          trackEvent('application_carousel_navigation', {
            event_category: 'navigation',
            event_label: `app_${index + 1}`,
            application_id: applications[index]?.application_id,
          });
        } catch (error) {
          console.warn('[Analytics] Error:', error);
        }
      },
      [currentIndex, isTransitioning, handleSlideChange, applications],
    );

    const handlePrevSlide = useCallback(() => {
      const prevIndex =
        (currentIndex - 1 + applications.length) % applications.length;
      goToSlide(prevIndex);
    }, [currentIndex, applications.length, goToSlide]);

    const handleNextSlide = useCallback(() => {
      const nextIndex = (currentIndex + 1) % applications.length;
      goToSlide(nextIndex);
    }, [currentIndex, applications.length, goToSlide]);

    const touchStartRef = useRef(null);
    const touchEndRef = useRef(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
      touchEndRef.current = null;
      touchStartRef.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e) => {
      touchEndRef.current = e.targetTouches[0].clientX; // ← mutation directe, 0 re-render
    };

    const onTouchEnd = useCallback(() => {
      if (!touchStartRef.current || !touchEndRef.current || isTransitioning)
        return;

      const distance = touchStartRef.current - touchEndRef.current;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;

      if (isLeftSwipe) {
        setIsAutoScrolling(false);
        handleSlideChange((currentIndex + 1) % applications.length);
      } else if (isRightSwipe) {
        setIsAutoScrolling(false);
        handleSlideChange(
          (currentIndex - 1 + applications.length) % applications.length,
        );
      }
    }, [currentIndex, applications.length, isTransitioning, handleSlideChange]);

    return (
      <div
        className="applications-carousel-container"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <button
          className="applications-carousel-arrow applications-carousel-arrow-left"
          onClick={handlePrevSlide}
          disabled={isTransitioning}
          aria-label="Application précédente"
        >
          <FaChevronLeft />
        </button>

        <div className="applications-carousel-track">
          {applications.map((app, index) => {
            const isActive = index === currentIndex;
            const isPrevious =
              index ===
              (currentIndex - 1 + applications.length) % applications.length;
            const isRelevant = isActive || isPrevious;

            // Démonter complètement les slides non pertinents
            if (!isRelevant) return null;

            let slidePosition = 'hidden';
            if (isActive) {
              slidePosition = isTransitioning ? 'entering' : 'active';
            } else if (isPrevious) {
              slidePosition = isTransitioning ? 'exiting' : 'hidden';
            }

            return (
              <div
                key={app.application_id}
                className={`applications-carousel-slide ${slidePosition}`}
              >
                <ApplicationCard
                  app={app}
                  templateID={templateID}
                  onOrderClick={onOrderClick}
                  onViewClick={onViewClick}
                  onGalleryClick={onGalleryClick}
                  hasPaymentMethods={hasPaymentMethods}
                />
              </div>
            );
          })}
        </div>

        <button
          className="applications-carousel-arrow applications-carousel-arrow-right"
          onClick={handleNextSlide}
          disabled={isTransitioning}
          aria-label="Application suivante"
        >
          <FaChevronRight />
        </button>

        <div className="applications-carousel-indicators">
          {applications.map((app, index) => (
            <button
              key={app.application_id}
              onClick={() => goToSlide(index)}
              className={`applications-carousel-dot ${index === currentIndex ? 'active' : ''}`}
              aria-label={`Application ${index + 1} - ${app.application_name}`}
              disabled={isTransitioning}
            />
          ))}
        </div>
      </div>
    );
  },
);

ApplicationsCarousel.displayName = 'ApplicationsCarousel';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const SingleTemplateShops = ({
  templateID,
  applications = [],
  template,
  platforms = [],
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [galleryApp, setGalleryApp] = useState(null);
  const [galleryImages, setGalleryImages] = useState([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [paymentError, setPaymentError] = useState(false);

  const viewedAppsRef = useRef(new Set());
  const selectedAppRef = useRef(null);
  const paymentErrorTimerRef = useRef(null); // ← ajouter cette ligne
  const galleryCloseTimerRef = useRef(null);

  useEffect(() => {
    if (templateID && applications.length > 0) {
      trackEvent('template_detail_view', {
        event_category: 'ecommerce',
        event_label: applications[0]?.template_name || 'Template',
        template_id: templateID,
        applications_count: applications.length,
        has_payment_methods: platforms.length > 0,
      });
    }
  }, [templateID]);

  const handleOrderClick = useCallback(
    (app) => {
      if (!platforms || platforms.length === 0) {
        setPaymentError(true);
        if (paymentErrorTimerRef.current)
          clearTimeout(paymentErrorTimerRef.current);
        paymentErrorTimerRef.current = setTimeout(
          () => setPaymentError(false),
          4000,
        );
        return;
      }

      setPaymentError(false);

      try {
        trackEvent('order_start', {
          event_category: 'ecommerce',
          event_label: app.application_name,
          application_id: app.application_id,
          template_id: templateID,
          application_fee: app.application_fee,
          application_rent: app.application_rent,
        });
      } catch (error) {
        console.warn('[Analytics] Error tracking order start:', error);
      }

      setSelectedApp(app);
      setIsModalOpen(true);
    },
    [platforms, templateID],
  );

  const handleGalleryClick = useCallback(
    (app, combinedImages) => {
      try {
        trackEvent('gallery_open', {
          event_category: 'engagement',
          event_label: app.application_name,
          application_id: app.application_id,
          template_id: templateID,
          total_images: combinedImages.length,
        });
      } catch (error) {
        console.warn('[Analytics] Error tracking gallery:', error);
      }

      setGalleryApp(app);
      setGalleryImages(combinedImages);
      setIsGalleryOpen(true);
    },
    [templateID],
  );

  // Ajouter au cleanup de démontage :
  useEffect(() => {
    return () => {
      if (paymentErrorTimerRef.current)
        clearTimeout(paymentErrorTimerRef.current);
      if (galleryCloseTimerRef.current)
        clearTimeout(galleryCloseTimerRef.current); // ← ajouter
    };
  }, []);

  const handleGalleryClose = useCallback(() => {
    setIsGalleryOpen(false);
    if (galleryCloseTimerRef.current)
      clearTimeout(galleryCloseTimerRef.current);
    galleryCloseTimerRef.current = setTimeout(() => {
      setGalleryApp(null);
      setGalleryImages([]);
    }, 300);
  }, []);

  const handleApplicationView = useCallback(
    (app) => {
      if (!viewedAppsRef.current.has(app.application_id)) {
        try {
          trackEvent('application_detail_click', {
            event_category: 'navigation',
            event_label: app.application_name,
            application_id: app.application_id,
            template_id: templateID,
          });
        } catch (error) {
          console.warn('[Analytics] Error tracking view:', error);
        }

        viewedAppsRef.current.add(app.application_id); // ← mutation directe, 0 re-render
      }
    },
    [templateID], // ← stable pour toute la durée de vie du composant
  );

  // Quand selectedApp change, mettre à jour la ref
  useEffect(() => {
    selectedAppRef.current = selectedApp;
  }, [selectedApp]);

  const handleModalClose = useCallback(() => {
    if (selectedAppRef.current) {
      // ← utiliser la ref
      try {
        trackEvent('order_modal_close', {
          event_category: 'ecommerce',
          event_label: 'modal_closed',
          application_id: selectedAppRef.current.application_id,
        });
      } catch (error) {
        console.warn('[Analytics] Error tracking modal close:', error);
      }
    }
    setIsModalOpen(false);
    setSelectedApp(null);
  }, []); // ← dépendances vides correctes désormais

  if (!applications || applications.length === 0) {
    return (
      <div className="template-empty">
        <PageTracker pageName="template_empty" pageType="product_detail" />
        <section className="first">
          <Parallax bgColor="#0c0c1d" title="Template" planets="/sun.png" />
        </section>
        <section className="empty-state">
          <h2>Aucune application disponible</h2>
          <p>Ce template n&apos;a pas encore d&apos;applications associées.</p>
          <Link href="/templates" className="cta-button">
            Voir d&apos;autres templates
          </Link>
        </section>
      </div>
    );
  }

  const templateName = template?.template_name || 'Template';
  const hasPaymentMethods = platforms && platforms.length > 0;

  return (
    <div className="single-template-container">
      <PageTracker
        pageName={`template_${templateID}`}
        pageType="product_detail"
      />

      <section className="first">
        <Parallax
          bgColor="#0c0c1d"
          title={templateName.toUpperCase()}
          planets="/sun.png"
        />
      </section>

      {applications.length === 1 && (
        <section className="others projectSection" role="article">
          <ApplicationCard
            app={applications[0]}
            templateID={templateID}
            onOrderClick={handleOrderClick}
            onViewClick={handleApplicationView}
            onGalleryClick={handleGalleryClick}
            hasPaymentMethods={hasPaymentMethods}
          />
        </section>
      )}

      {paymentError && (
        <div className="payment-error-message" role="alert">
          Aucune méthode de paiement disponible pour le moment.
        </div>
      )}

      {applications.length > 1 && (
        <section className="others projectSection">
          <ApplicationsCarousel
            applications={applications}
            templateID={templateID}
            hasPaymentMethods={hasPaymentMethods}
            onOrderClick={handleOrderClick}
            onViewClick={handleApplicationView}
            onGalleryClick={handleGalleryClick}
            isModalOpen={isModalOpen} // ✅ AJOUT
            isGalleryOpen={isGalleryOpen} // ✅ AJOUT
          />
        </section>
      )}

      {selectedApp && (
        <OrderModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          platforms={platforms}
          applicationId={selectedApp.application_id}
          applicationFee={selectedApp.application_fee}
          applicationName={selectedApp.application_name}
          applicationCategory={selectedApp.application_category}
        />
      )}

      {galleryApp && (
        <GalleryModal
          isOpen={isGalleryOpen}
          onClose={handleGalleryClose}
          images={galleryImages}
          applicationName={galleryApp.application_name}
        />
      )}
    </div>
  );
};

export default SingleTemplateShops;

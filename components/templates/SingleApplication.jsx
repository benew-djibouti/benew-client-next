// components/templates/SingleApplication.jsx
'use client';

import dynamic from 'next/dynamic';
import './appStyles/index.scss';
import { useEffect, useState, useCallback, memo, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  MdDescription,
  MdSettings,
  MdChecklist,
  MdAttachMoney,
} from 'react-icons/md';
import { FaX } from 'react-icons/fa6';

import ParallaxSkeleton from '../layouts/parallax/ParallaxSkeleton';
const Parallax = dynamic(() => import('components/layouts/parallax'), {
  loading: () => <ParallaxSkeleton />,
});

import OrderModal from '../modal/OrderModal';
import { formatPrice, getApplicationLevelLabel } from '@/utils/helpers';
import { trackEvent } from '@/utils/analytics';
import PageTracker from '../analytics/PageTracker';
import AppImage from './AppImage';

// Hors du composant, au niveau module
const CARDS_CONFIG = [
  {
    id: 'description',
    title: 'Description',
    icon: MdDescription,
    color: 'orange',
  },
  {
    id: 'technical',
    title: 'Informations Techniques',
    icon: MdSettings,
    color: 'purple',
  },
  {
    id: 'needs',
    title: 'Besoins Spécifiques',
    icon: MdChecklist,
    color: 'pink',
  },
  {
    id: 'pricing',
    title: 'Tarification',
    icon: MdAttachMoney,
    color: 'orange',
  },
];

// =============================
// ✅ CAROUSEL GALERIE OPTIMISÉ - SANS FLÈCHES
// =============================
const ApplicationGalleryCarousel = memo(
  ({ images, applicationName, applicationId }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isAutoScrolling, setIsAutoScrolling] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const touchStartRef = useRef(null); // ← useRef
    const touchEndRef = useRef(null); // ← useRef

    const isTransitioningRef = useRef(false); // ← à ajouter

    const transitionTimerRef = useRef(null);

    const imageList = useMemo(() => {
      if (!images || images.length === 0) {
        return ['/placeholder-application.png'];
      }
      return images;
    }, [images]);

    // ✅ 1. setter synchronisé — déclaré en premier
    const setIsTransitioningSync = useCallback((value) => {
      isTransitioningRef.current = value;
      setIsTransitioning(value);
    }, []);

    // Cleanup au démontage
    useEffect(() => {
      return () => {
        if (transitionTimerRef.current)
          clearTimeout(transitionTimerRef.current);
      };
    }, []);

    // ✅ 2. handleSlideChange — déclaré AVANT les useEffect
    const handleSlideChange = useCallback(
      (newIndex) => {
        if (isTransitioningRef.current) return;
        setIsTransitioningSync(true);
        setCurrentSlide(newIndex);
        if (transitionTimerRef.current)
          clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = setTimeout(() => {
          setIsTransitioningSync(false);
        }, 600);
      },
      [setIsTransitioningSync],
    );

    // ✅ 3. useEffect auto-scroll — handleSlideChange existe déjà
    useEffect(() => {
      if (!isAutoScrolling || imageList.length <= 1 || isTransitioning) return;

      const interval = setInterval(() => {
        handleSlideChange((currentSlide + 1) % imageList.length);
      }, 5000);

      return () => clearInterval(interval);
    }, [
      isAutoScrolling,
      imageList.length,
      currentSlide,
      isTransitioning,
      handleSlideChange,
    ]);

    // ✅ 4. useEffect reprendre auto-scroll
    useEffect(() => {
      if (!isAutoScrolling) {
        const timeout = setTimeout(() => setIsAutoScrolling(true), 15000);
        return () => clearTimeout(timeout);
      }
    }, [isAutoScrolling]);

    // ✅ 5. Callbacks — après les useEffect
    const goToSlide = useCallback(
      (index) => {
        if (index === currentSlide || isTransitioning) return;
        setIsAutoScrolling(false);
        handleSlideChange(index);
        try {
          trackEvent('gallery_dot_click', {
            event_category: 'gallery',
            event_label: `image_${index + 1}`,
            application_id: applicationId,
          });
        } catch (error) {
          console.warn('[Analytics] Error:', error);
        }
      },
      [currentSlide, isTransitioning, handleSlideChange, applicationId],
    );

    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
      touchEndRef.current = null;
      touchStartRef.current = e.targetTouches[0].clientX; // ← mutation directe
    };

    const onTouchMove = (e) => {
      touchEndRef.current = e.targetTouches[0].clientX; // ← 0 re-render
    };

    const onTouchEnd = useCallback(() => {
      if (!touchStartRef.current || !touchEndRef.current || isTransitioning)
        return;

      const distance = touchStartRef.current - touchEndRef.current;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;

      if (isLeftSwipe || isRightSwipe) {
        setIsAutoScrolling(false);
        const nextIndex = isLeftSwipe
          ? (currentSlide + 1) % imageList.length
          : (currentSlide - 1 + imageList.length) % imageList.length;
        handleSlideChange(nextIndex);
      }
    }, [currentSlide, imageList.length, isTransitioning, handleSlideChange]);
    // ↑ touchStartRef/touchEndRef retirés des dépendances — refs stables

    if (imageList.length === 1) {
      return (
        <div className="gallery-single-image">
          <AppImage
            src={imageList[0]}
            alt={applicationName}
            width={800}
            height={600}
            className="gallery-image-solo"
            loading="eager"
            crop={{ type: 'fit', gravity: 'center' }}
          />
        </div>
      );
    }

    return (
      <div
        className="gallery-carousel-container"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="gallery-carousel-track">
          {imageList.map((imgUrl, index) => {
            let slidePosition = 'hidden-right';

            if (index === currentSlide) {
              slidePosition = isTransitioning ? 'entering' : 'active';
            } else if (
              index ===
              (currentSlide - 1 + imageList.length) % imageList.length
            ) {
              slidePosition = isTransitioning ? 'exiting' : 'hidden-left';
            }

            return (
              <div
                key={index}
                className={`gallery-carousel-slide ${slidePosition}`}
              >
                <AppImage
                  src={imgUrl}
                  alt={`${applicationName} - Image ${index + 1}`}
                  width={800}
                  height={600}
                  className="gallery-carousel-image"
                  loading={index === 0 ? 'eager' : 'lazy'}
                  crop={{ type: 'fit', gravity: 'center' }}
                />
              </div>
            );
          })}
        </div>

        {imageList.length > 1 && (
          <div className="gallery-carousel-indicators">
            {imageList.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`gallery-carousel-dot ${index === currentSlide ? 'active' : ''}`}
                aria-label={`Image ${index + 1}`}
                disabled={isTransitioning}
              />
            ))}
          </div>
        )}

        {imageList.length > 1 && (
          <div className="gallery-carousel-counter">
            {currentSlide + 1} / {imageList.length}
          </div>
        )}
      </div>
    );
  },
);

ApplicationGalleryCarousel.displayName = 'ApplicationGalleryCarousel';

// =============================
// ✅ MODAL CONTENU - NOUVEAU DESIGN
// =============================
const ContentModal = memo(({ isOpen, onClose, title, children }) => {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Overflow séparé avec cleanup garanti
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Keyboard handler
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

  if (!isOpen) return null;

  return (
    <div className="content-modal-overlay" onClick={onClose}>
      <div
        className="content-modal-container"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="content-modal-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          <FaX />
        </button>
        <div className="content-modal-header">
          <h2 id="content-modal-title" className="content-modal-title">
            {title}
          </h2>
        </div>
        <div className="content-modal-body">{children}</div>
      </div>
    </div>
  );
});

ContentModal.displayName = 'ContentModal';

// =============================
// ✅ COMPOSANTS CONTENU
// =============================
const TechnicalInfo = memo(({ application, template, onExternalLinkClick }) => (
  <div className="modal-content-section">
    <div className="info-table-container">
      <table className="info-table">
        <tbody>
          <tr className="info-row">
            <td className="info-label">Template</td>
            <td className="info-value">
              {template?.template_name || 'Non spécifié'}
            </td>
          </tr>
          <tr className="info-row">
            <td className="info-label">Type</td>
            <td className="info-value">
              {getApplicationLevelLabel(application.application_level).long}
            </td>
          </tr>
          <tr className="info-row">
            <td className="info-label">Niveau</td>
            <td className="info-value">{application.application_level}</td>
          </tr>
          <tr className="info-row">
            <td className="info-label">Catégorie</td>
            <td className="info-value">{application.application_category}</td>
          </tr>
          {application.application_link && (
            <tr className="info-row">
              <td className="info-label">Lien boutique</td>
              <td className="info-value">
                <Link
                  href={application.application_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="info-link"
                  onClick={() =>
                    onExternalLinkClick('store', application.application_link)
                  }
                >
                  Voir la boutique
                </Link>
              </td>
            </tr>
          )}
          {application.application_admin_link && (
            <tr className="info-row">
              <td className="info-label">Gestion</td>
              <td className="info-value">
                <Link
                  href={application.application_admin_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="info-link"
                  onClick={() =>
                    onExternalLinkClick(
                      'admin',
                      application.application_admin_link,
                    )
                  }
                >
                  Interface admin
                </Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
));

TechnicalInfo.displayName = 'TechnicalInfo';

const SpecificNeeds = memo(() => (
  <div className="modal-content-section">
    <div className="needs-table-container">
      <table className="needs-table">
        <tbody>
          <tr className="needs-row">
            <td className="needs-item">
              <span className="needs-icon">🌐</span>
              <span className="needs-text">Hébergement web</span>
            </td>
          </tr>
          <tr className="needs-row">
            <td className="needs-item">
              <span className="needs-icon">💾</span>
              <span className="needs-text">Base de données</span>
            </td>
          </tr>
          <tr className="needs-row">
            <td className="needs-item">
              <span className="needs-icon">🔗</span>
              <span className="needs-text">Nom de domaine</span>
            </td>
          </tr>
          <tr className="needs-row free-tools">
            <td className="needs-item">
              <span className="needs-icon">🎁</span>
              <span className="needs-text">Autres outils gratuits</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
));

SpecificNeeds.displayName = 'SpecificNeeds';

const PricingSection = memo(({ application }) => (
  <div className="modal-content-section">
    <div className="pricing-table-container">
      <table className="pricing-table">
        <tbody>
          <tr className="pricing-row">
            <td className="pricing-label">Acquisition</td>
            <td className="pricing-value">
              {formatPrice(application.application_fee)}
            </td>
          </tr>
          <tr className="pricing-row">
            <td className="pricing-label">Gestion</td>
            <td className="pricing-value">
              {formatPrice(application.application_rent)}/mois
            </td>
          </tr>
          <tr className="pricing-row">
            <td className="pricing-label">Autres charges</td>
            <td className="pricing-value">
              A determiner selon les besoins spécifiques de l&apos;application
            </td>
          </tr>
          <tr className="pricing-row total-row">
            <td className="pricing-label">Total</td>
            <td className="pricing-value">
              {formatPrice(
                application.application_fee + application.application_rent,
              )}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="pricing-note">
        <small>Francs Djiboutiens (FDJ)</small>
      </div>
    </div>
  </div>
));

PricingSection.displayName = 'PricingSection';

// =============================
// ✅ COMPOSANT PRINCIPAL
// =============================
const SingleApplication = ({ application, template, platforms, context }) => {
  const allImages = useMemo(() => {
    const mainImages = application?.application_images || [];
    const otherVersions = application?.application_other_versions || [];
    const combined = [...mainImages, ...otherVersions];
    const unique = [...new Set(combined)].filter(Boolean);
    return unique.length > 0 ? unique : ['/placeholder-application.png'];
  }, [application]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  // Ajouter avec les autres états :
  const [paymentError, setPaymentError] = useState(false);

  const paymentErrorTimerRef = useRef(null);

  const applicationId = context?.applicationId;

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (paymentErrorTimerRef.current)
        clearTimeout(paymentErrorTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (applicationId && application?.application_name) {
      try {
        trackEvent('application_page_view', {
          event_category: 'application',
          event_label: application.application_name,
          application_id: applicationId,
          total_images: allImages.length,
        });
      } catch (error) {
        console.warn('[Analytics] Error:', error);
      }
    }
  }, []);

  const handleCardClick = useCallback(
    (cardType) => {
      setActiveModal(cardType);
      try {
        trackEvent('card_click', {
          event_category: 'ui',
          event_label: cardType,
          application_id: applicationId,
        });
      } catch (error) {
        console.warn('[Analytics] Error:', error);
      }
    },
    [applicationId],
  );

  const handleModalClose = useCallback(() => {
    setActiveModal(null);
  }, []);

  const handleExternalLinkClick = useCallback(
    (linkType, url) => {
      try {
        trackEvent('external_link', {
          event_category: 'navigation',
          event_label: linkType,
          application_id: applicationId,
        });
      } catch (error) {
        console.warn('[Analytics] Error:', error);
      }
    },
    [applicationId],
  );

  const handleOrderModalOpen = useCallback(() => {
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
      trackEvent('order_modal_open', {
        event_category: 'ecommerce',
        application_id: applicationId,
      });
    } catch (error) {
      console.warn('[Analytics] Error:', error);
    }

    setIsModalOpen(true);
  }, [platforms, applicationId]);

  const handleOrderModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  if (!application || Object.keys(application).length === 0) {
    return (
      <div className="application-empty">
        <PageTracker pageName="application_empty" pageType="product_detail" />
        <section className="first">
          <Parallax bgColor="#0c0c1d" title="Application" planets="/sun.png" />
        </section>
        <section className="empty-state">
          <h2>Application non trouvée</h2>
          <p>Cette application n&apos;est pas disponible.</p>
          <Link href="/templates" className="cta-button">
            Voir les templates
          </Link>
        </section>
      </div>
    );
  }

  const hasPaymentMethods = platforms && platforms.length > 0;

  return (
    <div>
      <PageTracker
        pageName={`application_${context?.applicationId || 'unknown'}`}
        pageType="product_detail"
      />

      <section className="first">
        <Parallax
          bgColor="#0c0c1d"
          title={application.application_name}
          planets="/sun.png"
        />
      </section>

      <section className="others gallery-section">
        <ApplicationGalleryCarousel
          images={allImages}
          applicationName={application.application_name}
          applicationId={context?.applicationId}
        />
      </section>

      <section className="others cards-section">
        <div className="cards-section-container">
          <div className="cards-section-header">
            <div className="title-block">
              <h1 className="app-title">{application.application_name}</h1>
              <div className="app-badges">
                <div className="badge level-badge">
                  <span className="badge-value">
                    {
                      getApplicationLevelLabel(application.application_level)
                        .short
                    }
                  </span>
                </div>
                <div className="badge category-badge">
                  <span className="badge-value">
                    {application.application_category}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="cards-grid">
            {CARDS_CONFIG.map((card) => {
              const IconComponent = card.icon;
              return (
                <button
                  key={card.id}
                  className={`info-card card-${card.color}`}
                  onClick={() => handleCardClick(card.id)}
                >
                  <div className="card-icon">
                    <IconComponent size={36} />
                  </div>
                  <h3 className="card-title">{card.title}</h3>
                </button>
              );
            })}
          </div>

          <div className="order-button-container">
            <button
              onClick={handleOrderModalOpen}
              className={`btn btn-primary purchase-btn ${!hasPaymentMethods ? 'disabled' : ''}`}
              disabled={!hasPaymentMethods}
            >
              <span className="btn-icon">💳</span>
              <span className="btn-text">
                {!hasPaymentMethods ? 'Indisponible' : 'Commander'}
              </span>
            </button>

            {paymentError && (
              <div className="payment-error-message" role="alert">
                Aucune méthode de paiement disponible pour le moment.
              </div>
            )}
          </div>
        </div>
      </section>

      <ContentModal
        isOpen={activeModal === 'description'}
        onClose={handleModalClose}
        title="Description"
      >
        <div className="description-content">
          <p className="description-text">
            {application.application_description ||
              'Aucune description disponible.'}
          </p>
        </div>
      </ContentModal>

      <ContentModal
        isOpen={activeModal === 'technical'}
        onClose={handleModalClose}
        title="Informations Techniques"
      >
        <TechnicalInfo
          application={application}
          template={template}
          onExternalLinkClick={handleExternalLinkClick}
        />
      </ContentModal>

      <ContentModal
        isOpen={activeModal === 'needs'}
        onClose={handleModalClose}
        title="Besoins Spécifiques"
      >
        <SpecificNeeds />
      </ContentModal>

      <ContentModal
        isOpen={activeModal === 'pricing'}
        onClose={handleModalClose}
        title="Tarification"
      >
        <PricingSection application={application} />
      </ContentModal>

      <OrderModal
        isOpen={isModalOpen}
        onClose={handleOrderModalClose}
        platforms={platforms}
        applicationId={application.application_id}
        applicationFee={application.application_fee}
        applicationName={application.application_name}
        applicationCategory={application.application_category}
      />
    </div>
  );
};

export default SingleApplication;

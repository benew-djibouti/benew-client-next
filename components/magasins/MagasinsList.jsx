// components/magasins/MagasinsList.jsx
'use client';

import { useEffect, useCallback, useMemo, memo } from 'react';
import Link from 'next/link';
import PageTracker from '../analytics/PageTracker';
import Parallax from '../layouts/parallax';
import AppImage from '../templates/AppImage';
import { formatPrice, getApplicationLevelLabel } from '@/utils/helpers';
import { trackEvent } from '@/utils/analytics';
import * as pixel from '@/lib/fpixel';
import './magasinsStyles/index.scss';

// =============================
// SOUS-COMPOSANT CARTE — mémorisé
// =============================
const MagasinCard = memo(({ application, onCardClick }) => {
  const levelLabel = useMemo(
    () => getApplicationLevelLabel(application.application_level),
    [application.application_level],
  );

  const firstImage = useMemo(
    () => application.application_images?.[0] || null,
    [application.application_images],
  );

  return (
    <div className="magasins-card">
      {/* Image */}
      <div className="magasins-card-image">
        {firstImage ? (
          <AppImage
            src={firstImage}
            alt={application.application_name}
            width={400}
            height={250}
            className="magasins-card-img"
          />
        ) : (
          <div className="magasins-card-img-placeholder" />
        )}

        {/* Badge catégorie */}
        <span
          className={`magasins-badge magasins-badge--${application.application_category}`}
        >
          {application.application_category === 'web' ? 'Web' : 'Mobile'}
        </span>
      </div>

      {/* Corps */}
      <div className="magasins-card-body">
        <h3 className="magasins-card-name">{application.application_name}</h3>

        <span className="magasins-card-level">
          {levelLabel?.label || `Niveau ${application.application_level}`}
        </span>

        <div className="magasins-card-pricing">
          <p className="magasins-card-fee">
            {formatPrice(application.application_fee)} <span>DJF</span>
          </p>
          <p className="magasins-card-rent">
            {formatPrice(application.application_rent)} <span>DJF / mois</span>
          </p>
        </div>

        <Link
          href={`/templates/${application.application_template_id}/applications/${application.application_id}`}
          className="magasins-card-btn"
          onClick={() => onCardClick(application)}
        >
          Voir détail
        </Link>
      </div>
    </div>
  );
});

MagasinCard.displayName = 'MagasinCard';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const MagasinsList = ({
  initialApplications = [],
  success = true,
  error = null,
  errorCode = null,
}) => {
  // =============================
  // TRACKING — vue de la page
  // =============================
  useEffect(() => {
    if (!success || initialApplications.length === 0) return;

    try {
      trackEvent('magasins_page_view', {
        event_category: 'magasins',
        event_label: 'magasins_list',
        applications_count: initialApplications.length,
      });

      pixel.event('ViewChannel', {
        content_name: 'Magasins Benew',
        content_category: 'Applications',
        num_items: initialApplications.length,
      });
    } catch (e) {
      console.warn('[Analytics] Error tracking magasins view:', e);
    }
  }, [initialApplications, success]);

  // =============================
  // HANDLER CLIC CARTE
  // =============================
  const handleCardClick = useCallback((application) => {
    try {
      trackEvent('application_card_click', {
        event_category: 'ecommerce',
        event_label: application.application_name,
        application_id: application.application_id,
        application_level: application.application_level,
        application_category: application.application_category,
        template_id: application.application_template_id,
      });
    } catch (e) {
      console.warn('[Analytics] Error tracking application card click:', e);
    }
  }, []);

  // =============================
  // DONNÉES DÉRIVÉES
  // =============================
  const webApplications = useMemo(
    () =>
      initialApplications.filter((app) => app.application_category === 'web'),
    [initialApplications],
  );

  const mobileApplications = useMemo(
    () =>
      initialApplications.filter(
        (app) => app.application_category === 'mobile',
      ),
    [initialApplications],
  );

  // =============================
  // RENDER
  // =============================
  return (
    <div className="magasins-container">
      <PageTracker
        pageName="magasins"
        pageType="catalog"
        sections={[
          'hero_parallax',
          'applications_grid',
          'web_applications',
          'mobile_applications',
        ]}
      />

      {/* PARALLAX */}
      <section className="first">
        <Parallax bgColor="#0c0c1d" title="MAGASINS" planets="/sun.png" />
      </section>

      {/* CONTENU */}
      <div className="magasins-content">
        {/* État d'erreur */}
        {!success && (
          <div className="magasins-error">
            <h2>Une erreur est survenue</h2>
            <p>
              {error || 'Impossible de charger les magasins pour le moment.'}
            </p>
            {process.env.NODE_ENV !== 'production' && errorCode && (
              <small>Code: {errorCode}</small>
            )}
          </div>
        )}

        {/* État vide */}
        {success && initialApplications.length === 0 && (
          <div className="magasins-empty">
            <h2>Aucun magasin disponible</h2>
            <p>Revenez bientôt pour découvrir nos applications.</p>
          </div>
        )}

        {/* Grille */}
        {success && initialApplications.length > 0 && (
          <>
            {/* Applications Web */}
            {webApplications.length > 0 && (
              <div className="magasins-section">
                <h2 className="magasins-section-title">
                  Applications Web
                  <span className="magasins-section-count">
                    {webApplications.length}
                  </span>
                </h2>
                <div className="magasins-grid">
                  {webApplications.map((application) => (
                    <MagasinCard
                      key={application.application_id}
                      application={application}
                      onCardClick={handleCardClick}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Applications Mobile */}
            {mobileApplications.length > 0 && (
              <div className="magasins-section">
                <h2 className="magasins-section-title">
                  Applications Mobile
                  <span className="magasins-section-count">
                    {mobileApplications.length}
                  </span>
                </h2>
                <div className="magasins-grid">
                  {mobileApplications.map((application) => (
                    <MagasinCard
                      key={application.application_id}
                      application={application}
                      onCardClick={handleCardClick}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MagasinsList;

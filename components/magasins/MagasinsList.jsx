'use client';

import Link from 'next/link';
import PageTracker from '../analytics/PageTracker';
import Parallax from '../layouts/parallax';
import AppImage from '../templates/AppImage';
import { formatPrice, getApplicationLevelLabel } from '@/utils/helpers';
import { trackEvent } from '@/utils/analytics';
import * as pixel from '@/lib/fpixel';
import './magasinsStyles/index.scss';

const MagasinsList = ({ initialApplications = [], success, error }) => {
  const handleApplicationClick = (application) => {
    try {
      trackEvent('application_click', {
        event_category: 'ecommerce',
        event_label: application.application_name,
        application_id: application.application_id,
        application_level: application.application_level,
      });

      pixel.event('ViewContent', {
        content_name: application.application_name,
        content_ids: [application.application_id],
        content_type: 'product',
        value: application.application_fee,
        currency: 'DJF',
      });
    } catch (e) {
      console.warn('[Analytics] Error tracking application click:', e);
    }
  };

  return (
    <div className="magasins-container">
      <PageTracker
        pageName="magasins"
        pageType="catalog"
        sections={['hero_parallax', 'applications_grid']}
      />

      <section className="first">
        <Parallax bgColor="#0c0c1d" title="MAGASINS" planets="/sun.png" />
      </section>

      <div className="magasins-content">
        {/* État d'erreur */}
        {!success && (
          <div className="magasins-error">
            <p>{error || 'Une erreur est survenue.'}</p>
          </div>
        )}

        {/* État vide */}
        {success && initialApplications.length === 0 && (
          <div className="magasins-empty">
            <h2>Aucun magasin disponible</h2>
            <p>Revenez bientôt pour découvrir nos applications.</p>
          </div>
        )}

        {/* Grille des applications */}
        {success && initialApplications.length > 0 && (
          <div className="magasins-grid">
            {initialApplications.map((application) => {
              const levelLabel = getApplicationLevelLabel(
                application.application_level,
              );
              const firstImage = application.application_images?.[0] || null;

              return (
                <div key={application.application_id} className="magasins-card">
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
                      {application.application_category === 'web'
                        ? 'Web'
                        : 'Mobile'}
                    </span>
                  </div>

                  {/* Contenu de la carte */}
                  <div className="magasins-card-body">
                    <h3 className="magasins-card-name">
                      {application.application_name}
                    </h3>

                    <span className="magasins-card-level">
                      {levelLabel?.label ||
                        `Niveau ${application.application_level}`}
                    </span>

                    <div className="magasins-card-pricing">
                      <p className="magasins-card-fee">
                        {formatPrice(application.application_fee)}{' '}
                        <span>DJF</span>
                      </p>
                      <p className="magasins-card-rent">
                        {formatPrice(application.application_rent)}{' '}
                        <span>DJF / mois</span>
                      </p>
                    </div>

                    <Link
                      href={`/templates/${application.application_template_id}/applications/${application.application_id}`}
                      className="magasins-card-btn"
                      onClick={() => handleApplicationClick(application)}
                    >
                      Voir détail
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MagasinsList;

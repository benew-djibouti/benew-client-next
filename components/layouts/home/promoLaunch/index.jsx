'use client';

import './index.scss';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MdStorefront, MdStar, MdRocketLaunch } from 'react-icons/md';

const promoTiers = [
  {
    id: 1,
    icon: MdStar,
    rank: '10 premiers clients',
    months: 4,
    label: 'mois offerts',
    description: "Sans frais d'abonnement",
    color: 'orange',
    badge: 'Offre de lancement',
  },
  {
    id: 2,
    icon: MdRocketLaunch,
    rank: '10 clients suivants',
    months: 3,
    label: 'mois offerts',
    description: "Sans frais d'abonnement",
    color: 'pink',
    badge: 'Offre de lancement',
  },
  {
    id: 3,
    icon: MdStorefront,
    rank: '10 derniers clients',
    months: 2,
    label: 'mois offert',
    description: "Sans frais d'abonnement",
    color: 'purple',
    badge: 'Offre de lancement',
  },
];

const PromoLaunch = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(() => {
    // Initialisation lazy — exécutée une seule fois
    // typeof window vérifie qu'on est bien côté client
    if (typeof window === 'undefined') return false; // serveur → false
    return window.innerWidth < 768; // client → valeur réelle immédiate
  });

  useEffect(() => {
    let debounceTimer;
    const handleResize = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setIsMobile(window.innerWidth < 768);
      }, 200);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(debounceTimer);
    };
  }, []);

  // Auto-play slider — seulement sur mobile
  useEffect(() => {
    if (!isMobile) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % promoTiers.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isMobile]);

  return (
    <div className="promo-container">
      {/* HEADER */}
      <div className="promo-header">
        <p className="promo-subtitle">Offre de bienvenue</p>
        <h2 className="promo-title">Lancement Exclusif</h2>
        <p className="promo-description">
          Pour les 30 premiers clients qui rejoignent l&apos;aventure, profitez
          de mois gratuits sans frais d&apos;abonnement.
        </p>
      </div>

      {/* CARDS + DOTS groupés */}
      <div className="promo-cards-group">
        {/* CARTES */}
        <div className="promo-cards">
          {promoTiers.map((tier, index) => {
            const IconComponent = tier.icon;
            return (
              <div
                key={tier.id}
                className={`promo-card promo-card--${tier.color} ${
                  isMobile && index !== activeIndex ? 'promo-card--hidden' : ''
                }`}
              >
                {/* Badge */}
                <div className="promo-card__badge">{tier.badge}</div>

                {/* Icône */}
                <div className="promo-card__icon">
                  <IconComponent />
                </div>

                {/* Rang */}
                <p className="promo-card__rank">{tier.rank}</p>

                {/* Nombre de mois */}
                <div className="promo-card__months">
                  <span className="promo-card__months-number">
                    {tier.months}
                  </span>
                  <span className="promo-card__months-label">{tier.label}</span>
                </div>

                {/* Description */}
                <p className="promo-card__description">{tier.description}</p>
              </div>
            );
          })}
        </div>

        {/* DOTS - seulement sur mobile */}
        {isMobile && (
          <div className="promo-dots">
            {promoTiers.map((tier, index) => (
              <button
                key={tier.id}
                className={`promo-dot promo-dot--${tier.color} ${
                  index === activeIndex ? 'promo-dot--active' : ''
                }`}
                onClick={() => setActiveIndex(index)}
                aria-label={`Aller à la carte ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* BOUTON */}
      <div className="promo-cta">
        <Link href="/templates" className="promo-cta__button">
          Visiter la boutique
        </Link>
      </div>
    </div>
  );
};

export default PromoLaunch;

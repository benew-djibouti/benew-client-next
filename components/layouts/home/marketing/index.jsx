'use client';

import './index.scss';
import Image from 'next/image';
import Link from 'next/link';
import MobileMarketing from './MobileMarketing';

const MarketingHome = () => {
  return (
    <>
      {/* Version mobile — composant dédié */}
      <div className="mobile-marketing-wrapper">
        <MobileMarketing />
      </div>

      {/* Version tablette + desktop */}
      <div className="main-content desktop-tablet-content">
        <Image
          src="/tirelire.png"
          alt="Tirelire symbolisant l'économie et les profits"
          width={256}
          height={384}
          className="profit-image"
          priority
        />

        <div className="text-container">
          <h2 className="main-title">GÉNÈRES PLUS DE PROFIT,</h2>
          <h2 className="main-title">PAIES MOINS DE CHARGES</h2>

          <Link href="/channel" className="profit-blog-link">
            En savoir plus
          </Link>
        </div>
      </div>
    </>
  );
};

export default MarketingHome;

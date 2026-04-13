// components/layouts/home/marketing/MobileMarketing.jsx
'use client';

import Link from 'next/link';

const MobileMarketing = () => {
  return (
    <div className="mobile-marketing">
      <div className="mobile-marketing__text">
        <h2 className="main-title">GÉNÈRES PLUS DE PROFIT,</h2>
        <h2 className="main-title">PAIES MOINS DE CHARGES</h2>
        <Link href="/channel" className="profit-blog-link">
          En savoir plus
        </Link>
      </div>
    </div>
  );
};

export default MobileMarketing;

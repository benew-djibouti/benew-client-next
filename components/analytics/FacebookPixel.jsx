'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import * as pixel from '../../lib/fpixel';

const FacebookPixel = () => {
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();

  // APRÈS — ajouter un useEffect séparé pour la première visite
  useEffect(() => {
    if (!loaded) return;
    pixel.pageview(); // ← déclenche PageView dès que le script est chargé
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    pixel.pageview(); // ← déclenche PageView à chaque changement de route
  }, [pathname]);

  return (
    <div>
      <Script
        id="fb-pixel"
        src="/scripts/pixel.js"
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
        data-pixel-id={pixel.FB_PIXEL_ID}
      />
    </div>
  );
};

export default FacebookPixel;

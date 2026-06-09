// app/layout.js - VERSION CORRIGÉE
// Next.js 15.5.9 - E-commerce Djibouti (500 users/jour)
// Corrections : next/font intégré, GTM sanitisé, AudioProvider supprimé

// =============================
// 🔴 CRITIQUE - NEXT/FONT INTÉGRÉ
// =============================
import { josefinSans, josefinSlab } from './fonts';

import './styles/main.scss';
import Navbar from '../components/layouts/navbar';
import AnalyticsInitializer from '../components/analytics/AnalyticsInitializer';
import { HydrationFix } from '@/components/layouts/hydrationFix';
import FacebookPixel from '@/components/analytics/FacebookPixel';

// =============================
// MÉTADONNÉES GLOBALES
// =============================
export const metadata = {
  metadataBase: new URL('https://benew-dj.com'),
  title: {
    default: 'Benew - Templates et Applications Web & Mobile',
    template: '%s | Benew',
  },
  description:
    'Découvrez nos templates premium et applications web & mobile. Solutions professionnelles pour votre business en ligne.',
  keywords: [
    'templates',
    'applications web',
    'mobile apps',
    'e-commerce',
    'Djibouti',
  ],
  authors: [{ name: 'Benew', url: 'https://benew-dj.com' }],
  creator: 'Benew',
  publisher: 'Benew',

  // OpenGraph pour réseaux sociaux
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://benew-dj.com',
    siteName: 'Benew',
    title: 'Benew - Templates et Applications Web & Mobile',
    description:
      'Découvrez nos templates premium et applications web & mobile. Solutions professionnelles pour votre business en ligne.',
    // ✅ DÉCOMMENTÉ - Images OpenGraph
    images: [
      {
        url: '/og-image.png', // À créer : 1200×630 pixels
        width: 1200,
        height: 630,
        alt: 'Benew - Templates et Applications Web & Mobile',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Benew - Templates et Applications Web & Mobile',
    description:
      'Découvrez nos templates premium et applications web & mobile.',
    images: ['/og-image.png'], // ✅ Même image que OpenGraph
  },

  // Métadonnées techniques
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Métadonnées additionnelles
  category: 'technology',
  classification: 'business',
  referrer: 'origin-when-cross-origin',

  // Liens alternatifs
  alternates: {
    canonical: 'https://benew-dj.com',
    languages: {
      'fr-FR': 'https://benew-dj.com',
    },
  },

  // ✅ DÉCOMMENTÉ - Icônes et manifeste
  // REMPLACER les deux blocs icons + manifest par ceci :
  icons: {
    icon: [
      { url: '/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-180x180.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/icon-48x48.png',
  },
  manifest: '/manifest', // ← corriger /site.webmanifest → /manifest

  // AJOUTER — support iOS "Add to Home Screen"
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Benew',
  },
};

// =============================
// 🔐 SÉCURITÉ - SANITIZATION GTM
// =============================
/**
 * Sanitize GTM Container ID pour prévenir injection XSS
 * Retire tous caractères dangereux, garde seulement A-Z, 0-9, et tiret
 * @param {string} id - GTM Container ID brut
 * @returns {string} - ID sanitisé
 */
function sanitizeGTMId(id) {
  if (!id || typeof id !== 'string') return '';
  // Retire TOUT sauf lettres majuscules, chiffres, et tiret
  return id.replace(/[^A-Z0-9-]/g, '');
}

/**
 * Valide le format GTM Container ID
 * Format attendu : GTM-XXXXXXX (7+ caractères alphanumériques après GTM-)
 * @param {string} id - GTM Container ID à valider
 * @returns {boolean} - true si format valide
 */
function isValidGTMId(id) {
  if (!id) return false;
  // Format strict : GTM- suivi de 7+ caractères alphanumériques
  return /^GTM-[A-Z0-9]{7,}$/.test(id);
}

export default function RootLayout({ children }) {
  // =============================
  // GTM CONTAINER ID - SÉCURISÉ
  // =============================
  const rawGtmId = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID;
  const gtmId = sanitizeGTMId(rawGtmId);
  const gtmValid = isValidGTMId(gtmId);

  // Log en développement pour debug
  if (process.env.NODE_ENV === 'development') {
    if (!gtmValid && rawGtmId) {
      console.warn(
        `[Layout] GTM Container ID invalide : "${rawGtmId}"`,
        '\nFormat attendu : GTM-XXXXXXX',
      );
    } else if (gtmValid) {
      console.log(`[Layout] GTM Container ID valide : ${gtmId}`);
    }
  }

  return (
    <html
      lang="fr"
      className={`${josefinSans.variable} ${josefinSlab.variable}`}
    >
      <head>
        {/* ⭐ CRITIQUE : Script pré-hydratation en PREMIER */}
        <HydrationFix />

        {/* GTM Script Natif - SÉCURISÉ - DANS LE HEAD */}
        {gtmValid && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
        )}
      </head>
      <body>
        {/* ✅ SUPPRIMÉ - AudioProvider retiré comme demandé */}
        <Navbar />
        {children}

        {/* AnalyticsInitializer après contenu */}
        {gtmValid && (
          <AnalyticsInitializer
            isDevelopment={process.env.NODE_ENV === 'development'}
          />
        )}
        <FacebookPixel />
      </body>
    </html>
  );
}

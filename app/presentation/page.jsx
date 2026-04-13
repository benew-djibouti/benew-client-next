// app/presentation/page.jsx
// Server Component enrichi pour page de présentation
// Next.js 15 - Gestion d'erreurs avancée + Monitoring complet + Validation contenu

import PresentationComponent from '@/components/presentation';

/**
 * Composant principal avec validation et gestion d'erreurs avancée
 */
export default async function PresentationPage() {
  return <PresentationComponent />;
}

// Metadata pour SEO avec focus sur le contenu de présentation
export const metadata = {
  title: 'Présentation - Benew | Notre Vision et Nos Produits',
  description:
    'Découvrez la vision de Benew, nos produits innovants et notre fondateur. Solutions technologiques modernes pour le développement de Djibouti.',
  keywords: [
    'benew présentation',
    'vision entreprise',
    'produits innovants',
    'fondateur',
    'développement Djibouti',
  ],
  openGraph: {
    title: 'Présentation Benew - Notre Vision',
    description: 'Notre manifeste, nos produits et notre fondateur.',
    url: `/presentation`,
    type: 'website',
    locale: 'fr_FR',
  },
  alternates: {
    canonical: `/presentation`,
  },
};

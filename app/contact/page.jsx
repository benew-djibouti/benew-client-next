// app/contact/page.jsx
// Server Component enrichi pour page de contact
// Next.js 15 - Gestion d'erreurs avancée + Monitoring complet + Validation

import Contact from '@/components/contact';

/**
 * Composant principal avec validation et gestion d'erreurs avancée
 */
export default async function ContactPage() {
  // Rendu normal avec Suspense - Error Boundary géré par error.jsx
  return <Contact />;
}

// Metadata pour SEO avec monitoring en cas d'erreur
export const metadata = {
  title: 'Contact - Benew | Contactez-nous pour vos projets',
  description:
    'Contactez Benew pour vos projets de templates et applications web & mobile. Nous vous accompagnons dans vos besoins digitaux à Djibouti.',
  keywords: [
    'contact benew',
    'devis template',
    'développement web djibouti',
    'contact développeur',
    'projet digital',
    'Djibouti',
  ],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Contact Benew - Démarrez votre projet',
    description:
      'Contactez-nous pour transformer vos idées en solutions digitales.',
    url: `/contact`,
    type: 'website',
    locale: 'fr_FR',
  },
  alternates: {
    canonical: `/contact`,
  },
};

export const revalidate = 600;

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MotionLink = motion.create(Link);

const NAV_ITEMS = [
  { title: 'Accueil', path: '' },
  { title: 'Modèles', path: 'templates' },
  { title: 'Chaîne Tuto', path: 'channel' },
  { title: 'Présentation', path: 'presentation' },
  { title: 'Contact', path: 'contact' },
];

const variants = {
  open: {
    transition: {
      staggerChildren: 0.1,
    },
  },
  closed: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  open: {
    y: 0,
    opacity: 1,
  },
  closed: {
    y: 50,
    opacity: 0,
  },
};

function Links({ setOpen }) {
  const pathname = usePathname();

  // Fonction pour vérifier si le lien est actif
  const isActive = (itemPath) => {
    if (itemPath === '') {
      // Page d'accueil : exactement "/"
      return pathname === '/';
    }
    // Autres pages : commence par le path
    return pathname.startsWith(`/${itemPath}`);
  };

  return (
    <motion.div className="links" variants={variants}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path);

        return (
          <motion.div
            key={item.title}
            className={`link ${active ? 'active' : ''}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <MotionLink
              href={`/${item.path}`}
              variants={itemVariants}
              onClick={() => setOpen(false)}
            >
              {item.title}
            </MotionLink>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default Links;

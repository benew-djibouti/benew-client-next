'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

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

function Links() {
  const pathname = usePathname();

  const items = [
    {
      title: 'Accueil',
      path: '',
    },
    {
      title: 'Modèles',
      path: 'templates',
    },
    {
      title: 'Chaîne Tuto',
      path: 'channel',
    },
    {
      title: 'Présentation',
      path: 'presentation',
    },
    {
      title: 'Contact',
      path: 'contact',
    },
  ];

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
      {items.map((item) => {
        const active = isActive(item.path);

        return (
          <motion.div
            key={item.title}
            className={`link ${active ? 'active' : ''}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.a href={`/${item.path}`} variants={itemVariants}>
              {item.title}
            </motion.a>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default Links;

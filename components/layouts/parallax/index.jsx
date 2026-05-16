'use client';

import { useRef } from 'react';
import './parallax.scss';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion';

function Parallax({ bgColor, title, planets }) {
  const ref = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  // Si reduced motion préféré → valeurs statiques (0 mouvement)
  const yText = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? ['0%', '0%'] : ['0%', '500%'],
  );
  const yBg = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? ['0%', '0%'] : ['0%', '100%'],
  );

  // Calculé directement — pas de useState ni useEffect
  const backgroundStyle = bgColor ? { background: bgColor } : {};
  const planetsStyle =
    planets && typeof planets === 'string'
      ? { backgroundImage: `url(${planets})` }
      : {};

  return (
    <div className="parallax" ref={ref} style={backgroundStyle}>
      {title && <motion.h1 style={{ y: yText }}>{title}</motion.h1>}
      <motion.div className="mountains" />
      <motion.div className="planets" style={{ y: yBg, ...planetsStyle }} />
      <motion.div style={{ x: yBg }} className="stars" />
    </div>
  );
}

export default Parallax;

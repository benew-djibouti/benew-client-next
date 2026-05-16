'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import './index.scss';
import { trackEvent } from '@/utils/analytics';
import Link from 'next/link';

const textVariants = {
  initial: {
    x: -500,
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 1,
      staggerChildren: 0.1,
    },
  },
  scrollButton: {
    opacity: 0,
    y: 10,
    transition: {
      duration: 2,
      repeat: Infinity,
    },
  },
};

const sliderVariants = {
  initial: {
    x: 0,
  },
  animate: {
    x: '-30%',
    transition: {
      repeat: Infinity,
      repeatType: 'mirror',
      duration: 10,
    },
  },
};

const MotionLink = motion.create(Link);
const MotionImage = motion.create(Image);

function Hero() {
  return (
    <div className="hero">
      <div className="wrapper">
        <motion.div
          className="textContainer"
          variants={textVariants}
          initial="initial"
          animate="animate"
        >
          <motion.h2 variants={textVariants}>
            LES MAGASINS DE L&apos;ESPOIR
          </motion.h2>
          <motion.h1 variants={textVariants}>
            COMMENCES TON HISTOIRE !
          </motion.h1>
          <motion.div className="buttonGroup" variants={textVariants}>
            <MotionLink
              href="/templates"
              className="primaryButton"
              onClick={() => {
                try {
                  trackEvent('cta_click', {
                    event_category: 'hero',
                    event_label: 'discover_templates',
                    button_type: 'primary',
                    page_section: 'hero',
                  });
                } catch (e) {
                  console.warn('[Analytics] Error tracking CTA click:', e);
                }
              }}
            >
              Découvrez Nos Magasins
            </MotionLink>
            <MotionLink href="/presentation" className="secondaryButton">
              BENEW
            </MotionLink>
          </motion.div>
          <MotionImage
            src="/scroll.png"
            alt="Défiler vers le bas"
            title="Défiler vers le bas"
            variants={textVariants}
            animate="scrollButton"
          />
        </motion.div>
      </div>
      <motion.div
        className="slidingTextContainer"
        variants={sliderVariants}
        initial="initial"
        animate="animate"
      >
        BENEW
      </motion.div>
      <div className="imageContainer">
        <Image
          src="/hero.png"
          alt="Ordinateur avec des etoiles et du dollar"
          width={500}
          height={500}
          className="heroImage"
          priority
        />
      </div>
    </div>
  );
}

export default Hero;

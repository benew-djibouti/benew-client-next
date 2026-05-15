'use client';

import './styles/index.scss';
import { useRef, useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { MdMail, MdPhone, MdWhatsapp, MdContactPage } from 'react-icons/md';

import FormContainer from './formContainer';
import ContactInfoModal from './ContactInfoModal';
import { trackEvent } from '@/utils/analytics';
import PageTracker from '../analytics/PageTracker';
import Parallax from '../layouts/parallax';

// Composant d'élément de contact mémorisé
const ContactItem = memo(({ icon: Icon, text, variants }) => (
  <motion.div className="item" variants={variants}>
    <div className="icon">
      <Icon />
    </div>
    <p>{text}</p>
  </motion.div>
));

ContactItem.displayName = 'ContactItem';

// Composant des informations de contact mémorisé
const ContactInfo = memo(({ variants }) => (
  <div className="content-wrapper">
    <motion.h1 variants={variants}>Coordonnées</motion.h1>
    <ContactItem icon={MdPhone} text="77.86.00.64" variants={variants} />
    <ContactItem icon={MdPhone} text="77.19.68.18" variants={variants} />
    <ContactItem icon={MdWhatsapp} text="77.86.00.64" variants={variants} />
    <ContactItem
      icon={MdMail}
      text="benew-tech@benew-dj.com"
      variants={variants}
    />
    <ContactItem
      icon={MdMail}
      text="service-client@benew-dj.com"
      variants={variants}
    />
  </div>
));

ContactInfo.displayName = 'ContactInfo';

// Animations simplifiées
const variants = {
  initial: {
    y: 500,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      staggerChildren: 0.1,
    },
  },
};

// Composant principal
const Contact = () => {
  const ref = useRef();
  // const [isCollapsed, setIsCollapsed] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handler pour l'ouverture de la modal
  const handleOpenModal = useCallback(() => {
    trackEvent('contact_info_modal_open', {
      event_category: 'contact',
      event_label: 'modal_opened',
      trigger: 'button_click',
    });

    setIsModalOpen(true);
  }, []);

  // Handler pour la fermeture de la modal
  const handleCloseModal = useCallback(() => {
    trackEvent('contact_info_modal_close', {
      event_category: 'contact',
      event_label: 'modal_closed',
    });

    setIsModalOpen(false);
  }, []);

  return (
    <div>
      <PageTracker
        pageName="contact"
        pageType="conversion"
        sections={[
          'hero_parallax',
          'contact_form',
          'contact_info',
          'form_interactions',
        ]}
      />

      <section className="first">
        <Parallax bgColor="#0c0c1d" title="Contact" planets="/planets.png" />
      </section>

      {/* ✅ SECTION OTHERS avec position: relative pour contenir le bouton absolute */}
      <section className="others contact-section-wrapper">
        {/* ✅ BOUTON FIXE - Position absolute dans la section */}
        <button
          className="contact-info-trigger"
          onClick={handleOpenModal}
          aria-label="Afficher les coordonnées"
        >
          <MdContactPage />
          Coordonnées
        </button>

        {/* MODAL COORDONNÉES */}
        <ContactInfoModal isOpen={isModalOpen} onClose={handleCloseModal} />

        {/* CONTACT CONTAINER - Centré verticalement et horizontalement */}
        <motion.div
          ref={ref}
          className="contact"
          variants={variants}
          initial="initial"
          whileInView="animate"
        >
          {/* TextContainer - Visible uniquement sur DESKTOP */}
          <motion.div className="textContainer" variants={variants}>
            <ContactInfo variants={variants} />
          </motion.div>

          {/* FormContainer - Toujours visible, centré sur mobile */}
          <FormContainer />
        </motion.div>
      </section>
    </div>
  );
};

export default Contact;

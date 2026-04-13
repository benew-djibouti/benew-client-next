'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdMail, MdPhone, MdWhatsapp } from 'react-icons/md';

// Composant d'élément de contact mémorisé (réutilisé)
const ContactItem = memo(({ icon: Icon, text }) => (
  <div className="modal-contact-item">
    <div className="modal-contact-icon">
      <Icon />
    </div>
    <p>{text}</p>
  </div>
));

ContactItem.displayName = 'ContactItem';

// Animations de la modal
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
    y: 50,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: 50,
    transition: {
      duration: 0.2,
    },
  },
};

const ContactInfoModal = ({ isOpen, onClose }) => {
  // Fermeture au clic sur l'overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="contact-info-modal-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={handleOverlayClick}
        >
          <motion.div
            className="contact-info-modal-content"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <h2>Coordonnées</h2>

            <div className="modal-contact-items">
              <ContactItem icon={MdPhone} text="77.86.00.64" />
              <ContactItem icon={MdPhone} text="77.19.68.18" />
              <ContactItem icon={MdWhatsapp} text="77.19.68.18" />
              <ContactItem icon={MdMail} text="benew-tech@benew-dj.com" />
              <ContactItem icon={MdMail} text="service-client@benew-dj.com" />
            </div>

            <button
              className="modal-close-button"
              onClick={onClose}
              aria-label="Fermer la modal des coordonnées"
            >
              Fermer
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default memo(ContactInfoModal);

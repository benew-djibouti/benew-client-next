'use client';

import { useEffect, useRef } from 'react';
import './presentationModal/index.scss';

const PresentationModal = ({ isOpen, onClose, content }) => {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Focus management — ouverture et fermeture
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Escape + focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableSelectors = [
        'button',
        'a[href]',
        'input',
        'textarea',
        'select',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      const focusableElements = Array.from(
        modalRef.current?.querySelectorAll(focusableSelectors) || [],
      ).filter((el) => !el.disabled);

      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !content) return null;

  return (
    <div className="modalOverlay" onClick={onClose} aria-hidden="true">
      <div
        className="modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title" // ← pointe vers le h2
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalContent">
          <h2>{content.title}</h2>
          <div className="modalText">
            {content.paragraphs
              .filter((paragraph) => paragraph !== '')
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>
          <button
            onClick={onClose}
            className="closeButton"
            aria-label="Fermer la modal"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresentationModal;

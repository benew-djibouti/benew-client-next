// components/modal/OrderModal.jsx
'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createOrder } from '../../actions/orderActions';
import './orderStyles/index.scss';

import {
  trackPurchase,
  trackModalOpen,
  trackModalClose,
} from '@/utils/analytics';
import { formatPrice } from '@/utils/helpers';

// Valeurs initiales extraites pour pouvoir les réutiliser proprement
const INITIAL_FORM_DATA = {
  name: '',
  email: '',
  phone: '',
  paymentMethods: [], // tableau d'UUIDs sélectionnés
};

const OrderModal = ({
  isOpen,
  onClose,
  platforms,
  applicationId,
  applicationFee,
  applicationName, // ← ajouter
  applicationCategory, // ← ajouter
}) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  // Ajouter une ref sur la modale
  const modalRef = useRef(null);

  // Plateformes sélectionnées par l'utilisateur
  const selectedPlatforms = useMemo(
    () =>
      platforms?.filter((p) =>
        formData.paymentMethods.includes(p.platform_id),
      ) || [],
    [platforms, formData.paymentMethods],
  );

  // Y a-t-il du cash parmi les sélections ?
  const hasCashPayment = useMemo(
    () => selectedPlatforms.some((p) => p.is_cash_payment),
    [selectedPlatforms],
  );

  // Toutes les plateformes électroniques disponibles (pour l'étape 4)
  const electronicPlatforms = useMemo(
    () =>
      !platforms
        ? []
        : platforms.filter(
            (p) => !p.is_cash_payment && p.account_name && p.account_number,
          ),
    [platforms],
  );

  const closeModal = useCallback(
    (reason = 'user_close') => {
      if (isSubmitting) return;
      try {
        trackModalClose('order_modal', reason);
      } catch (error) {
        console.warn('[Analytics] Error tracking modal close:', error);
      }
      onClose();
    },
    [isSubmitting, onClose],
  );

  // Focus trap + focus initial à l'ouverture
  useEffect(() => {
    if (!isOpen) return;

    // Déplacer le focus dans la modale à l'ouverture
    const previousFocus = document.activeElement;
    modalRef.current?.focus();

    const handleFocusTrap = (e) => {
      if (!modalRef.current) return;

      // Tous les éléments focusables dans la modale
      const focusableSelectors = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      const focusableElements = Array.from(
        modalRef.current.querySelectorAll(focusableSelectors),
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift+Tab : si on est sur le premier élément, aller au dernier
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab : si on est sur le dernier élément, aller au premier
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }

      // Dans le useEffect du focus trap, ajouter :
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleFocusTrap);

    return () => {
      document.removeEventListener('keydown', handleFocusTrap);
      // Rendre le focus à l'élément qui avait le focus avant l'ouverture
      previousFocus?.focus();
    };
  }, [isOpen, step, closeModal]); // ← step en dépendance car les éléments focusables changent entre étapes

  // Reset à chaque fermeture
  useEffect(() => {
    if (!isOpen) {
      // Délai court pour laisser l'animation de fermeture se terminer
      // avant de réinitialiser — évite un flash visuel du contenu réinitialisé
      const timeout = setTimeout(() => {
        setStep(1);
        setError('');
        setFormData(INITIAL_FORM_DATA);
      }, 300);

      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  // Tracker l'ouverture/fermeture de la modal
  useEffect(() => {
    if (isOpen) {
      try {
        trackModalOpen('order_modal', `application_${applicationId}`);
      } catch (error) {
        console.warn('[Analytics] Error tracking modal open:', error);
      }
    }
  }, [isOpen, applicationId]);

  // Par :
  const handleInputChange = useCallback(
    (e) => {
      const { name, value, type, checked } = e.target;
      if (name === 'paymentMethods') {
        const updated = checked
          ? [...formData.paymentMethods, value]
          : formData.paymentMethods.filter((id) => id !== value);
        setFormData((prev) => ({ ...prev, paymentMethods: updated }));
      } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
    },
    [formData.paymentMethods],
  );

  const validateStep1 = useCallback(() => {
    if (!formData.name || !formData.email || !formData.phone) {
      setError('Veuillez remplir tous les champs requis');
      return false;
    }

    if (formData.name.trim().length < 3) {
      setError('Le nom doit contenir au moins 3 caractères');
      return false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError('Veuillez fournir une adresse email valide');
      return false;
    }

    // Nettoyer le numéro — retirer espaces, tirets, indicatif pays
    const cleanPhone = formData.phone
      .replace(/\D/g, '') // supprimer tout sauf les chiffres
      .replace(/^253/, ''); // retirer l'indicatif +253 si présent

    // Numéros djiboutiens : 8 chiffres, préfixes mobiles connus
    const djiboutiMobileRegex = /^(77|70|71)\d{6}$/;
    // Numéros fixes djiboutiens : commencent par 21 ou 25
    const djiboutiFixedRegex = /^(21|25)\d{6}$/;

    if (
      !djiboutiMobileRegex.test(cleanPhone) &&
      !djiboutiFixedRegex.test(cleanPhone)
    ) {
      setError(
        'Veuillez fournir un numéro djiboutien valide (ex: 77 83 12 34)',
      );
      return false;
    }

    setError('');
    return true;
  }, [formData]);

  // Par :
  const validateStep2 = useCallback(() => {
    if (formData.paymentMethods.length === 0) {
      setError('Veuillez sélectionner au moins une méthode de paiement');
      return false;
    }

    setError('');
    return true;
  }, [formData.paymentMethods]);

  const submitOrder = useCallback(async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('name', formData.name);
      formDataToSubmit.append('email', formData.email);
      formDataToSubmit.append('phone', formData.phone);
      formData.paymentMethods.forEach((id) =>
        formDataToSubmit.append('paymentMethods', id),
      );
      formDataToSubmit.append('hasCashPayment', String(hasCashPayment));

      const result = await createOrder(
        formDataToSubmit,
        applicationId,
        applicationFee,
      );

      if (!result.success) {
        throw new Error(
          result.message || 'Erreur lors de la création de la commande',
        );
      }

      // Tracker la commande réussie
      try {
        trackPurchase(
          {
            application_id: applicationId,
            application_fee: applicationFee,
            application_name: applicationName || `Application ${applicationId}`,
            application_category: applicationCategory || 'unknown',
          },
          result.orderId || Date.now().toString(),
          formData.paymentMethods.join(','),
        );
      } catch (error) {
        console.warn('[Analytics] Error tracking purchase:', error);
      }

      // Aller à la confirmation
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formData,
    hasCashPayment,
    applicationId,
    applicationFee,
    applicationName,
    applicationCategory,
    onClose,
  ]);

  const handleNext = useCallback(() => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3) submitOrder();
  }, [step, validateStep1, validateStep2, submitOrder]);

  const handleBack = useCallback(() => {
    setStep((prev) => prev - 1);
    setError('');
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="modalOverlay"
      onClick={closeModal} // ← clic overlay ferme la modale
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()} // ← empêche la propagation vers l'overlay
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-step-title"
        tabIndex={-1} // ← permet de recevoir le focus programmatiquement sans être dans l'ordre Tab naturel
      >
        <div className="modal-content">
          {error && <div className="errorMessage">{error}</div>}

          {/* ÉTAPE 1 : Informations personnelles */}
          {step === 1 && (
            <div className="step">
              <h2 id="modal-step-title">Étape 1: Informations personnelles</h2>

              <input
                type="text"
                name="name"
                placeholder="Nom complet"
                value={formData.name}
                onChange={handleInputChange}
                required
                autoComplete="name"
              />

              <input
                type="email"
                name="email"
                placeholder="Adresse email"
                value={formData.email}
                onChange={handleInputChange}
                required
                autoComplete="email"
              />
              <input
                type="tel"
                name="phone"
                placeholder="Numéro de téléphone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                autoComplete="tel"
              />
              <div className="buttonContainer">
                <button
                  onClick={() => closeModal('user_cancel_step1')}
                  className="cancelButton"
                >
                  Annuler
                </button>
                <button onClick={handleNext} className="nextButton">
                  Suivant
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 : Méthode de paiement */}
          {step === 2 && (
            <div className="step">
              <h2 id="modal-step-title">Étape 2: Méthode de paiement</h2>
              <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                Vous pouvez sélectionner une ou plusieurs méthodes.
              </p>
              <div className="checkboxGroup">
                {platforms?.map((platform) => (
                  <label key={platform?.platform_id} className="radioLabel">
                    <input
                      type="checkbox"
                      name="paymentMethods"
                      value={platform?.platform_id}
                      onChange={handleInputChange}
                      checked={formData.paymentMethods.includes(
                        platform?.platform_id,
                      )}
                    />
                    <span className="platform-name">
                      {platform?.is_cash_payment ? (
                        <strong>💵 {platform?.platform_name} (Espèces)</strong>
                      ) : (
                        platform?.platform_name
                      )}
                    </span>
                    {platform?.description && (
                      <span className="platform-description">
                        {platform?.description}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {hasCashPayment && (
                <div className="cash-info">
                  <p className="cash-message">
                    💵 Paiement en espèces inclus dans votre sélection.
                  </p>
                </div>
              )}

              <div className="buttonContainer">
                <button onClick={handleBack} className="backButton">
                  Retour
                </button>
                <button onClick={handleNext} className="nextButton">
                  Suivant
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : Récapitulatif */}
          {step === 3 && (
            <div className="step">
              <h2 id="modal-step-title">Étape 3: Récapitulatif</h2>

              <div className="summary-section">
                <h3 className="summary-title">Informations personnelles</h3>

                <div className="summary-item">
                  <span className="summary-label">Nom complet :</span>
                  <span className="summary-value">{formData.name}</span>
                </div>

                <div className="summary-item">
                  <span className="summary-label">Email :</span>
                  <span className="summary-value">{formData.email}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Téléphone :</span>
                  <span className="summary-value">{formData.phone}</span>
                </div>
              </div>

              <div className="summary-section">
                <h3 className="summary-title">Méthodes de paiement</h3>
                {selectedPlatforms.map((platform) => (
                  <div key={platform.platform_id} className="summary-item">
                    <span className="summary-label">
                      {platform.is_cash_payment ? '💵' : '📱'}
                    </span>
                    <span className="summary-value platform-name-highlight">
                      {platform.is_cash_payment
                        ? `${platform.platform_name} (Espèces)`
                        : platform.platform_name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="summary-section summary-total">
                <div className="summary-item">
                  <span className="summary-label">Montant total :</span>
                  <span className="summary-value total-amount">
                    {formatPrice(applicationFee)}
                  </span>
                </div>
              </div>

              <div className="buttonContainer">
                <button onClick={handleBack} className="backButton">
                  Retour
                </button>
                <button
                  onClick={handleNext}
                  className="nextButton"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Traitement...' : 'Confirmer la commande'}
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 4 : Confirmation avec plateformes de paiement */}
          {step === 4 && (
            <div className="step confirmationStep">
              <h2 id="modal-step-title">Étape 4: Confirmation</h2>

              <div className="confirmation-icon">✅</div>

              <div className="confirmation-main-message">
                <p>
                  Merci pour votre commande. Nous avons bien reçu vos
                  informations et nous vous contacterons dans les plus brefs
                  délais pour finaliser votre commande.
                </p>
                <p>
                  Un email de confirmation vous sera envoyé à l&apos;adresse
                  fournie.
                </p>
              </div>

              {/* ✅ SECTION PLATEFORMES DE PAIEMENT ÉLECTRONIQUE */}
              {electronicPlatforms.length > 0 && (
                <div className="payment-platforms-section">
                  <h3 className="platforms-title">
                    📱 Nos moyens de paiement électronique
                  </h3>
                  <p className="platforms-subtitle">
                    Vous pouvez effectuer votre paiement via l&apos;un de ces
                    comptes :
                  </p>

                  <div className="platforms-list">
                    {electronicPlatforms.map((platform) => (
                      <div key={platform.platform_id} className="platform-card">
                        <div className="platform-card-header">
                          <span className="platform-card-name">
                            {platform.platform_name}
                          </span>
                        </div>
                        <div className="platform-card-details">
                          <div className="platform-detail-item">
                            <span className="detail-label">
                              Nom du compte :
                            </span>
                            <span className="detail-value">
                              {platform.account_name}
                            </span>
                          </div>
                          <div className="platform-detail-item">
                            <span className="detail-label">Numéro :</span>
                            <span className="detail-value account-number">
                              {platform.account_number}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="payment-notice">
                    <p>
                      💡 <strong>Important :</strong> Après avoir effectué le
                      paiement, veuillez nous contacter pour confirmer votre
                      transaction.
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => closeModal('purchase_complete')}
                className="closeButton"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderModal;

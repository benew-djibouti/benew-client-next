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
  const [orderNumber, setOrderNumber] = useState(null);

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

  // Lire les cookies Meta au montage — améliorent l'EMQ côté CAPI
  const [metaCookies, setMetaCookies] = useState({ fbp: null, fbc: null });

  useEffect(() => {
    const getCookie = (name) => {
      const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`));
      return match ? match.split('=')[1] : null;
    };
    setMetaCookies({
      fbp: getCookie('_fbp'),
      fbc: getCookie('_fbc'),
    });
  }, []);

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
        {
          applicationName: applicationName || null,
          fbp: metaCookies.fbp,
          fbc: metaCookies.fbc,
        },
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
          result.metaEventId || result.orderId || Date.now().toString(), // ← metaEventId pour déduplication
          formData.paymentMethods.join(','),
        );
      } catch (error) {
        console.warn('[Analytics] Error tracking purchase:', error);
      }

      // Aller à la confirmation
      setOrderNumber(result.orderNumber || null);
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
      className="order-overlay"
      onClick={closeModal} // ← clic overlay ferme la modale
    >
      <div
        className="order-modal"
        onClick={(e) => e.stopPropagation()} // ← empêche la propagation vers l'overlay
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-step-title"
        tabIndex={-1} // ← permet de recevoir le focus programmatiquement sans être dans l'ordre Tab naturel
      >
        <div className="order-modal-content">
          {error && <div className="order-error-message">{error}</div>}

          {/* ÉTAPE 1 : Informations personnelles */}
          {step === 1 && (
            <div className="order-step">
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
              <div className="order-button-container">
                <button
                  onClick={() => closeModal('user_cancel_step1')}
                  className="order-cancel-btn"
                >
                  Annuler
                </button>
                <button onClick={handleNext} className="order-next-btn">
                  Suivant
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 : Méthode de paiement */}
          {step === 2 && (
            <div className="order-step">
              <h2 id="modal-step-title">Étape 2: Méthode de paiement</h2>
              <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                Vous pouvez sélectionner une ou plusieurs méthodes.
              </p>
              <div className="order-checkbox-group">
                {platforms?.map((platform) => (
                  <label
                    key={platform?.platform_id}
                    className="order-radio-label"
                  >
                    <input
                      type="checkbox"
                      name="paymentMethods"
                      value={platform?.platform_id}
                      onChange={handleInputChange}
                      checked={formData.paymentMethods.includes(
                        platform?.platform_id,
                      )}
                    />
                    <span className="order-platform-name">
                      {platform?.is_cash_payment ? (
                        <strong>💵 {platform?.platform_name} (Espèces)</strong>
                      ) : (
                        platform?.platform_name
                      )}
                    </span>
                    {platform?.description && (
                      <span className="order-platform-description">
                        {platform?.description}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {hasCashPayment && (
                <div className="order-cash-info">
                  <p className="order-cash-message">
                    💵 Paiement en espèces inclus dans votre sélection.
                  </p>
                </div>
              )}

              <div className="order-button-container">
                <button onClick={handleBack} className="order-back-btn">
                  Retour
                </button>
                <button onClick={handleNext} className="order-next-btn">
                  Suivant
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : Récapitulatif */}
          {step === 3 && (
            <div className="order-step">
              <h2 id="modal-step-title">Étape 3: Récapitulatif</h2>

              <div className="order-summary-section">
                <h3 className="order-summary-title">
                  Informations personnelles
                </h3>

                <div className="order-summary-item">
                  <span className="order-summary-label">Nom complet :</span>
                  <span className="order-summary-value">{formData.name}</span>
                </div>

                <div className="order-summary-item">
                  <span className="order-summary-label">Email :</span>
                  <span className="order-summary-value">{formData.email}</span>
                </div>
                <div className="order-summary-item">
                  <span className="order-summary-label">Téléphone :</span>
                  <span className="order-summary-value">{formData.phone}</span>
                </div>
              </div>

              <div className="order-summary-section">
                <h3 className="order-summary-title">Méthodes de paiement</h3>
                {selectedPlatforms.map((platform) => (
                  <div
                    key={platform.platform_id}
                    className="order-summary-item"
                  >
                    <span className="order-summary-label">
                      {platform.is_cash_payment ? '💵' : '📱'}
                    </span>
                    <span className="order-summary-value order-platform-name-highlight">
                      {platform.is_cash_payment
                        ? `${platform.platform_name} (Espèces)`
                        : platform.platform_name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="order-summary-section order-summary-total">
                <div className="order-summary-item">
                  <span className="order-summary-label">Montant total :</span>
                  <span className="order-summary-value order-total-amount">
                    {formatPrice(applicationFee)}
                  </span>
                </div>
              </div>

              <div className="order-button-container">
                <button onClick={handleBack} className="order-back-btn">
                  Retour
                </button>
                <button
                  onClick={handleNext}
                  className="order-next-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Traitement...' : 'Confirmer la commande'}
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 4 : Confirmation avec plateformes de paiement */}
          {step === 4 && (
            <div className="order-step order-confirmation-step">
              <h2 id="modal-step-title">Étape 4: Confirmation</h2>

              <div className="order-confirmation-icon">✅</div>

              {/* Numéro de commande */}
              {orderNumber && (
                <div className="order-confirmation-number">
                  <p className="order-confirmation-number-label">
                    Votre numéro de commande :
                  </p>
                  <p className="order-confirmation-number-value">
                    #{orderNumber}
                  </p>
                  <p className="order-confirmation-number-instructions">
                    📩 Veuillez enregistrer ce numéro et l&apos;envoyer avec
                    votre reçu de paiement par message.
                  </p>
                </div>
              )}

              <div className="order-confirmation-main-message">
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
                <div className="order-payment-platforms-section">
                  <h3 className="order-platforms-title">
                    📱 Nos moyens de paiement électronique
                  </h3>
                  <p className="order-platforms-subtitle">
                    Vous pouvez effectuer votre paiement via l&apos;un de ces
                    comptes :
                  </p>

                  <div className="order-platforms-list">
                    {electronicPlatforms.map((platform) => (
                      <div
                        key={platform.platform_id}
                        className="order-platform-card"
                      >
                        <div className="order-platform-card-header">
                          <span className="order-platform-card-name">
                            {platform.platform_name}
                          </span>
                        </div>
                        <div className="order-platform-card-details">
                          <div className="order-platform-detail-item">
                            <span className="order-detail-label">
                              Nom du compte :
                            </span>
                            <span className="order-detail-value">
                              {platform.account_name}
                            </span>
                          </div>
                          <div className="order-platform-detail-item">
                            <span className="order-detail-label">Numéro :</span>
                            <span className="order-detail-value order-account-number">
                              {platform.account_number}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="order-payment-notice">
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
                className="order-close-btn"
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

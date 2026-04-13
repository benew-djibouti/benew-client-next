// utils/schemas/schema.js
// Schémas de validation optimisés pour 500 utilisateurs/jour
// Production-ready avec support CASH

import * as yup from 'yup';

// =============================
// SCHEMA COMMANDE OPTIMISÉ
// =============================

export const orderServerSchema = yup.object().shape({
  // ✅ UN SEUL CHAMP NAME (au lieu de lastName + firstName)
  name: yup
    .string()
    .required('Le nom complet est requis')
    .min(3, 'Le nom doit contenir au moins 3 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .trim()
    .matches(
      /^[a-zA-ZÀ-ÿ\s'-]+$/,
      'Le nom ne peut contenir que des lettres, espaces, apostrophes et tirets',
    ),

  email: yup
    .string()
    .required("L'adresse email est requise")
    .email("Format d'email invalide")
    .max(100, "L'email ne peut pas dépasser 100 caractères")
    .lowercase()
    .trim(),

  phone: yup
    .string()
    .required('Le numéro de téléphone est requis')
    .min(8, 'Le numéro doit contenir au moins 8 chiffres')
    .max(20, 'Le numéro ne peut pas dépasser 20 caractères')
    .matches(/^\+?[\d\s-()]+$/, 'Format de téléphone invalide')
    .trim(),

  // Informations de paiement
  paymentMethods: yup
    .array()
    .of(yup.string().uuid('ID de plateforme invalide'))
    .min(1, 'Veuillez sélectionner au moins une méthode de paiement')
    .required('La méthode de paiement est requise'),

  // IDs et montant
  applicationId: yup
    .string()
    .required("L'ID de l'application est requis")
    .uuid("Format d'ID invalide")
    .trim(),

  applicationFee: yup
    .number()
    .required("Le montant de l'application est requis")
    .positive('Le montant doit être positif')
    .min(1, 'Le montant minimum est de 1')
    .max(100000, 'Le montant maximum est de 100,000')
    .test('is-decimal', 'Maximum 2 décimales', (value) => {
      if (!value) return true;
      return /^\d+(\.\d{1,2})?$/.test(value.toString());
    }),

  // ✅ NOUVEAU: Flag pour identifier le mode CASH
  hasCashPayment: yup.boolean().default(false),
});

// =============================
// FONCTIONS UTILITAIRES
// =============================

/**
 * Valide les données du server action
 * @param {Object} data - Données à valider
 * @returns {Promise<{success: boolean, data?: Object, errors?: Object}>}
 */
export async function validateOrderServer(data) {
  try {
    const validatedData = await orderServerSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    const errors = {};

    if (error.inner) {
      error.inner.forEach((err) => {
        if (err.path) {
          errors[err.path] = err.message;
        }
      });
    }

    return {
      success: false,
      errors,
    };
  }
}

/**
 * Prépare les données du FormData
 * @param {FormData} formData - Données du formulaire
 * @param {string} applicationId - ID de l'application
 * @param {number} applicationFee - Montant de l'application
 * @param {boolean} isCashPayment - Mode CASH ou non
 * @returns {Object} - Données préparées
 */
// Par :
export function prepareOrderDataFromFormData(
  formData,
  applicationId,
  applicationFee,
) {
  // paymentMethods est envoyé comme plusieurs entrées du même nom
  const paymentMethods = formData.getAll('paymentMethods');
  const hasCashPayment = formData.get('hasCashPayment') === 'true';

  return {
    name: formData.get('name') || '',
    email: formData.get('email') || '',
    phone: formData.get('phone') || '',
    paymentMethods,
    hasCashPayment,
    applicationId: applicationId || '',
    applicationFee: Number(applicationFee) || 0,
  };
}

/**
 * Formate les erreurs de validation pour affichage
 * @param {Object} errors - Objet d'erreurs
 * @returns {string} - Message formaté
 */
export function formatValidationErrors(errors) {
  if (!errors || Object.keys(errors).length === 0) {
    return 'Erreurs de validation';
  }

  // Limite à 3 erreurs max pour ne pas surcharger l'utilisateur
  const errorMessages = Object.values(errors).slice(0, 3);
  return errorMessages.join('. ');
}

/**
 * Valide basiquement un UUID v4
 * @param {string} uuid - UUID à valider
 * @returns {boolean}
 */
export function isValidUUID(uuid) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Valide un montant monétaire
 * @param {number} amount - Montant à valider
 * @returns {boolean}
 */
export function isValidAmount(amount) {
  return (
    typeof amount === 'number' &&
    amount > 0 &&
    amount <= 100000 &&
    /^\d+(\.\d{1,2})?$/.test(amount.toString())
  );
}

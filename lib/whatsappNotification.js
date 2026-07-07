// lib/whatsappNotification.js

/**
 * Génère le lien wa.me pour le client
 * Utilisé côté client dans OrderModal
 */
export function generateWhatsAppLink({
  orderNumber,
  clientName,
  applicationName,
  applicationFee,
  paymentMethods,
}) {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER;

  const message = [
    `Bonjour Benew 👋`,
    ``,
    `Je viens de passer une commande :`,
    ``,
    `📋 Numéro de commande: #${orderNumber}`,
    `👤 Nom: ${clientName}`,
    `🛍️ Application: ${applicationName}`,
    `💰 Montant: ${applicationFee.toLocaleString('fr-DJ')} DJF`,
    `💳 Paiement: ${paymentMethods.join(', ')}`,
    ``,
    `Je joins mon reçu de paiement à ce message.`,
  ].join('\n');

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

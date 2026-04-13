/**
 * CLOUDINARY CUSTOM LOADER OPTIMISÉ
 * Optimisation automatique des images pour Next.js 15
 * Gère à la fois les images Cloudinary ET les images locales
 *
 * Fonctionnalités :
 * - Format automatique (AVIF/WebP selon le navigateur)
 * - Qualité adaptative
 * - Compression intelligente
 * - Support images locales + Cloudinary
 *
 * Économie attendue : ~30-40% de bande passante
 */

export default function cloudinaryLoader({ src, width, quality }) {
  // ===== CAS 1 : URL complète externe (déjà optimisée) =====
  // Ex: https://example.com/image.jpg
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  // ===== CAS 2 : Pas de cloud name configuré =====
  // Fallback sur l'optimisation Next.js par défaut
  if (!cloudName) {
    console.warn(
      '⚠️ NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME non défini, utilisation Next.js',
    );
    return src;
  }

  // ===== CAS 3 : Images locales dans /public =====
  // Ex: /images/photo.png, /planets.png, etc.
  if (src.startsWith('/')) {
    // 🔑 LAISSER NEXT.JS OPTIMISER LES IMAGES LOCALES
    // Next.js appliquera automatiquement WebP/AVIF, compression, etc.
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cloudinary Loader] Image locale détectée: ${src}`);
      console.log("→ Next.js prendra en charge l'optimisation");
    }
    return src;
  }

  // ===== CAS 4 : Images Cloudinary (chemin relatif sans /) =====
  // Ex: "benew/products/image1" ou "blog/article-photo"
  const params = [
    'f_auto', // Format automatique (AVIF/WebP/etc.)
    'c_limit', // Crop mode: limiter les dimensions sans déformer
    `w_${width}`, // Largeur responsive
    `q_${quality || 'auto'}`, // Qualité auto ou spécifique
    'dpr_auto', // Device Pixel Ratio automatique (Retina, etc.)
  ];

  // Construire l'URL Cloudinary optimisée
  return `https://res.cloudinary.com/${cloudName}/image/upload/${params.join(',')}/${src}`;
}

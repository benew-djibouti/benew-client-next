// app/manifest.js
export default function manifest() {
  return {
    name: 'Benew - Templates et Applications Web & Mobile',
    short_name: 'Benew',
    description: 'Solutions e-commerce professionnelles pour Djibouti.',
    start_url: '/',
    display: 'standalone',
    background_color: '#151c2c',
    theme_color: '#f6a037',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };
}

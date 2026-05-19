// app/fonts.js
import localFont from 'next/font/local';

// =============================
// JOSEFIN SANS - Titres et UI
// =============================
export const josefinSans = localFont({
  src: [
    {
      path: './fonts/JosefinSans-Light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: './fonts/JosefinSans-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/JosefinSans-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/JosefinSans-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-display',
  display: 'swap',
  adjustFontFallback: 'Arial',
  preload: true,
});

// =============================
// JOSEFIN SLAB - Contenu et corps de texte (LOCAL)
// =============================
export const josefinSlab = localFont({
  src: [
    {
      path: './fonts/JosefinSlab-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/JosefinSlab-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/JosefinSlab-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-content',
  display: 'swap',
  adjustFontFallback: 'Georgia',
  preload: true,
});

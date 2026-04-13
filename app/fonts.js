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
// ORBITRON - Titres et UI
// =============================
export const orbitron = localFont({
  src: [
    {
      path: './fonts/Orbitron-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/Orbitron-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/Orbitron-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/Orbitron-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/Orbitron-ExtraBold.ttf',
      weight: '800',
      style: 'normal',
    },
    {
      path: './fonts/Orbitron-Black.ttf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-display',
  display: 'swap',
  adjustFontFallback: 'Arial',
  preload: true,
});

// =============================
// INTER - Contenu et corps de texte (LOCAL)
// =============================
export const inter = localFont({
  src: [
    {
      path: './fonts/Inter_18pt-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/Inter_18pt-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/Inter_18pt-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/Inter_18pt-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-content',
  display: 'swap',
  adjustFontFallback: 'Arial',
  preload: true,
});

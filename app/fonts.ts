import localFont from 'next/font/local';

export const nunitoSans = localFont({
  src: '../node_modules/@fontsource-variable/nunito-sans/files/nunito-sans-latin-wght-normal.woff2',
  display: 'swap',
  weight: '200 1000',
  style: 'normal',
  variable: '--font-nunito',
  preload: true,
  adjustFontFallback: 'Arial',
});

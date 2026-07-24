import type {AppProps} from 'next/app';

import '@/app/globals.css';
import {nunitoSans} from '@/app/fonts';

export default function StaticApp({Component, pageProps}: AppProps) {
  // Referencing the font class here makes the Pages compiler emit the local
  // WOFF2 CSS. _document also applies it to body because the global typography
  // contract reads --font-nunito from body itself.
  return (
    <div className={nunitoSans.variable}>
      <Component {...pageProps} />
    </div>
  );
}

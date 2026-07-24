import {Head, Html, Main, NextScript, type DocumentProps} from 'next/document';

import {nunitoSans} from '@/app/fonts';

export default function StaticDocument(props: DocumentProps) {
  const locale = props.__NEXT_DATA__.props.pageProps.locale === 'es' ? 'es' : 'en';

  return (
    <Html lang={locale}>
      <Head />
      <body className={nunitoSans.variable}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

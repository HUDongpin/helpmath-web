import type {Metadata} from 'next';

import {LoginPage} from '@/components/content-pages';
import {getSiteContent} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'}>}): Promise<Metadata> {
  const {locale} = await params;
  return createPageMetadata(locale, getSiteContent(locale).pages.login.metadata, '/login');
}

export default async function LoginRoute({params}: {params: Promise<{locale: 'en' | 'es'}>}) {
  const {locale} = await params;
  return <main id="main-content"><LoginPage content={getSiteContent(locale).pages.login} /></main>;
}

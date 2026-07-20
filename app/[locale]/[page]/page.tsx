import type {Metadata} from 'next';
import {notFound} from 'next/navigation';

import {ContactPage} from '@/components/contact-page';
import {DemosPage} from '@/components/demos-pages';
import {
  AboutPage,
  ApproachPage,
  CurriculumPage,
  LegalPage,
  LoginPage,
  ResearchPage,
  ResourcesPage,
  SupportPage
} from '@/components/content-pages';
import {getSiteContent} from '@/content';
import {createPageMetadata} from '@/lib/metadata';

const supported = [
  'about',
  'approach',
  'curriculum',
  'research',
  'resources',
  'support',
  'login',
  'contact',
  'demos',
  'privacy',
  'terms'
] as const;
type SupportedPage = (typeof supported)[number];

function isSupported(value: string): value is SupportedPage {
  return supported.some((page) => page === value);
}

export async function generateMetadata({params}: {params: Promise<{locale: 'en' | 'es'; page: string}>}): Promise<Metadata> {
  const {locale, page} = await params;
  if (!isSupported(page)) return {};
  return createPageMetadata(locale, getSiteContent(locale).pages[page].metadata, `/${page}`);
}

export default async function ContentPage({params}: {params: Promise<{locale: 'en' | 'es'; page: string}>}) {
  const {locale, page} = await params;
  if (!isSupported(page)) notFound();
  const content = getSiteContent(locale).pages;
  let rendered: React.ReactNode;
  switch (page) {
    case 'about': rendered = <AboutPage content={content.about} />; break;
    case 'approach': rendered = <ApproachPage content={content.approach} />; break;
    case 'curriculum': rendered = <CurriculumPage content={content.curriculum} />; break;
    case 'research': rendered = <ResearchPage content={content.research} />; break;
    case 'resources': rendered = <ResourcesPage content={content.resources} />; break;
    case 'support': rendered = <SupportPage content={content.support} />; break;
    case 'login': rendered = <LoginPage content={content.login} />; break;
    case 'contact': rendered = <ContactPage content={content.contact} locale={locale} />; break;
    case 'demos': rendered = <DemosPage content={content.demos} />; break;
    case 'privacy': rendered = <LegalPage content={content.privacy} />; break;
    case 'terms': rendered = <LegalPage content={content.terms} />; break;
  }
  return <main id="main-content">{rendered}</main>;
}

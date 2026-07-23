import {Sparkles} from 'lucide-react';

import type {Locale, SharedContent} from '@/content/types';

import {Brand} from './brand';
import {LanguageSwitcher} from './language-switcher';
import {
  DesktopNavigation,
  FallbackNavigation,
  HeaderSupportLink,
  MobileNavigation,
} from './mobile-navigation';

export function SiteHeader({
  content,
  languageSwitcherPath,
  locale,
}: {
  content: SharedContent;
  languageSwitcherPath?: string;
  locale: Locale;
}) {
  const {navigation} = content;

  return (
    <>
      <aside aria-labelledby="site-status-label" className="status-strip">
        <div className="container status-strip__inner">
          <span aria-hidden="true" className="status-strip__icon">
            <Sparkles size={14} />
          </span>
          <span>
            <strong id="site-status-label">{content.statusLabel}</strong>{' '}
            {content.statusMessage}
          </span>
        </div>
      </aside>
      <header className="site-header">
        <div className="container site-header__inner">
          <Brand
            homeHref={locale === 'es' ? '/es' : '/'}
            homeLabel={navigation.homeLabel}
          />
          <DesktopNavigation navigation={navigation} />
          <div className="site-header__actions">
            <LanguageSwitcher
              label={navigation.languageLabel}
              locale={locale}
              names={navigation.languageNames}
              pathnameOverride={languageSwitcherPath}
            />
            <HeaderSupportLink navigation={navigation} />
          </div>
          <MobileNavigation
            languageSwitcherPath={languageSwitcherPath}
            locale={locale}
            navigation={navigation}
          />
        </div>
      </header>
      <noscript>
        <FallbackNavigation
          languageSwitcherPath={languageSwitcherPath}
          locale={locale}
          navigation={navigation}
        />
      </noscript>
    </>
  );
}

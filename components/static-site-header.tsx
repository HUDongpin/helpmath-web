import type {Locale, SharedContent} from '@/content/types';
import {languageSwitchGatewayHref, localizeHref, stripLocalePrefix} from '@/i18n/href';

import {Brand} from './brand';
import {Languages, Menu, Sparkles, X} from './server-icons';

function normalizePathname(href: string): string {
  const pathname = stripLocalePrefix(href).split(/[?#]/, 1)[0] || '/';
  return pathname === '/' ? pathname : pathname.replace(/\/+$/u, '');
}

function isCurrentHref(pathname: string, href: string): boolean {
  const currentPathname = normalizePathname(pathname);
  const targetPathname = normalizePathname(href);

  return currentPathname === targetPathname ||
    (targetPathname !== '/' && currentPathname.startsWith(`${targetPathname}/`));
}

function NavigationLinks({
  includeSupport = false,
  navigation,
  pathname,
}: {
  includeSupport?: boolean;
  navigation: SharedContent['navigation'];
  pathname: string;
}) {
  return (
    <>
      {navigation.links.map((link) => (
        <a
          aria-current={isCurrentHref(pathname, link.href) ? 'page' : undefined}
          href={link.href}
          key={link.href}
        >
          {link.label}
        </a>
      ))}
      {includeSupport ? (
        <a
          aria-current={isCurrentHref(pathname, navigation.supportAction.href) ? 'page' : undefined}
          href={navigation.supportAction.href}
        >
          {navigation.supportAction.label}
        </a>
      ) : null}
    </>
  );
}

function LanguageLink({
  locale,
  navigation,
  pathname,
}: {
  locale: Locale;
  navigation: SharedContent['navigation'];
  pathname: string;
}) {
  const targetLocale: Locale = locale === 'en' ? 'es' : 'en';

  return (
    <a
      aria-label={`${navigation.languageLabel}: ${navigation.languageNames[targetLocale]}`}
      className="language-switcher"
      data-language-switcher=""
      data-language-switch-target={localizeHref(normalizePathname(pathname), targetLocale)}
      href={languageSwitchGatewayHref(pathname, targetLocale)}
    >
      <Languages aria-hidden="true" size={18} />
      <span>{navigation.languageNames[targetLocale]}</span>
    </a>
  );
}

function MobileNavigation({
  locale,
  navigation,
  pathname,
}: {
  locale: Locale;
  navigation: SharedContent['navigation'];
  pathname: string;
}) {
  return (
    <div className="mobile-nav" data-static-mobile-navigation="">
      <details className="mobile-nav__fallback">
        <summary className="mobile-nav__fallback-trigger">
          <span className="mobile-nav__fallback-state" data-fallback-open-state="">
            <Menu aria-hidden="true" size={24} />
            <span>{navigation.openMenuLabel}</span>
          </span>
          <span className="mobile-nav__fallback-state" data-fallback-close-state="">
            <X aria-hidden="true" size={24} />
            <span>{navigation.closeMenuLabel}</span>
          </span>
        </summary>
        <nav
          aria-label={navigation.ariaLabel}
          className="mobile-nav__panel mobile-nav__fallback-panel"
        >
          <NavigationLinks includeSupport navigation={navigation} pathname={pathname} />
          <LanguageLink locale={locale} navigation={navigation} pathname={pathname} />
        </nav>
      </details>
      <button
        aria-controls="mobile-navigation-panel"
        aria-expanded="false"
        aria-label={navigation.openMenuLabel}
        className="mobile-nav__trigger"
        type="button"
      >
        <span data-mobile-menu-open-icon="">
          <Menu aria-hidden="true" size={24} />
        </span>
        <span data-mobile-menu-close-icon="" hidden>
          <X aria-hidden="true" size={24} />
        </span>
        <span
          data-close-label={navigation.closeMenuLabel}
          data-mobile-menu-label=""
          data-open-label={navigation.openMenuLabel}
        >
          {navigation.openMenuLabel}
        </span>
      </button>
      <nav
        aria-label={navigation.ariaLabel}
        className="mobile-nav__panel"
        hidden
        id="mobile-navigation-panel"
      >
        <NavigationLinks includeSupport navigation={navigation} pathname={pathname} />
        <LanguageLink locale={locale} navigation={navigation} pathname={pathname} />
      </nav>
    </div>
  );
}

export function StaticSiteHeader({
  content,
  locale,
  pathname,
}: {
  content: SharedContent;
  locale: Locale;
  pathname: string;
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
          <nav aria-label={navigation.ariaLabel} className="desktop-nav">
            <NavigationLinks navigation={navigation} pathname={pathname} />
          </nav>
          <div className="site-header__actions">
            <LanguageLink locale={locale} navigation={navigation} pathname={pathname} />
            <a
              aria-current={isCurrentHref(pathname, navigation.supportAction.href) ? 'page' : undefined}
              className="header-support"
              href={navigation.supportAction.href}
            >
              {navigation.supportAction.label}
            </a>
          </div>
          <MobileNavigation locale={locale} navigation={navigation} pathname={pathname} />
        </div>
      </header>
    </>
  );
}

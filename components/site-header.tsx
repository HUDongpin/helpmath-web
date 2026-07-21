'use client';

import {Menu, Sparkles, X} from 'lucide-react';
import {useState, type SyntheticEvent} from 'react';

import type {Locale, SharedContent} from '@/content/types';
import {Link, stripLocalePrefix, usePathname} from '@/i18n/navigation';

import {LanguageSwitcher} from './language-switcher';

export function Brand({homeLabel}: {homeLabel: string}) {
  return (
    <Link className="brand" href="/" title={homeLabel}>
      <span aria-hidden="true" className="brand__mark">
        <span>+</span>
        <span>×</span>
      </span>
      <span className="brand__name">
        HELP <strong>Math</strong>
      </span>
    </Link>
  );
}

function normalizePathname(href: string): string {
  const pathname = stripLocalePrefix(href).split(/[?#]/, 1)[0] || '/';

  return pathname === '/' ? pathname : pathname.replace(/\/+$/, '');
}

function isCurrentHref(pathname: string, href: string): boolean {
  const currentPathname = normalizePathname(pathname);
  const targetPathname = normalizePathname(href);

  return (
    currentPathname === targetPathname ||
    (targetPathname !== '/' && currentPathname.startsWith(`${targetPathname}/`))
  );
}

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
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuLabel = isMobileMenuOpen ? navigation.closeMenuLabel : navigation.openMenuLabel;

  function handleMobileMenuToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    setIsMobileMenuOpen(event.currentTarget.open);
  }

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="status-strip">
        <div className="container status-strip__inner">
          <span aria-hidden="true" className="status-strip__icon">
            <Sparkles size={14} />
          </span>
          <span>
            <strong>{content.statusLabel}</strong> {content.statusMessage}
          </span>
        </div>
      </div>
      <div className="container site-header__inner">
        <Brand homeLabel={navigation.homeLabel} />
        <nav aria-label={navigation.ariaLabel} className="desktop-nav">
          {navigation.links.map((link) => (
            <Link
              aria-current={isCurrentHref(pathname, link.href) ? 'page' : undefined}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="site-header__actions">
          <LanguageSwitcher
            label={navigation.languageLabel}
            locale={locale}
            names={navigation.languageNames}
            pathnameOverride={languageSwitcherPath}
          />
          <Link
            aria-current={
              isCurrentHref(pathname, navigation.supportAction.href) ? 'page' : undefined
            }
            className="header-support"
            href={navigation.supportAction.href}
          >
            {navigation.supportAction.label}
          </Link>
        </div>
        <details
          className="mobile-nav"
          onToggle={handleMobileMenuToggle}
          open={isMobileMenuOpen}
        >
          <summary
            aria-controls="mobile-navigation-panel"
            aria-expanded={isMobileMenuOpen}
            aria-label={menuLabel}
          >
            {isMobileMenuOpen ? (
              <X aria-hidden="true" size={24} />
            ) : (
              <Menu aria-hidden="true" size={24} />
            )}
            <span>{menuLabel}</span>
          </summary>
          <div className="mobile-nav__panel" id="mobile-navigation-panel">
            {navigation.links.map((link) => (
              <Link
                aria-current={isCurrentHref(pathname, link.href) ? 'page' : undefined}
                href={link.href}
                key={link.href}
                onClick={closeMobileMenu}
              >
                {link.label}
              </Link>
            ))}
            <Link
              aria-current={
                isCurrentHref(pathname, navigation.supportAction.href) ? 'page' : undefined
              }
              href={navigation.supportAction.href}
              onClick={closeMobileMenu}
            >
              {navigation.supportAction.label}
            </Link>
            <LanguageSwitcher
              label={navigation.languageLabel}
              locale={locale}
              names={navigation.languageNames}
              onNavigate={closeMobileMenu}
              pathnameOverride={languageSwitcherPath}
            />
          </div>
        </details>
      </div>
    </header>
  );
}

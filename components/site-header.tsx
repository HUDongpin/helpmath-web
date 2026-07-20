import {Menu, Sparkles} from 'lucide-react';

import type {Locale, SharedContent} from '@/content/types';
import {Link} from '@/i18n/navigation';

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

export function SiteHeader({content, locale}: {content: SharedContent; locale: Locale}) {
  const {navigation} = content;

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
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="site-header__actions">
          <LanguageSwitcher
            label={navigation.languageLabel}
            locale={locale}
            names={navigation.languageNames}
          />
          <Link className="header-support" href={navigation.supportAction.href}>
            {navigation.supportAction.label}
          </Link>
        </div>
        <details className="mobile-nav">
          <summary aria-label={navigation.openMenuLabel}>
            <Menu aria-hidden="true" size={24} />
            <span>{navigation.openMenuLabel}</span>
          </summary>
          <div className="mobile-nav__panel">
            {navigation.links.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
            <Link href={navigation.supportAction.href}>{navigation.supportAction.label}</Link>
            <LanguageSwitcher
              label={navigation.languageLabel}
              locale={locale}
              names={navigation.languageNames}
            />
          </div>
        </details>
      </div>
    </header>
  );
}

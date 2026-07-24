import type {Locale, SharedContent} from '@/content/types';

import {Brand} from './brand';

export function SiteFooter({
  content,
  locale,
}: {
  content: SharedContent;
  locale: Locale;
}) {
  const {footer, navigation} = content;
  const year = new Date().getUTCFullYear();

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__about">
          <Brand
            homeHref={locale === 'es' ? '/es' : '/'}
            homeLabel={navigation.homeLabel}
          />
          <p>{footer.summary}</p>
          <p className="site-footer__language">{footer.languageNote}</p>
        </div>
        <div>
          <h2>{footer.exploreLabel}</h2>
          <ul>
            {footer.exploreLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>{footer.helpLabel}</h2>
          <ul>
            {footer.helpLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="container site-footer__base">
        <span>HELP Math · {year}</span>
        <span>{footer.legalNote}</span>
      </div>
    </footer>
  );
}

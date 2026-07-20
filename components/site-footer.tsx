import {Brand} from './site-header';
import type {SharedContent} from '@/content/types';
import {Link} from '@/i18n/navigation';

export function SiteFooter({content}: {content: SharedContent}) {
  const {footer, navigation} = content;
  const year = new Date().getUTCFullYear();

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__about">
          <Brand homeLabel={navigation.homeLabel} />
          <p>{footer.summary}</p>
          <p className="site-footer__language">{footer.languageNote}</p>
        </div>
        <div>
          <h2>{footer.exploreLabel}</h2>
          <ul>
            {footer.exploreLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>{footer.helpLabel}</h2>
          <ul>
            {footer.helpLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="container site-footer__base">
        <span>© {year} HELP Math.</span>
        <span>{footer.legalNote}</span>
      </div>
    </footer>
  );
}

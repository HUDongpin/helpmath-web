'use client';

import {Menu, Sparkles, X} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';

import type {Locale, SharedContent} from '@/content/types';
import {Link, stripLocalePrefix, usePathname} from '@/i18n/navigation';

import {LanguageSwitcher} from './language-switcher';

const keyboardFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function subscribeToClientReady(): () => void {
  return () => undefined;
}

function getClientReady(): boolean {
  return true;
}

function getServerNotReady(): boolean {
  return false;
}

export function Brand({homeLabel}: {homeLabel: string}) {
  return (
    <Link className="brand" href="/" prefetch={false} title={homeLabel}>
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
  const isMobileMenuReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientReady,
    getServerNotReady,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileMenuMaxHeight, setMobileMenuMaxHeight] = useState<number | null>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const mobileNavSummaryRef = useRef<HTMLButtonElement>(null);
  const menuLabel = isMobileMenuOpen ? navigation.closeMenuLabel : navigation.openMenuLabel;

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    function handleDocumentEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      setIsMobileMenuOpen(false);
      setMobileMenuMaxHeight(null);
      mobileNavSummaryRef.current?.focus();
    }

    document.addEventListener('keydown', handleDocumentEscape, {capture: true});
    return () => document.removeEventListener('keydown', handleDocumentEscape, {capture: true});
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const container = mobileNavRef.current;
    const panel = container?.querySelector<HTMLElement>('#mobile-navigation-panel');
    if (!container || !panel) return;

    function updateAvailableHeight() {
      const viewport = window.visualViewport;
      const viewportBottom = (viewport?.offsetTop ?? 0) +
        (viewport?.height ?? window.innerHeight);
      const panelTop = panel!.getBoundingClientRect().top;
      setMobileMenuMaxHeight(Math.max(48, Math.floor(viewportBottom - panelTop - 8)));
    }

    updateAvailableHeight();
    const animationFrame = window.requestAnimationFrame(updateAvailableHeight);
    const resizeObserver = new ResizeObserver(updateAvailableHeight);
    resizeObserver.observe(container.closest('.site-header') ?? container);
    window.addEventListener('resize', updateAvailableHeight);
    window.addEventListener('scroll', updateAvailableHeight, {passive: true});
    window.visualViewport?.addEventListener('resize', updateAvailableHeight);
    window.visualViewport?.addEventListener('scroll', updateAvailableHeight);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateAvailableHeight);
      window.removeEventListener('scroll', updateAvailableHeight);
      window.visualViewport?.removeEventListener('resize', updateAvailableHeight);
      window.visualViewport?.removeEventListener('scroll', updateAvailableHeight);
    };
  }, [isMobileMenuOpen]);

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
    setMobileMenuMaxHeight(null);
  }

  function closeMobileMenuAfterActivation() {
    window.requestAnimationFrame(closeMobileMenu);
  }

  function closeMobileMenuAndMoveFocus(
    container: HTMLDivElement,
    direction: 'backward' | 'forward',
  ) {
    const position = direction === 'forward'
      ? Node.DOCUMENT_POSITION_FOLLOWING
      : Node.DOCUMENT_POSITION_PRECEDING;
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(keyboardFocusableSelector),
    ).filter((element) => {
      if (container.contains(element) || element.matches(':disabled')) return false;

      const style = window.getComputedStyle(element);
      return element.getClientRects().length > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
    });
    const orderedCandidates = direction === 'forward' ? candidates : candidates.reverse();
    const nextTarget = orderedCandidates.find((element) =>
      Boolean(container.compareDocumentPosition(element) & position)) ??
      document.querySelector<HTMLElement>('.brand');

    closeMobileMenu();
    nextTarget?.focus();
  }

  function handleMobileMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      !isMobileMenuOpen &&
      event.key === 'Tab' &&
      event.target === mobileNavSummaryRef.current
    ) {
      event.preventDefault();
      closeMobileMenuAndMoveFocus(
        event.currentTarget,
        event.shiftKey ? 'backward' : 'forward',
      );
      return;
    }

    if (!isMobileMenuOpen) return;

    if (event.key === 'Tab') {
      const panel = event.currentTarget.querySelector<HTMLElement>('#mobile-navigation-panel');
      const panelControls = Array.from(
        panel?.querySelectorAll<HTMLElement>(keyboardFocusableSelector) ?? [],
      );
      const boundaryControl = event.shiftKey
        ? mobileNavSummaryRef.current
        : panelControls.at(-1) ?? mobileNavSummaryRef.current;

      if (event.target === boundaryControl) {
        event.preventDefault();
        closeMobileMenuAndMoveFocus(
          event.currentTarget,
          event.shiftKey ? 'backward' : 'forward',
        );
      }
      return;
    }
  }

  function handleMobileMenuBlur(event: FocusEvent<HTMLDivElement>) {
    if (!isMobileMenuOpen) return;

    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    const container = event.currentTarget;
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof Node && container.contains(activeElement))) {
        closeMobileMenu();
      }
    });
  }

  return (
    <>
      <div
        className={`status-strip${isMobileMenuOpen ? ' status-strip--menu-open' : ''}`}
      >
        <div className="container status-strip__inner">
          <span aria-hidden="true" className="status-strip__icon">
            <Sparkles size={14} />
          </span>
          <span>
            <strong>{content.statusLabel}</strong> {content.statusMessage}
          </span>
        </div>
      </div>
      <header className="site-header">
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
          <div
            className="mobile-nav"
            onBlur={handleMobileMenuBlur}
            onKeyDownCapture={handleMobileMenuKeyDown}
            ref={mobileNavRef}
          >
            <button
              aria-controls="mobile-navigation-panel"
              aria-expanded={isMobileMenuOpen}
              aria-label={menuLabel}
              className="mobile-nav__trigger"
              disabled={!isMobileMenuReady}
              onClick={() => {
                if (isMobileMenuOpen) closeMobileMenu();
                else setIsMobileMenuOpen(true);
              }}
              ref={mobileNavSummaryRef}
              type="button"
            >
              {isMobileMenuOpen ? (
                <X aria-hidden="true" size={24} />
              ) : (
                <Menu aria-hidden="true" size={24} />
              )}
              <span>{menuLabel}</span>
            </button>
            {isMobileMenuOpen ? (
              <nav
                aria-label={navigation.ariaLabel}
                className="mobile-nav__panel"
                id="mobile-navigation-panel"
                style={mobileMenuMaxHeight === null
                  ? undefined
                  : {maxHeight: `${mobileMenuMaxHeight}px`}}
              >
                {navigation.links.map((link) => (
                  <Link
                    aria-current={isCurrentHref(pathname, link.href) ? 'page' : undefined}
                    href={link.href}
                    key={link.href}
                    onClick={closeMobileMenuAfterActivation}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  aria-current={
                    isCurrentHref(pathname, navigation.supportAction.href) ? 'page' : undefined
                  }
                  href={navigation.supportAction.href}
                  onClick={closeMobileMenuAfterActivation}
                >
                  {navigation.supportAction.label}
                </Link>
                <LanguageSwitcher
                  label={navigation.languageLabel}
                  locale={locale}
                  names={navigation.languageNames}
                  onNavigate={closeMobileMenuAfterActivation}
                  pathnameOverride={languageSwitcherPath}
                />
              </nav>
            ) : null}
          </div>
        </div>
      </header>
    </>
  );
}

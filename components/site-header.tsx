'use client';

import {Menu, Sparkles, X} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';

import type {Locale, SharedContent} from '@/content/types';
import {Link, stripLocalePrefix, usePathname} from '@/i18n/navigation';

import {LanguageSwitcher} from './language-switcher';

const keyboardFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'summary',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileMenuMaxHeight, setMobileMenuMaxHeight] = useState<number | null>(null);
  const mobileNavRef = useRef<HTMLDetailsElement>(null);
  const mobileNavSummaryRef = useRef<HTMLElement>(null);
  const pendingMobileNavFocusRef = useRef<HTMLElement | null>(null);
  const menuLabel = isMobileMenuOpen ? navigation.closeMenuLabel : navigation.openMenuLabel;

  useEffect(() => {
    function handleDocumentEscape(event: globalThis.KeyboardEvent) {
      const details = mobileNavRef.current;
      if (event.key !== 'Escape' || !details?.open) return;

      event.preventDefault();
      details.open = false;
      setIsMobileMenuOpen(false);
      setMobileMenuMaxHeight(null);
      window.requestAnimationFrame(() => mobileNavSummaryRef.current?.focus());
    }

    document.addEventListener('keydown', handleDocumentEscape, {capture: true});
    return () => document.removeEventListener('keydown', handleDocumentEscape, {capture: true});
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const details = mobileNavRef.current;
    const panel = details?.querySelector<HTMLElement>('#mobile-navigation-panel');
    if (!details || !panel) return;

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
    resizeObserver.observe(details.closest('.site-header') ?? details);
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

  function handleMobileMenuToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    const isOpen = event.currentTarget.open;
    const pendingFocusTarget = pendingMobileNavFocusRef.current;
    pendingMobileNavFocusRef.current = null;
    setIsMobileMenuOpen(isOpen);
    if (!isOpen) {
      setMobileMenuMaxHeight(null);
      const activeElement = document.activeElement;
      if (
        pendingFocusTarget?.isConnected &&
        (activeElement === document.body ||
          (activeElement instanceof Node && event.currentTarget.contains(activeElement)))
      ) {
        pendingFocusTarget.focus();
      }
    }
  }

  function closeMobileMenu() {
    if (mobileNavRef.current) mobileNavRef.current.open = false;
    setIsMobileMenuOpen(false);
    setMobileMenuMaxHeight(null);
  }

  function closeMobileMenuAfterActivation() {
    window.requestAnimationFrame(closeMobileMenu);
  }

  function closeMobileMenuAndMoveFocus(
    details: HTMLDetailsElement,
    direction: 'backward' | 'forward',
  ) {
    const position = direction === 'forward'
      ? Node.DOCUMENT_POSITION_FOLLOWING
      : Node.DOCUMENT_POSITION_PRECEDING;
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(keyboardFocusableSelector),
    ).filter((element) => {
      if (details.contains(element) || element.matches(':disabled')) return false;

      const style = window.getComputedStyle(element);
      return element.getClientRects().length > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
    });
    const orderedCandidates = direction === 'forward' ? candidates : candidates.reverse();
    const nextTarget = orderedCandidates.find((element) =>
      Boolean(details.compareDocumentPosition(element) & position)) ??
      document.querySelector<HTMLElement>('.brand');

    pendingMobileNavFocusRef.current = nextTarget;
    closeMobileMenu();
    nextTarget?.focus();
  }

  function handleMobileMenuKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open) return;

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

  function handleMobileMenuBlur(event: FocusEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open) return;

    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    const details = event.currentTarget;
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (details.open && !(activeElement instanceof Node && details.contains(activeElement))) {
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
          <details
            className="mobile-nav"
            onBlur={handleMobileMenuBlur}
            onKeyDownCapture={handleMobileMenuKeyDown}
            onToggle={handleMobileMenuToggle}
            ref={mobileNavRef}
          >
            <summary
              aria-controls="mobile-navigation-panel"
              aria-expanded={isMobileMenuOpen}
              aria-label={menuLabel}
              ref={mobileNavSummaryRef}
            >
              {isMobileMenuOpen ? (
                <X aria-hidden="true" size={24} />
              ) : (
                <Menu aria-hidden="true" size={24} />
              )}
              <span>{menuLabel}</span>
            </summary>
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
          </details>
        </div>
      </header>
    </>
  );
}

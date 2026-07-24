'use client';

import {usePathname as useNextPathname} from 'next/navigation';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';

import type {Locale, SharedContent} from '@/content/types';
import {languageSwitchGatewayHref, stripLocalePrefix} from '@/i18n/href';

import {LanguageSwitcher} from './language-switcher';
import {Languages, Menu, X} from './server-icons';

const keyboardFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

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

function CurrentNavigationLinks({
  includeSupport = false,
  navigation,
  onNavigate,
  pathname,
}: {
  includeSupport?: boolean;
  navigation: SharedContent['navigation'];
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <>
      {navigation.links.map((link) => (
        <a
          aria-current={isCurrentHref(pathname, link.href) ? 'page' : undefined}
          href={link.href}
          key={link.href}
          onClick={onNavigate}
        >
          {link.label}
        </a>
      ))}
      {includeSupport ? (
        <a
          aria-current={
            isCurrentHref(pathname, navigation.supportAction.href) ? 'page' : undefined
          }
          href={navigation.supportAction.href}
          onClick={onNavigate}
        >
          {navigation.supportAction.label}
        </a>
      ) : null}
    </>
  );
}

export function DesktopNavigation({
  navigation,
}: {
  navigation: SharedContent['navigation'];
}) {
  const pathname = stripLocalePrefix(useNextPathname() ?? '/');

  return (
    <nav aria-label={navigation.ariaLabel} className="desktop-nav">
      <CurrentNavigationLinks navigation={navigation} pathname={pathname} />
    </nav>
  );
}

export function HeaderSupportLink({
  navigation,
}: {
  navigation: SharedContent['navigation'];
}) {
  const pathname = stripLocalePrefix(useNextPathname() ?? '/');

  return (
    <a
      aria-current={
        isCurrentHref(pathname, navigation.supportAction.href) ? 'page' : undefined
      }
      className="header-support"
      href={navigation.supportAction.href}
    >
      {navigation.supportAction.label}
    </a>
  );
}

export function FallbackNavigation({
  languageSwitcherPath,
  locale,
  navigation,
  pathname,
}: {
  languageSwitcherPath?: string;
  locale: Locale;
  navigation: SharedContent['navigation'];
  pathname: string;
}) {
  const targetLocale: Locale = locale === 'en' ? 'es' : 'en';
  const languageHref = languageSwitchGatewayHref(
    languageSwitcherPath ?? pathname,
    targetLocale,
  );

  return (
    <details className="mobile-nav__fallback" suppressHydrationWarning>
      <summary className="mobile-nav__fallback-trigger">
        <Menu aria-hidden="true" size={24} />
        <span>{navigation.openMenuLabel}</span>
      </summary>
      <nav
        aria-label={navigation.ariaLabel}
        className="mobile-nav__panel mobile-nav__fallback-panel"
      >
        <CurrentNavigationLinks
          includeSupport
          navigation={navigation}
          pathname={pathname}
        />
        <a
          aria-label={`${navigation.languageLabel}: ${navigation.languageNames[targetLocale]}`}
          className="language-switcher"
          href={languageHref}
        >
          <Languages aria-hidden="true" size={18} />
          <span>{navigation.languageNames[targetLocale]}</span>
        </a>
      </nav>
    </details>
  );
}

export function MobileNavigation({
  languageSwitcherPath,
  locale,
  navigation,
}: {
  languageSwitcherPath?: string;
  locale: Locale;
  navigation: SharedContent['navigation'];
}) {
  const pathname = stripLocalePrefix(useNextPathname() ?? '/');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileMenuMaxHeight, setMobileMenuMaxHeight] = useState<number | null>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const mobileNavSummaryRef = useRef<HTMLButtonElement>(null);
  const menuLabel = isMobileMenuOpen ? navigation.closeMenuLabel : navigation.openMenuLabel;

  useLayoutEffect(() => {
    const container = mobileNavRef.current;
    if (!container) return;

    let cancelled = false;
    container.dataset.ready = 'true';
    const initialHash = window.location.hash;
    if (
      initialHash &&
      window.matchMedia('(max-width: 1060px)').matches &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      !document.querySelector('.resource-library')
    ) {
      let targetId = '';
      try {
        targetId = decodeURIComponent(initialHash.slice(1));
      } catch {
        targetId = '';
      }
      const target = targetId ? document.getElementById(targetId) : null;
      if (target) {
        void document.fonts.ready.then(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (
                !cancelled &&
                window.location.hash === initialHash &&
                document.getElementById(targetId) === target &&
                !target.hidden
              ) {
                target.scrollIntoView({behavior: 'instant', block: 'start'});
              }
            });
          });
        });
      }
    }

    return () => {
      cancelled = true;
      delete container.dataset.ready;
    };
  }, []);

  useLayoutEffect(() => {
    const statusStrip = document.querySelector('.status-strip');
    statusStrip?.classList.toggle('status-strip--menu-open', isMobileMenuOpen);
    return () => statusStrip?.classList.remove('status-strip--menu-open');
  }, [isMobileMenuOpen]);

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
    <div
      className="mobile-nav"
      onBlur={handleMobileMenuBlur}
      onKeyDownCapture={handleMobileMenuKeyDown}
      ref={mobileNavRef}
    >
      <FallbackNavigation
        languageSwitcherPath={languageSwitcherPath}
        locale={locale}
        navigation={navigation}
        pathname={pathname}
      />
      <button
        aria-controls="mobile-navigation-panel"
        aria-expanded={isMobileMenuOpen}
        aria-label={menuLabel}
        className="mobile-nav__trigger"
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
          <CurrentNavigationLinks
            includeSupport
            navigation={navigation}
            onNavigate={closeMobileMenuAfterActivation}
            pathname={pathname}
          />
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
  );
}

(() => {
  'use strict';

  const locationChangeEvent = 'help-math:location-change';
  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  function updateLanguageLinks() {
    const suffix = `${window.location.search}${window.location.hash}`;
    document.querySelectorAll('[data-language-switcher]').forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      const target = link.dataset.languageSwitchTarget;
      if (!target?.startsWith('/') || target.startsWith('//')) return;
      link.href = `${target}${suffix}`;
    });
  }

  function visibleFocusableElements() {
    return Array.from(document.querySelectorAll(focusableSelector)).filter((element) => {
      if (!(element instanceof HTMLElement) || element.matches(':disabled')) return false;
      const style = window.getComputedStyle(element);
      return element.getClientRects().length > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
    });
  }

  function mountMobileNavigation(container) {
    if (container.dataset.mounted === 'true') return;
    const fallback = container.querySelector(':scope > .mobile-nav__fallback');
    const trigger = container.querySelector(':scope > .mobile-nav__trigger');
    const panel = container.querySelector(':scope > .mobile-nav__panel');
    const label = trigger?.querySelector('[data-mobile-menu-label]');
    const openIcon = trigger?.querySelector('[data-mobile-menu-open-icon]');
    const closeIcon = trigger?.querySelector('[data-mobile-menu-close-icon]');
    const statusStrip = document.querySelector('.status-strip');
    if (
      !(fallback instanceof HTMLDetailsElement) ||
      !(trigger instanceof HTMLButtonElement) ||
      !(panel instanceof HTMLElement) ||
      !(label instanceof HTMLElement)
    ) return;

    const openLabel = label.dataset.openLabel || label.textContent || '';
    const closeLabel = label.dataset.closeLabel || openLabel;
    const mobileBreakpoint = window.matchMedia('(max-width: 1060px)');
    let isOpen = false;

    function updateAvailableHeight() {
      if (!isOpen) return;
      const viewport = window.visualViewport;
      const viewportBottom = (viewport?.offsetTop ?? 0) +
        (viewport?.height ?? window.innerHeight);
      const panelTop = panel.getBoundingClientRect().top;
      panel.style.maxHeight = `${Math.max(48, Math.floor(viewportBottom - panelTop - 8))}px`;
    }

    function setOpen(nextOpen) {
      isOpen = nextOpen;
      trigger.setAttribute('aria-expanded', String(nextOpen));
      trigger.setAttribute('aria-label', nextOpen ? closeLabel : openLabel);
      label.textContent = nextOpen ? closeLabel : openLabel;
      panel.hidden = !nextOpen;
      if (openIcon instanceof HTMLElement) openIcon.hidden = nextOpen;
      if (closeIcon instanceof HTMLElement) closeIcon.hidden = !nextOpen;
      statusStrip?.classList.toggle('status-strip--menu-open', nextOpen);
      if (nextOpen) {
        updateAvailableHeight();
        window.requestAnimationFrame(updateAvailableHeight);
      } else {
        panel.style.removeProperty('max-height');
      }
    }

    function moveFocusOutside(direction) {
      const position = direction === 'forward'
        ? Node.DOCUMENT_POSITION_FOLLOWING
        : Node.DOCUMENT_POSITION_PRECEDING;
      const candidates = visibleFocusableElements()
        .filter((element) => !container.contains(element));
      const ordered = direction === 'forward' ? candidates : candidates.reverse();
      const target = ordered.find((element) =>
        Boolean(container.compareDocumentPosition(element) & position)) ??
        document.querySelector('.site-header .brand');

      setOpen(false);
      if (target instanceof HTMLElement) target.focus();
    }

    trigger.addEventListener('click', () => setOpen(!isOpen));
    panel.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a[href]')) {
        window.requestAnimationFrame(() => setOpen(false));
      }
    });
    container.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      if (!isOpen && event.target === trigger) {
        event.preventDefault();
        moveFocusOutside(event.shiftKey ? 'backward' : 'forward');
        return;
      }
      if (!isOpen) return;

      const panelControls = Array.from(panel.querySelectorAll(focusableSelector));
      const boundaryControl = event.shiftKey
        ? trigger
        : panelControls.at(-1) ?? trigger;
      if (event.target === boundaryControl) {
        event.preventDefault();
        moveFocusOutside(event.shiftKey ? 'backward' : 'forward');
      }
    }, {capture: true});
    container.addEventListener('focusout', (event) => {
      if (!isOpen) return;
      if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;
      window.requestAnimationFrame(() => {
        if (!(document.activeElement instanceof Node && container.contains(document.activeElement))) {
          setOpen(false);
        }
      });
    });
    document.addEventListener('keydown', (event) => {
      if (!isOpen || event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      trigger.focus();
    }, {capture: true});
    const handleBreakpointChange = (event) => {
      if (event.matches || !isOpen) return;
      const activeElement = document.activeElement;
      const restoreVisibleFocus = (
        activeElement instanceof Node && container.contains(activeElement)
      ) || activeElement === document.body || activeElement === document.documentElement;
      setOpen(false);
      const brand = document.querySelector('.site-header .brand');
      if (restoreVisibleFocus && brand instanceof HTMLElement) brand.focus();
    };

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      try {
        resizeObserver = new ResizeObserver(updateAvailableHeight);
      } catch {
        resizeObserver = null;
      }
    }
    resizeObserver?.observe(container.closest('.site-header') ?? container);
    window.addEventListener('resize', updateAvailableHeight);
    window.addEventListener('scroll', updateAvailableHeight, {passive: true});
    window.visualViewport?.addEventListener('resize', updateAvailableHeight);
    window.visualViewport?.addEventListener('scroll', updateAvailableHeight);
    if (typeof mobileBreakpoint.addEventListener === 'function') {
      mobileBreakpoint.addEventListener('change', handleBreakpointChange);
    } else {
      mobileBreakpoint.addListener(handleBreakpointChange);
    }

    const fallbackHadFocus = fallback.contains(document.activeElement) || (
      fallback.open &&
      (document.activeElement === document.body || document.activeElement === document.documentElement)
    );
    setOpen(false);
    container.dataset.mounted = 'true';
    container.dataset.ready = 'true';
    if (fallbackHadFocus) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const activeElement = document.activeElement;
          if (
            fallback.contains(activeElement) ||
            activeElement === document.body ||
            activeElement === document.documentElement
          ) trigger.focus({preventScroll: true});
        });
      });
    }
    fallback.open = false;
  }

  function correctReducedMotionHashLanding() {
    const initialHash = window.location.hash;
    if (
      !initialHash ||
      !window.matchMedia('(max-width: 1060px)').matches ||
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.querySelector('.resource-library')
    ) return;

    let targetId = '';
    try {
      targetId = decodeURIComponent(initialHash.slice(1));
    } catch {
      return;
    }
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;

    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    void fontsReady.then(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (
            window.location.hash === initialHash &&
            document.getElementById(targetId) === target &&
            !target.hidden
          ) target.scrollIntoView({behavior: 'instant', block: 'start'});
        });
      });
    });
  }

  document.querySelectorAll('[data-static-mobile-navigation]').forEach((container) => {
    if (container instanceof HTMLElement) mountMobileNavigation(container);
  });
  updateLanguageLinks();
  correctReducedMotionHashLanding();
  window.addEventListener('hashchange', updateLanguageLinks);
  window.addEventListener('popstate', updateLanguageLinks);
  window.addEventListener(locationChangeEvent, updateLanguageLinks);
})();

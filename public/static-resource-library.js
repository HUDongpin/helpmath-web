(() => {
  'use strict';

  const locationChangeEvent = 'help-math:location-change';
  const fragmentNavigationClass = 'resource-fragment-navigation';
  const allowedSelections = new Set(['all', 'program', 'research', 'technical']);
  const allowedCategories = new Set(['program', 'research', 'technical']);

  function replaceLocation(url) {
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new Event(locationChangeEvent));
  }

  function normalizeSearchValue(value) {
    return value
      .normalize('NFKD')
      .replace(/\p{Mark}/gu, '')
      .toLowerCase()
      .trim();
  }

  function decodedHashId(hash) {
    if (!hash) return '';
    try {
      return decodeURIComponent(hash.slice(1));
    } catch {
      return '';
    }
  }

  function mountResourceLibrary(library) {
    if (library.dataset.resourceMounted === 'true') return;
    const controls = library.querySelector('[data-resource-controls]');
    const input = library.querySelector('[data-resource-search]');
    const buttons = Array.from(library.querySelectorAll('[data-resource-selection]'));
    const status = library.querySelector('[data-resource-results]');
    const empty = library.querySelector('[data-resource-empty]');
    const list = library.querySelector('[data-resource-list]');
    const entries = Array.from(library.querySelectorAll('.resource-entry'));
    if (
      !(controls instanceof HTMLElement) ||
      !(input instanceof HTMLInputElement) ||
      !(status instanceof HTMLElement) ||
      !(empty instanceof HTMLElement) ||
      !(list instanceof HTMLElement) ||
      buttons.some((button) => !(button instanceof HTMLButtonElement)) ||
      entries.some((entry) => !(entry instanceof HTMLElement))
    ) return;
    const selectionValues = buttons.map((button) => button.dataset.resourceSelection || '');
    if (
      buttons.length !== allowedSelections.size ||
      new Set(selectionValues).size !== allowedSelections.size ||
      selectionValues.some((value) => !allowedSelections.has(value)) ||
      entries.some((entry) => !allowedCategories.has(entry.dataset.resourceCategory || ''))
    ) return;

    const resultTemplate = status.dataset.resultTemplate || '{count}';
    const resultsTemplate = status.dataset.resultsTemplate || resultTemplate;
    let selection = 'all';
    let searchIndex = null;
    let alignmentVersion = 0;

    function clearHiddenResourceHash() {
      const target = document.getElementById(decodedHashId(window.location.hash));
      if (!target?.classList.contains('resource-entry') || !target.hidden) return;
      document.documentElement.classList.remove(fragmentNavigationClass);
      delete window.__helpMathDeferredResourceHash;
      replaceLocation(`${window.location.pathname}${window.location.search}`);
    }

    function applyFiltering() {
      const normalizedQuery = normalizeSearchValue(input.value);
      if (normalizedQuery && !searchIndex) {
        searchIndex = new Map(entries.map((entry) => [
          entry.id,
          normalizeSearchValue(entry.textContent || ''),
        ]));
      }
      const searchMatches = normalizedQuery
        ? entries.filter((entry) => searchIndex?.get(entry.id)?.includes(normalizedQuery))
        : entries;
      const visibleEntries = searchMatches.filter((entry) =>
        selection === 'all' || entry.dataset.resourceCategory === selection);
      const visible = new Set(visibleEntries);

      for (const entry of entries) {
        const shouldHide = !visible.has(entry);
        if (entry.hidden !== shouldHide) entry.hidden = shouldHide;
      }
      const shouldHideList = visibleEntries.length === 0;
      if (list.hidden !== shouldHideList) list.hidden = shouldHideList;
      const shouldHideEmpty = visibleEntries.length > 0;
      if (empty.hidden !== shouldHideEmpty) empty.hidden = shouldHideEmpty;
      const template = visibleEntries.length === 1 ? resultTemplate : resultsTemplate;
      const resultText = template.replace('{count}', String(visibleEntries.length));
      if (status.textContent !== resultText) status.textContent = resultText;

      for (const button of buttons) {
        const value = button.dataset.resourceSelection || '';
        const count = value === 'all'
          ? searchMatches.length
          : searchMatches.filter((entry) => entry.dataset.resourceCategory === value).length;
        const pressed = String(value === selection);
        if (button.getAttribute('aria-pressed') !== pressed) {
          button.setAttribute('aria-pressed', pressed);
        }
        const countElement = button.querySelector('.resource-filters__count');
        if (countElement && countElement.textContent !== String(count)) {
          countElement.textContent = String(count);
        }
      }
      clearHiddenResourceHash();
    }

    function alignResourceHash(hashChanged = false) {
      const version = ++alignmentVersion;
      const currentHash = window.location.hash;
      let deferredHash = window.__helpMathDeferredResourceHash;
      if (hashChanged && deferredHash && currentHash !== deferredHash) {
        delete window.__helpMathDeferredResourceHash;
        deferredHash = undefined;
      }
      const hash = currentHash || deferredHash || '';

      function restoreDeferredHash() {
        if (
          !deferredHash ||
          window.__helpMathDeferredResourceHash !== deferredHash
        ) return;
        if (window.location.hash && window.location.hash !== deferredHash) {
          delete window.__helpMathDeferredResourceHash;
          return;
        }
        if (window.location.hash !== deferredHash) {
          replaceLocation(
            `${window.location.pathname}${window.location.search}${deferredHash}`,
          );
        }
        if (window.__helpMathDeferredResourceHash === deferredHash) {
          delete window.__helpMathDeferredResourceHash;
        }
      }

      if (!hash) {
        document.documentElement.classList.remove(fragmentNavigationClass);
        return;
      }
      const target = document.getElementById(decodedHashId(hash));
      const targetIsHiddenResource = Boolean(
        target?.classList.contains('resource-entry') && target.hidden,
      );
      if (!target || targetIsHiddenResource) {
        restoreDeferredHash();
        document.documentElement.classList.remove(fragmentNavigationClass);
        if (targetIsHiddenResource) {
          delete window.__helpMathDeferredResourceHash;
          replaceLocation(`${window.location.pathname}${window.location.search}`);
        }
        return;
      }

      document.documentElement.classList.toggle(
        fragmentNavigationClass,
        target.classList.contains('resource-entry'),
      );
      restoreDeferredHash();
      const fontsReady = document.fonts?.ready ?? Promise.resolve();
      void fontsReady.then(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            const activeId = decodedHashId(
              window.location.hash || window.__helpMathDeferredResourceHash || '',
            );
            if (
              version === alignmentVersion &&
              activeId === target.id &&
              document.getElementById(target.id) === target &&
              !target.hidden
            ) target.scrollIntoView({behavior: 'instant', block: 'start'});
          });
        });
      });
    }

    input.disabled = false;
    input.addEventListener('input', applyFiltering);
    for (const button of buttons) {
      const value = button.dataset.resourceSelection || '';
      if (!allowedSelections.has(value)) continue;
      button.disabled = false;
      button.addEventListener('click', () => {
        selection = value;
        applyFiltering();
      });
    }
    window.addEventListener('hashchange', () => alignResourceHash(true));
    applyFiltering();
    alignResourceHash();
    library.dataset.resourceMounted = 'true';
    library.dataset.resourceReady = 'true';
  }

  document.querySelectorAll('.resource-library').forEach((library) => {
    if (library instanceof HTMLElement) mountResourceLibrary(library);
  });
})();

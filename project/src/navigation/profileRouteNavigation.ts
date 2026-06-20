/** Profile route scroll helpers — instant positioning on `<main>` (no smooth scroll). */

function getProfileScrollMain(): HTMLElement | null {
  const main = document.querySelector('main');
  return main instanceof HTMLElement ? main : null;
}

/** Force `scroll-behavior: auto` for programmatic jumps even if CSS adds smooth scrolling. */
function withInstantMainScroll(main: HTMLElement, apply: () => void): void {
  const previous = main.style.scrollBehavior;
  main.style.scrollBehavior = 'auto';
  try {
    apply();
  } finally {
    main.style.scrollBehavior = previous;
  }
}

export function scrollProfileRouteToTop(): void {
  const main = getProfileScrollMain();
  if (!main) return;
  withInstantMainScroll(main, () => {
    main.scrollTop = 0;
  });
}

/** Scroll so the target section header sits at the top of the profile scroll viewport. */
export function scrollProfileToSection(elementId: string, offsetPx = 0): boolean {
  const main = getProfileScrollMain();
  const el = document.getElementById(elementId);
  if (!main || !el) return false;

  withInstantMainScroll(main, () => {
    const mainRect = main.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    main.scrollTop = Math.max(0, main.scrollTop + (elRect.top - mainRect.top) - offsetPx);
  });
  return true;
}

/** Synchronous scroll; one rAF retry only when the target node is not mounted yet. */
export function scrollProfileToSectionWhenReady(elementId: string, offsetPx = 0): void {
  if (scrollProfileToSection(elementId, offsetPx)) return;
  requestAnimationFrame(() => {
    scrollProfileToSection(elementId, offsetPx);
  });
}

export function readProfileSettingsHash(): string {
  return window.location.hash.replace(/^#/, '').trim();
}

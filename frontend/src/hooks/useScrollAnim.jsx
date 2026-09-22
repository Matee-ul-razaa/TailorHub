import { useEffect, useRef } from 'react';

/**
 * Custom hook to add scroll-triggered animations.
 * Attach the returned ref to a container, and any children with
 * class `scroll-anim`, `scroll-anim-left`, `scroll-anim-right`, or `scroll-anim-scale`
 * will animate into view on scroll.
 *
 * Elements that are already inside the viewport on mount (e.g. after a
 * hard refresh) are revealed immediately so they don't stay invisible.
 */
export function useScrollAnim() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const SELECTOR =
      '.scroll-anim, .scroll-anim-left, .scroll-anim-right, .scroll-anim-scale';

    // ── 1. Immediately reveal any element that is already in the viewport ──
    // This prevents the "invisible after refresh" bug: useEffect fires after
    // the first paint, so IntersectionObserver may never fire for elements
    // that were already fully in view.
    const revealIfInView = (el) => {
      if (el.classList.contains('visible')) return;
      const rect = el.getBoundingClientRect();
      const inViewport =
        rect.top < window.innerHeight + 60 && rect.bottom > -60;
      if (inViewport) {
        el.classList.add('visible');
      }
    };

    const allAnimEls = container.querySelectorAll(SELECTOR);
    // Use rAF to ensure layout has settled before checking positions
    requestAnimationFrame(() => {
      allAnimEls.forEach(revealIfInView);
      if (container.matches?.(SELECTOR)) revealIfInView(container);
    });

    // ── 2. IntersectionObserver handles elements below the fold ──
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '60px 0px -20px 0px' }
    );

    const observeWithin = (root) => {
      if (root.nodeType !== 1) return;
      if (root.matches?.(SELECTOR) && !root.classList.contains('visible')) {
        observer.observe(root);
      }
      root.querySelectorAll?.(SELECTOR).forEach((el) => {
        if (!el.classList.contains('visible')) observer.observe(el);
      });
    };

    observeWithin(container);

    // Re-observe elements added after mount (pagination, filter changes, etc.)
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          // For dynamically added nodes, check if they are already in view
          requestAnimationFrame(() => {
            if (node.matches?.(SELECTOR)) revealIfInView(node);
            node.querySelectorAll?.(SELECTOR).forEach(revealIfInView);
          });
          observeWithin(node);
        });
      });
    });
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return containerRef;
}

export default useScrollAnim;


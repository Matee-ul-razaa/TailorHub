import { useCallback, useRef } from 'react';

/**
 * Custom hook to add scroll-triggered animations.
 * Attach the returned ref to a container, and any children with
 * class `scroll-anim`, `scroll-anim-left`, `scroll-anim-right`, or `scroll-anim-scale`
 * will animate into view on scroll.
 *
 * Uses a **callback ref** so the observer is created when the container
 * DOM node is actually attached (even after a loading spinner).
 */
export function useScrollAnim() {
  const observerRef = useRef(null);
  const mutationRef = useRef(null);

  const callbackRef = useCallback((container) => {
    // ── Clean up previous observers when the node changes ──
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (mutationRef.current) {
      mutationRef.current.disconnect();
      mutationRef.current = null;
    }

    if (!container) return;

    const SELECTOR =
      '.scroll-anim, .scroll-anim-left, .scroll-anim-right, .scroll-anim-scale';

    // ── 1. Immediately reveal elements already in the viewport ──
    const revealIfInView = (el) => {
      if (el.classList.contains('visible')) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 80 && rect.bottom > -80) {
        el.classList.add('visible');
      }
    };

    // Reveal in-viewport elements on next frame (after layout settles)
    requestAnimationFrame(() => {
      if (container.matches?.(SELECTOR)) revealIfInView(container);
      container.querySelectorAll(SELECTOR).forEach(revealIfInView);
    });

    // ── 2. IntersectionObserver for elements below the fold ──
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '80px 0px -10px 0px' }
    );
    observerRef.current = io;

    const observeWithin = (root) => {
      if (root.nodeType !== 1) return;
      if (root.matches?.(SELECTOR) && !root.classList.contains('visible')) {
        io.observe(root);
      }
      root.querySelectorAll?.(SELECTOR).forEach((el) => {
        if (!el.classList.contains('visible')) io.observe(el);
      });
    };

    observeWithin(container);

    // ── 3. MutationObserver for dynamically added elements ──
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          // Reveal immediately if already in viewport, else observe
          requestAnimationFrame(() => {
            if (node.matches?.(SELECTOR)) revealIfInView(node);
            node.querySelectorAll?.(SELECTOR).forEach(revealIfInView);
          });
          observeWithin(node);
        });
      });
    });
    mo.observe(container, { childList: true, subtree: true });
    mutationRef.current = mo;
  }, []);

  return callbackRef;
}

export default useScrollAnim;


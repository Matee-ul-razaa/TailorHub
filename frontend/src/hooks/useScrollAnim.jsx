import { useEffect, useRef } from 'react';

/**
 * Custom hook to add scroll-triggered animations.
 * Attach the returned ref to a container, and any children with
 * class `scroll-anim`, `scroll-anim-left`, `scroll-anim-right`, or `scroll-anim-scale`
 * will animate into view on scroll.
 */
export function useScrollAnim() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const SELECTOR =
      '.scroll-anim, .scroll-anim-left, .scroll-anim-right, .scroll-anim-scale';

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
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
        mutation.addedNodes.forEach((node) => observeWithin(node));
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

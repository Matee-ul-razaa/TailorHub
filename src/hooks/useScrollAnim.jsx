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

    const targets = container.querySelectorAll(
      '.scroll-anim, .scroll-anim-left, .scroll-anim-right, .scroll-anim-scale'
    );

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

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return containerRef;
}

export default useScrollAnim;

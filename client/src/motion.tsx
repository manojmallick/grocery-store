/**
 * Dependency-free motion engine.
 * <Reveal> fades/slides children in when they enter the viewport (staggered via delay).
 * useCountUp animates numbers when visible. Both respect prefers-reduced-motion.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  style,
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "section" | "span";
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(reduced());

  useEffect(() => {
    if (shown || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${shown ? "reveal-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

/** Animated count-up (e.g. "120+", "4.9", "99.9%") preserving prefix/suffix. */
export function useCountUp(raw: string, durationMs = 1400): [React.RefObject<HTMLSpanElement | null>, string] {
  const ref = useRef<HTMLSpanElement>(null);
  const match = raw.match(/-?\d[\d,.]*/);
  const target = match ? parseFloat(match[0].replace(/,/g, "")) : NaN;
  const decimals = match && match[0].includes(".") ? (match[0].split(".")[1]?.length ?? 0) : 0;
  const [value, setValue] = useState(isNaN(target) || reduced() ? raw : raw.replace(match![0], "0"));

  useEffect(() => {
    if (isNaN(target) || reduced() || !ref.current) return;
    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(raw.replace(match![0], (target * eased).toFixed(decimals)));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  return [ref, value];
}

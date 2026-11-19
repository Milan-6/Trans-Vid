import { useEffect, useRef } from "react";

/** Mounted only for fine pointers without reduced motion. Position lives in refs, never React state. */
export default function CustomCursor({ enabled }) {
  const dot = useRef(null);
  const ring = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    document.documentElement.classList.add("custom-cursor");
    const target = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };
    let raf = 0;
    let interactive = false;
    let text = false;

    const onMove = (e) => { target.x = e.clientX; target.y = e.clientY; };
    const onOver = (e) => {
      const el = e.target instanceof Element ? e.target : null;
      interactive = Boolean(el?.closest("button, a, summary, [role='button']"));
      text = Boolean(el?.closest("input, textarea"));
    };
    const loop = () => {
      pos.x += (target.x - pos.x) * 0.2;
      pos.y += (target.y - pos.y) * 0.2;
      if (dot.current) {
        dot.current.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) translate(-50%, -50%)`;
        dot.current.style.opacity = text ? "0" : "1";
      }
      if (ring.current) {
        ring.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${interactive ? 1.7 : 1})`;
        ring.current.style.opacity = text ? "0.35" : "1";
      }
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      document.documentElement.classList.remove("custom-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50">
      <div ref={ring} className="absolute left-0 top-0 h-8 w-8 rounded-full border border-cyan/70 transition-[opacity] duration-200" style={{ transform: "translate3d(-100px,-100px,0)" }} />
      <div ref={dot} className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-ice" style={{ transform: "translate3d(-100px,-100px,0)" }} />
    </div>
  );
}

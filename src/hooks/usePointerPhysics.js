import { useEffect, useState } from "react";
import gsap from "gsap";

const FINE_QUERY = "(pointer: fine) and (hover: hover)";
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function useFinePointer() {
  const [fine, setFine] = useState(() => window.matchMedia(FINE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(FINE_QUERY);
    const onChange = (e) => setFine(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return fine;
}

/** Magnetic pull (max 4px) and GSAP press feedback (scale 0.97) for a button. */
export function useButtonPhysics(ref, { magnetic, press }) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const MAX = 4;
    const qx = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
    const qy = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });
    const move = (e) => {
      if (!magnetic || e.pointerType !== "mouse" || el.disabled) return;
      const r = el.getBoundingClientRect();
      qx(clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1) * MAX);
      qy(clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1) * MAX);
    };
    const leave = () => { qx(0); qy(0); };
    const down = () => { if (press && !el.disabled) gsap.to(el, { scale: 0.97, duration: 0.12, ease: "power2.out", overwrite: "auto" }); };
    const up = () => { if (press) gsap.to(el, { scale: 1, duration: 0.25, ease: "back.out(2)", overwrite: "auto" }); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", up);
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: "x,y,scale" });
    };
  }, [ref, magnetic, press]);
}

/** Independent card tilt (max ±3°) with a glare position exposed as CSS vars. */
export function useCardTilt(ref, enabled) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;
    const MAX = 3;
    const move = (e) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const px = clamp((e.clientX - r.left) / r.width, 0, 1);
      const py = clamp((e.clientY - r.top) / r.height, 0, 1);
      gsap.to(el, { rotateY: (px - 0.5) * 2 * MAX, rotateX: -(py - 0.5) * 2 * MAX, transformPerspective: 1100, duration: 0.5, ease: "power2.out", overwrite: "auto" });
      el.style.setProperty("--gx", `${px * 100}%`);
      el.style.setProperty("--gy", `${py * 100}%`);
      el.style.setProperty("--glare", "1");
    };
    const leave = () => {
      gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.7, ease: "power3.out", overwrite: "auto" });
      el.style.setProperty("--glare", "0");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: "rotateX,rotateY,transformPerspective" });
    };
  }, [ref, enabled]);
}

/** Smoothed cursor spotlight written straight to CSS vars (no React state). */
export function usePointerSpotlight(ref, enabled) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const cur = { ...target };
    let raf = 0;
    const onMove = (e) => { target.x = e.clientX; target.y = e.clientY; };
    const loop = () => {
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      el.style.setProperty("--sx", `${cur.x}px`);
      el.style.setProperty("--sy", `${cur.y}px`);
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [ref, enabled]);
}

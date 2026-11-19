import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

export default function HeroHeader({ reducedMotion }) {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion) return undefined;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-hero='badge']", { opacity: 0, y: -10, duration: 0.6 })
        .from("[data-hero='line']", { opacity: 0, y: 36, duration: 0.9, stagger: 0.12 }, "-=0.3")
        .from("[data-hero='sub']", { opacity: 0, y: 16, duration: 0.7 }, "-=0.5");
    }, root);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <div ref={root}>
      <header data-hero="badge" className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs font-bold tracking-widest text-cyan uppercase">Trans-Vid</span>
        <span className="hidden text-ice/30 sm:inline">/</span>
        <p className="rounded-full border border-ice/15 bg-ink/50 px-3.5 py-1.5 font-mono text-[11px] tracking-wide text-ice/75 backdrop-blur-sm sm:text-xs">
          n8n · whisper-large-v3 · gemini-3.5-flash-lite
        </p>
      </header>
      <h1 className="font-display-tight mt-8 max-w-4xl font-display text-[clamp(2.6rem,8.2vw,6.4rem)] font-light leading-[0.98] text-ice [text-wrap:balance]">
        <span data-hero="line" className="block">Turn Any Video</span>
        <span data-hero="line" className="block">Into Knowledge.</span>
      </h1>
      <p data-hero="sub" className="mt-6 max-w-xl text-base leading-relaxed text-ice/70 sm:text-lg">
        Extract, transcribe and transform video into structured intelligence.
      </p>
    </div>
  );
}

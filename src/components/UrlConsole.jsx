import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { useButtonPhysics, useCardTilt } from "../hooks/usePointerPhysics.js";
import { APP_STATES } from "../config/constants.js";

export function validateMediaUrl(raw) {
  const value = (raw || "").trim();
  if (!value) return { ok: false, message: "Enter a video or audio URL to continue." };
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, message: "That isn't a valid URL. Include the full address, for example https://example.com/video." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, message: `Only http: and https: links are supported (this one uses ${parsed.protocol}).` };
  }
  return { ok: true, url: value };
}

export default function UrlConsole({ value, onChange, onSubmit, appState, message, pointerFx, reducedMotion }) {
  const card = useRef(null);
  const button = useRef(null);
  const input = useRef(null);
  const busy = appState === APP_STATES.VALIDATING || appState === APP_STATES.PROCESSING;
  const submitting = appState === APP_STATES.PROCESSING || appState === APP_STATES.VALIDATING;

  useCardTilt(card, pointerFx);
  useButtonPhysics(button, { magnetic: pointerFx, press: !reducedMotion });

  useLayoutEffect(() => {
    if (reducedMotion) return undefined;
    const ctx = gsap.context(() => {
      gsap.from(card.current, { opacity: 0, y: 28, duration: 0.9, delay: 0.6, ease: "power3.out" });
    });
    return () => ctx.revert();
  }, [reducedMotion]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!busy) onSubmit();
  };

  return (
    <form ref={card} onSubmit={handleSubmit} noValidate className="surface tilt-card rounded-2xl p-5 sm:p-7" aria-busy={busy}>
      <label htmlFor="source-media" className="font-mono text-[11px] tracking-[0.18em] text-cyan">
        SOURCE MEDIA
      </label>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="relative min-w-0 flex-1">
          <input
            ref={input}
            id="source-media"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value}
            disabled={busy}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste a video or audio URL..."
            aria-invalid={Boolean(message && appState === APP_STATES.ERROR)}
            aria-describedby="source-media-msg"
            className="h-14 w-full rounded-xl border border-ice/15 bg-ink/60 pl-4 pr-12 font-mono text-sm text-ice placeholder:text-ice/35 focus:border-cyan/70 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-cyan/40 disabled:opacity-60"
          />
          {value && !busy && (
            <button
              type="button"
              onClick={() => { onChange(""); input.current?.focus(); }}
              aria-label="Clear URL"
              className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-ice/55 hover:text-ice"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <button
          ref={button}
          type="submit"
          disabled={busy}
          className="inline-flex h-14 min-w-[10.5rem] items-center justify-center gap-2 rounded-xl bg-cyan px-6 text-sm font-semibold text-ink transition-colors hover:bg-mint disabled:cursor-not-allowed disabled:bg-ice/15 disabled:text-ice/60"
        >
          {submitting ? (
            <>
              <LoaderCircle size={18} className="animate-spin-slow" aria-hidden="true" />
              Running…
            </>
          ) : (
            <>
              Run Pipeline
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      <div id="source-media-msg" role={message ? "alert" : undefined} className="min-h-[1.5rem] pt-3 text-sm leading-relaxed text-coral">
        {message}
      </div>
    </form>
  );
}

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { useButtonPhysics, useCardTilt } from "../hooks/usePointerPhysics.js";
import { APP_STATES, PROMPT_PRESETS } from "../config/constants.js";

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

export default function UrlConsole({
  value,
  onChange,
  prompt = "",
  onChangePrompt,
  onSubmit,
  appState,
  message,
  pointerFx,
  reducedMotion,
}) {
  const card = useRef(null);
  const button = useRef(null);
  const input = useRef(null);
  const promptInput = useRef(null);
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

  const handlePresetClick = (presetText) => {
    if (busy || !onChangePrompt) return;
    if ((prompt || "").trim() === presetText.trim()) {
      onChangePrompt("");
    } else {
      onChangePrompt(presetText);
    }
    promptInput.current?.focus();
  };

  return (
    <form ref={card} onSubmit={handleSubmit} noValidate className="surface tilt-card rounded-2xl p-5 sm:p-7" aria-busy={busy}>
      {/* SOURCE MEDIA SECTION */}
      <div>
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
              className="h-14 w-full rounded-xl border border-ice/15 bg-ink/60 pl-4 pr-12 font-mono text-sm text-ice placeholder:text-ice/35 focus:border-cyan/70 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-cyan/40 disabled:opacity-60 transition-colors"
            />
            {value && !busy && (
              <button
                type="button"
                onClick={() => { onChange(""); input.current?.focus(); }}
                aria-label="Clear URL"
                className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-ice/55 hover:text-ice transition-colors"
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
      </div>

      {/* TASK PROMPT SECTION */}
      <div className="mt-6 border-t border-ice/10 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="task-prompt" className="font-mono text-[11px] tracking-[0.18em] text-cyan">
              TASK PROMPT
            </label>
            <span className="font-mono text-[10px] tracking-wider text-ice/40 uppercase">
              (Optional)
            </span>
          </div>

          {prompt && !busy && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-ice/40">
                {prompt.length} chars
              </span>
              <button
                type="button"
                onClick={() => { onChangePrompt?.(""); promptInput.current?.focus(); }}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-ice/50 hover:text-ice transition-colors"
                aria-label="Clear task prompt"
              >
                <X size={13} />
                Clear
              </button>
            </div>
          )}
        </div>

        <p className="mt-1.5 text-xs leading-relaxed text-ice/60">
          Tell the AI what you want to accomplish with this media. Leave empty to use the default workflow.
        </p>

        <div className="relative mt-2.5">
          <textarea
            ref={promptInput}
            id="task-prompt"
            rows={3}
            disabled={busy}
            value={prompt}
            onChange={(e) => onChangePrompt?.(e.target.value)}
            placeholder="e.g. Summarize the transcript and highlight 5 action items, or extract key concepts..."
            className="w-full resize-y min-h-[5.5rem] max-h-48 rounded-xl border border-ice/15 bg-ink/60 p-3.5 font-sans text-sm text-ice placeholder:text-ice/35 hover:border-ice/30 focus:border-cyan/70 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-cyan/40 disabled:opacity-60 transition-colors leading-relaxed"
          />
        </div>

        {/* PRESET PROMPTS */}
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ice/40 mr-1">
              Presets:
            </span>
            {PROMPT_PRESETS.map((preset) => {
              const isSelected = (prompt || "").trim() === preset.prompt.trim();
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handlePresetClick(preset.prompt)}
                  aria-pressed={isSelected}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-sans text-xs transition-all ${
                    isSelected
                      ? "border-cyan/80 bg-cyan/15 text-cyan font-medium shadow-sm"
                      : "border-ice/15 bg-ink/40 text-ice/75 hover:border-ice/35 hover:text-ice hover:bg-ink/60"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      isSelected ? "bg-cyan" : "bg-ice/30"
                    }`}
                    aria-hidden="true"
                  />
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div id="source-media-msg" role={message ? "alert" : undefined} className="min-h-[1.5rem] pt-3 text-sm leading-relaxed text-coral">
        {message}
      </div>
    </form>
  );
}

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { useButtonPhysics, useCardTilt } from "../hooks/usePointerPhysics.js";
import { APP_STATES, PROMPT_PRESETS } from "../config/constants.js";

export function validateMediaUrl(raw, prompt) {
  if (prompt !== undefined) {
    const promptValue = (prompt || "").trim();
    if (!promptValue) {
      return {
        ok: false,
        message: "Please enter a task prompt describing what you want the AI agent to do.",
      };
    }
  }
  const value = (raw || "").trim();
  if (value) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      return {
        ok: false,
        message:
          "That isn't a valid URL. Include the full address, for example https://example.com/video.",
      };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        ok: false,
        message: `Only http: and https: links are supported (this one uses ${parsed.protocol}).`,
      };
    }
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
    <form
      ref={card}
      onSubmit={handleSubmit}
      noValidate
      className="surface tilt-card rounded-2xl p-6 sm:p-8"
      aria-busy={busy}
    >
      {/* 1. PRIMARY: TASK PROMPT */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <label
              htmlFor="task-prompt"
              className="font-mono text-xs font-semibold tracking-[0.2em] text-cyan"
            >
              TASK PROMPT
            </label>
            <span className="rounded bg-cyan/15 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-cyan uppercase">
              REQUIRED
            </span>
          </div>

          <div className="flex items-center gap-3">
            {prompt && (
              <span className="font-mono text-[11px] text-ice/45">
                {prompt.length} chars
              </span>
            )}
            {prompt && !busy && (
              <button
                type="button"
                onClick={() => {
                  onChangePrompt?.("");
                  promptInput.current?.focus();
                }}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-ice/50 hover:text-ice transition-colors"
                aria-label="Clear task prompt"
              >
                <X size={13} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Primary Multiline Textarea */}
        <div className="relative mt-3">
          <textarea
            ref={promptInput}
            id="task-prompt"
            rows={4}
            disabled={busy}
            value={prompt}
            onChange={(e) => onChangePrompt?.(e.target.value)}
            placeholder={`Describe what you want the AI agent to accomplish...\n\nFor example: Analyze this educational content, extract the important concepts, create structured study notes, and organize them into a learning plan.`}
            aria-required="true"
            aria-invalid={Boolean(message && !prompt.trim() && appState === APP_STATES.ERROR)}
            aria-describedby="console-msg"
            className="w-full resize-y min-h-[7rem] max-h-64 rounded-xl border border-ice/15 bg-ink/70 p-4 font-sans text-sm sm:text-base text-ice placeholder:text-ice/35 hover:border-ice/30 focus:border-cyan/70 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-cyan/40 disabled:opacity-60 transition-colors leading-relaxed"
          />
        </div>

        {/* 2. PROMPT PRESET CHIPS */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
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

      {/* VISUAL SEPARATOR */}
      <div className="my-6 border-t border-ice/10" />

      {/* 3. SECONDARY: SOURCE MEDIA */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <label
              htmlFor="source-media"
              className="font-mono text-[11px] font-semibold tracking-[0.18em] text-ice/70"
            >
              SOURCE MEDIA
            </label>
            <span className="rounded bg-ice/8 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-ice/40 uppercase">
              OPTIONAL
            </span>
          </div>
          <span className="text-[11px] text-ice/40 hidden sm:inline">
            Supporting video or audio context
          </span>
        </div>

        <div className="relative mt-2.5">
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
            placeholder="Paste a YouTube, video or audio URL (optional)"
            aria-invalid={Boolean(message && value.trim() && appState === APP_STATES.ERROR)}
            aria-describedby="console-msg"
            className="h-12 w-full rounded-xl border border-ice/15 bg-ink/50 pl-4 pr-12 font-mono text-sm text-ice placeholder:text-ice/35 hover:border-ice/30 focus:border-cyan/70 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-cyan/40 disabled:opacity-60 transition-colors"
          />
          {value && !busy && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                input.current?.focus();
              }}
              aria-label="Clear URL"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ice/55 hover:text-ice transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 4. PRIMARY RUN PIPELINE BUTTON */}
      <div className="mt-6">
        <button
          ref={button}
          type="submit"
          disabled={busy}
          className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-cyan px-6 text-sm sm:text-base font-semibold text-ink transition-colors hover:bg-mint disabled:cursor-not-allowed disabled:bg-ice/15 disabled:text-ice/60 shadow-lg shadow-cyan/10"
        >
          {submitting ? (
            <>
              <LoaderCircle size={18} className="animate-spin-slow" aria-hidden="true" />
              Running Pipeline…
            </>
          ) : (
            <>
              Run Pipeline
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {/* ERROR / STATUS FEEDBACK */}
      <div
        id="console-msg"
        role={message ? "alert" : undefined}
        className="min-h-[1.5rem] pt-3 text-sm leading-relaxed text-coral"
      >
        {message}
      </div>
    </form>
  );
}

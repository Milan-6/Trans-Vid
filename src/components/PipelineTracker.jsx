import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { AudioLines, Check, Download, FileText, TriangleAlert } from "lucide-react";
import { APP_STATES, PIPELINE_STAGES, PROCESSING_MESSAGE } from "../config/constants.js";

const ICONS = { fetch: Download, transcribe: AudioLines, summarize: FileText };

const STATUS_TEXT = {
  [APP_STATES.IDLE]: "Ready. Paste a media URL to run the pipeline.",
  [APP_STATES.VALIDATING]: "Checking the URL…",
  [APP_STATES.PROCESSING]: PROCESSING_MESSAGE,
  [APP_STATES.COMPLETED]: "Pipeline complete. Response validated.",
  [APP_STATES.ERROR]: "Pipeline did not complete.",
};

const STAGE_STYLE = {
  [APP_STATES.IDLE]: "border-ice/12 text-ice/70",
  [APP_STATES.VALIDATING]: "border-ice/12 text-ice/70",
  [APP_STATES.PROCESSING]: "border-coral/60 text-ice",
  [APP_STATES.COMPLETED]: "border-mint/60 text-ice",
  [APP_STATES.ERROR]: "border-mauve/50 text-ice/70",
};

const MARK_STYLE = {
  [APP_STATES.PROCESSING]: "bg-coral/15 text-coral animate-softpulse",
  [APP_STATES.COMPLETED]: "bg-mint/20 text-mint",
  [APP_STATES.ERROR]: "bg-mauve/20 text-mauve",
};

export default function PipelineTracker({ appState, reducedMotion }) {
  const list = useRef(null);
  const processing = appState === APP_STATES.PROCESSING;
  const completed = appState === APP_STATES.COMPLETED;

  useLayoutEffect(() => {
    if (!completed || reducedMotion) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-mark]", { scale: 0.6 }, { scale: 1, duration: 0.5, ease: "back.out(2.2)", stagger: 0.08 });
    }, list);
    return () => ctx.revert();
  }, [completed, reducedMotion]);

  return (
    <section aria-label="Pipeline status" className="mt-6">
      <ol ref={list} className="relative grid gap-3 md:grid-cols-3">
        {PIPELINE_STAGES.map((stage) => {
          const Icon = appState === APP_STATES.COMPLETED ? Check : appState === APP_STATES.ERROR ? TriangleAlert : ICONS[stage.id];
          return (
            <li
              key={stage.id}
              className={`surface flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors duration-500 ${STAGE_STYLE[appState]}`}
            >
              <span data-mark className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ice/8 text-ice/60 transition-colors duration-500 ${MARK_STYLE[appState] || ""}`}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug">{stage.title}</span>
                <span className="mt-0.5 block font-mono text-[11px] text-ice/50">{stage.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-ice/10" aria-hidden="true">
        {processing && <div className="animate-sweep h-full w-1/3 rounded-full bg-coral" />}
        {completed && <div className="h-full w-full rounded-full bg-mint" />}
      </div>

      <p role="status" aria-live="polite" className={`mt-3 font-mono text-xs leading-relaxed ${processing ? "text-coral" : completed ? "text-mint" : "text-ice/55"}`}>
        {STATUS_TEXT[appState]}
      </p>
    </section>
  );
}

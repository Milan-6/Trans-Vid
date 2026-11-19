import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";
import { useButtonPhysics, useCardTilt } from "../hooks/usePointerPhysics.js";

export function buildSummaryText(o) {
  const out = [];
  if (o.title) out.push(`# ${o.title}`);
  if (o.overview) out.push(`## Overview\n${o.overview}`);
  if (o.keyPoints.length) out.push(`## Key Points\n${o.keyPoints.map((p) => `- ${p}`).join("\n")}`);
  if (o.conclusion) out.push(`## Conclusion\n${o.conclusion}`);
  if (o.body) out.push(o.body);
  return out.join("\n\n");
}

function Section({ label, children }) {
  return (
    <section className="mt-7">
      <h3 className="font-mono text-[11px] tracking-[0.14em] text-cyan">{label}</h3>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

const actionBtn =
  "inline-flex h-11 items-center gap-2 rounded-xl border border-ice/20 px-4 text-sm font-semibold text-ice transition-colors hover:border-cyan/70 hover:text-cyan";

export default function OutputWindow({ output, pointerFx, reducedMotion }) {
  const card = useRef(null);
  const copyBtn = useRef(null);
  const docBtn = useRef(null);
  const timer = useRef(0);
  const [copyState, setCopyState] = useState("idle");
  const [showTranscript, setShowTranscript] = useState(false);

  useCardTilt(card, pointerFx);
  useButtonPhysics(copyBtn, { magnetic: pointerFx, press: !reducedMotion });
  useButtonPhysics(docBtn, { magnetic: pointerFx, press: !reducedMotion });

  useEffect(() => {
    card.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    return () => clearTimeout(timer.current);
  }, [reducedMotion]);

  const flash = (state) => {
    setCopyState(state);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState("idle"), 2200);
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText(output));
      flash("copied");
    } catch {
      flash("failed");
    }
  };

  const openDoc = () => window.open(output.docUrl, "_blank", "noopener,noreferrer");

  return (
    <article ref={card} aria-labelledby="output-title" className="surface tilt-card mt-8 scroll-mt-6 rounded-2xl p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 id="output-title" className="font-display-tight max-w-2xl font-display text-3xl font-normal leading-tight text-ice sm:text-4xl [text-wrap:balance]">
          {output.title || "Summary"}
        </h2>
        <div className="flex flex-wrap gap-2.5">
          <button ref={copyBtn} type="button" onClick={copySummary} className={actionBtn}>
            {copyState === "copied" ? <Check size={16} className="text-mint" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy blocked" : "Copy Summary"}
          </button>
          {output.docUrl && (
            <button ref={docBtn} type="button" onClick={openDoc} className={`${actionBtn} border-mint/50 text-mint hover:border-mint hover:text-ice`}>
              Open Google Doc ↗
              <span className="sr-only">(opens in a new tab)</span>
            </button>
          )}
        </div>
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] font-mono text-xs text-coral">
        {copyState === "failed" ? "The browser blocked clipboard access. Select the text and copy it manually." : ""}
      </p>

      {output.overview && (
        <Section label="OVERVIEW">
          <p className="max-w-[68ch] whitespace-pre-wrap text-base leading-[1.75] text-ice/85">{output.overview}</p>
        </Section>
      )}

      {output.keyPoints.length > 0 && (
        <Section label="KEY POINTS">
          <ul className="max-w-[68ch] space-y-3">
            {output.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-3 text-base leading-[1.7] text-ice/85">
                <span aria-hidden="true" className="mt-[0.8em] h-px w-3 shrink-0 bg-cyan" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {output.conclusion && (
        <Section label="CONCLUSION">
          <p className="max-w-[68ch] whitespace-pre-wrap text-base leading-[1.75] text-ice/85">{output.conclusion}</p>
        </Section>
      )}

      {output.body && (
        <Section label="SUMMARY">
          <p className="max-w-[68ch] whitespace-pre-wrap text-base leading-[1.75] text-ice/85">{output.body}</p>
        </Section>
      )}

      {output.transcript && (
        <section className="mt-8 border-t border-ice/12 pt-5">
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            aria-expanded={showTranscript}
            aria-controls="transcript-panel"
            className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left font-mono text-xs text-ice/80 hover:text-cyan"
          >
            <span>{showTranscript ? "Hide transcript" : "Show transcript"}</span>
            <ChevronDown size={18} aria-hidden="true" className={`transition-transform ${showTranscript ? "rotate-180" : ""}`} />
          </button>
          {showTranscript && (
            <div id="transcript-panel" tabIndex={0} role="region" aria-label="Transcript" className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-ice/10 bg-ink/60 p-4">
              <p className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-ice/80">{output.transcript}</p>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

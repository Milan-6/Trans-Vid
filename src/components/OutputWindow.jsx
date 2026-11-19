import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Mail,
  Sparkles,
} from "lucide-react";
import { useButtonPhysics, useCardTilt } from "../hooks/usePointerPhysics.js";

function parseInlineMarkdown(text) {
  const tokens = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  let lastIdx = 0;
  let match;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      tokens.push(
        <code
          key={key++}
          className="rounded border border-ice/10 bg-ink/70 px-1.5 py-0.5 font-mono text-xs text-cyan"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      tokens.push(
        <strong key={key++} className="font-semibold text-ice">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      tokens.push(
        <em key={key++} className="italic text-ice/90">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (linkMatch) {
        tokens.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-cyan underline underline-offset-2 hover:text-mint"
          >
            {linkMatch[1]}
            <ExternalLink size={12} className="inline opacity-70" aria-hidden="true" />
          </a>
        );
      } else {
        tokens.push(token);
      }
    }
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) {
    tokens.push(text.slice(lastIdx));
  }
  return tokens;
}

export function SafeMarkdown({ content }) {
  if (!content) return null;
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const elements = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let listBuffer = [];
  let listType = "ul";
  let key = 0;

  const flushList = () => {
    if (!listBuffer.length) return;
    const ListTag = listType === "ol" ? "ol" : "ul";
    elements.push(
      <ListTag
        key={key++}
        className={`my-3 space-y-1.5 pl-5 ${
          listType === "ol" ? "list-decimal" : "list-disc"
        } text-sm leading-relaxed text-ice/85 sm:text-base`}
      >
        {listBuffer.map((item, idx) => (
          <li key={idx}>{parseInlineMarkdown(item)}</li>
        ))}
      </ListTag>
    );
    listBuffer = [];
  };

  const flushCode = () => {
    if (!codeBuffer.length) return;
    elements.push(
      <pre
        key={key++}
        className="my-3 overflow-x-auto rounded-xl border border-ice/15 bg-ink/90 p-4 font-mono text-xs leading-relaxed text-ice/90"
      >
        <code>{codeBuffer.join("\n")}</code>
      </pre>
    );
    codeBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        flushCode();
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    const h4 = line.match(/^####\s+(.+)$/);

    if (h1 || h2 || h3 || h4) {
      flushList();
      if (h1) {
        elements.push(
          <h1 key={key++} className="mb-3 mt-6 font-display text-2xl font-normal text-ice">
            {parseInlineMarkdown(h1[1])}
          </h1>
        );
      } else if (h2) {
        elements.push(
          <h2 key={key++} className="mb-2 mt-5 font-display text-xl font-normal text-ice">
            {parseInlineMarkdown(h2[1])}
          </h2>
        );
      } else if (h3) {
        elements.push(
          <h3
            key={key++}
            className="mb-2 mt-4 font-mono text-xs font-semibold uppercase tracking-wider text-cyan"
          >
            {parseInlineMarkdown(h3[1])}
          </h3>
        );
      } else if (h4) {
        elements.push(
          <h4 key={key++} className="mb-1 mt-3 text-sm font-semibold text-mint">
            {parseInlineMarkdown(h4[1])}
          </h4>
        );
      }
      continue;
    }

    const ulMatch = line.match(/^\s*[-*•]\s+(.+)$/);
    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);

    if (ulMatch) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(ulMatch[1]);
      continue;
    }
    if (olMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(olMatch[1]);
      continue;
    }

    flushList();

    if (!line.trim()) continue;

    elements.push(
      <p key={key++} className="my-2.5 text-sm leading-[1.75] text-ice/85 sm:text-base">
        {parseInlineMarkdown(line)}
      </p>
    );
  }

  flushList();
  flushCode();

  return <div className="space-y-1">{elements}</div>;
}

export function buildFullReadableText(o) {
  if (!o) return "";
  if (o.rawText && typeof o.rawText === "string") return o.rawText;
  const out = [];
  if (o.title) out.push(`# ${o.title}`);
  if (o.overview) out.push(`## Overview\n${o.overview}`);
  if (o.keyPoints?.length) {
    out.push(`## Key Points\n${o.keyPoints.map((p) => `- ${p}`).join("\n")}`);
  }
  if (o.conclusion) out.push(`## Conclusion\n${o.conclusion}`);
  if (o.body) out.push(o.body);
  if (o.calendar?.confirmed) {
    out.push(
      `## Google Calendar Event Scheduled\nTitle: ${o.calendar.title || "Scheduled Event"}\nWhen: ${
        o.calendar.dateTime || "Confirmed"
      }`
    );
  }
  if (o.email?.confirmed) {
    out.push(
      `## Email Delivered\nRecipient: ${o.email.recipient || "Confirmed"}\nSubject: ${
        o.email.subject || ""
      }`
    );
  }
  if (o.docUrl) out.push(`Google Doc: ${o.docUrl}`);
  if (o.transcript) out.push(`\n## Transcript\n${o.transcript}`);
  return out.join("\n\n");
}

export function buildSummaryText(o) {
  return buildFullReadableText(o);
}

function Section({ label, children }) {
  return (
    <section className="mt-7">
      <h3 className="font-mono text-[11px] tracking-[0.14em] text-cyan">{label}</h3>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export default function OutputWindow({ output, pointerFx, reducedMotion }) {
  const card = useRef(null);
  const copyBtn = useRef(null);
  const docBtn = useRef(null);
  const downloadBtn = useRef(null);
  const timer = useRef(0);
  const [copyState, setCopyState] = useState("idle");
  const [showTranscript, setShowTranscript] = useState(false);

  useCardTilt(card, pointerFx);
  useButtonPhysics(copyBtn, { magnetic: pointerFx, press: !reducedMotion });
  useButtonPhysics(docBtn, { magnetic: pointerFx, press: !reducedMotion });
  useButtonPhysics(downloadBtn, { magnetic: pointerFx, press: !reducedMotion });

  useEffect(() => {
    card.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    return () => clearTimeout(timer.current);
  }, [reducedMotion]);

  const flash = (state) => {
    setCopyState(state);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState("idle"), 2200);
  };

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(buildFullReadableText(output));
      flash("copied");
    } catch {
      flash("failed");
    }
  };

  const openDoc = () => {
    if (output.docUrl) window.open(output.docUrl, "_blank", "noopener,noreferrer");
  };

  const downloadImage = async () => {
    if (!output.image?.url) return;
    try {
      const filename = "trans-vid-generated-image.png";
      if (output.image.url.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = output.image.url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      const res = await fetch(output.image.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error("Failed to download image", err);
    }
  };

  return (
    <article
      ref={card}
      aria-labelledby="output-title"
      className="surface tilt-card mt-8 scroll-mt-6 rounded-2xl p-5 sm:p-8"
    >
      {/* Header & Primary Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2
          id="output-title"
          className="font-display-tight font-display max-w-2xl text-2xl font-normal leading-tight text-ice [text-wrap:balance] sm:text-3xl"
        >
          {output.title || "Results & Intelligence"}
        </h2>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Copy Output Button */}
          <button
            ref={copyBtn}
            type="button"
            onClick={copyOutput}
            className="btn-3d btn-3d-outline inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm"
          >
            {copyState === "copied" ? (
              <Check size={16} className="text-mint" aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
              ? "Copy blocked"
              : "Copy Output"}
          </button>

          {/* Open Google Doc Button */}
          {output.docUrl && (
            <button
              ref={docBtn}
              type="button"
              onClick={openDoc}
              className="btn-3d btn-3d-mint inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm"
            >
              <FileText size={16} aria-hidden="true" />
              Open Google Doc ↗
              <span className="sr-only">(opens in a new tab)</span>
            </button>
          )}
        </div>
      </div>

      <p role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] font-mono text-xs text-coral">
        {copyState === "failed"
          ? "The browser blocked clipboard access. Select the text and copy it manually."
          : ""}
      </p>

      {/* Tool Confirmation Banners */}
      <div className="mt-4 flex flex-col gap-3">
        {/* Google Calendar Confirmation */}
        {output.calendar?.confirmed && (
          <div className="flex items-start gap-3 rounded-xl border border-cyan/35 bg-cyan/10 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/20 text-cyan">
              <Calendar size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-cyan">
                  Event Scheduled
                </span>
              </div>
              <p className="mt-1 font-semibold text-ice">{output.calendar.title}</p>
              {output.calendar.dateTime && (
                <p className="mt-0.5 font-mono text-xs text-ice/70">
                  {output.calendar.dateTime}
                </p>
              )}
              {output.calendar.link && (
                <a
                  href={output.calendar.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 font-mono text-xs text-cyan underline hover:text-mint"
                >
                  View in Google Calendar ↗
                </a>
              )}
            </div>
          </div>
        )}

        {/* Gmail Delivery Confirmation */}
        {output.email?.confirmed && (
          <div className="flex items-start gap-3 rounded-xl border border-mint/35 bg-mint/10 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mint/20 text-mint">
              <Mail size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-mint">
                Email Delivered
              </span>
              {output.email.recipient && (
                <p className="mt-1 text-sm text-ice">
                  <span className="font-mono text-xs text-ice/60">Sent to: </span>
                  {output.email.recipient}
                </p>
              )}
              {output.email.subject && (
                <p className="mt-0.5 text-sm text-ice/85">
                  <span className="font-mono text-xs text-ice/60">Subject: </span>
                  {output.email.subject}
                </p>
              )}
              {output.email.attachment && (
                <p className="mt-0.5 text-xs text-ice/70">
                  <span className="font-mono text-[11px] text-ice/50">Attachment: </span>
                  {output.email.attachment}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stability AI Image Generation Result */}
      {output.image?.url && (
        <section className="mt-7">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-[11px] tracking-[0.14em] text-cyan uppercase">
              Generated Image · Stability AI
            </h3>
            <button
              ref={downloadBtn}
              type="button"
              onClick={downloadImage}
              className="btn-3d btn-3d-mint inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs"
            >
              <Download size={14} aria-hidden="true" />
              Download Image
            </button>
          </div>

          <div className="mt-3 flex max-h-[500px] items-center justify-center overflow-hidden rounded-xl border border-ice/15 bg-ink/80 p-2 sm:p-3">
            <img
              src={output.image.url}
              alt={output.image.prompt || "Stability AI generated image"}
              className="max-h-[480px] w-auto max-w-full rounded-lg object-contain shadow-2xl"
              loading="lazy"
            />
          </div>

          {output.image.prompt && (
            <p className="mt-2 font-mono text-xs leading-relaxed text-ice/60">
              <span className="text-cyan">Prompt: </span>
              {output.image.prompt}
            </p>
          )}
        </section>
      )}

      {/* Structured Text & Safe Markdown Output */}
      {output.overview && (
        <Section label="OVERVIEW">
          <SafeMarkdown content={output.overview} />
        </Section>
      )}

      {output.keyPoints?.length > 0 && (
        <Section label="KEY POINTS">
          <ul className="max-w-[68ch] space-y-3">
            {output.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-3 text-base leading-[1.7] text-ice/85">
                <span aria-hidden="true" className="mt-[0.8em] h-px w-3 shrink-0 bg-cyan" />
                <span className="flex-1">{parseInlineMarkdown(point)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {output.conclusion && (
        <Section label="CONCLUSION">
          <SafeMarkdown content={output.conclusion} />
        </Section>
      )}

      {output.body && !output.overview && !output.keyPoints?.length && (
        <Section label="OUTPUT">
          <SafeMarkdown content={output.body} />
        </Section>
      )}

      {/* Collapsible Transcript */}
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
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`transition-transform ${showTranscript ? "rotate-180" : ""}`}
            />
          </button>
          {showTranscript && (
            <div
              id="transcript-panel"
              tabIndex={0}
              role="region"
              aria-label="Transcript"
              className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-ice/10 bg-ink/60 p-4"
            >
              <p className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-ice/80">
                {output.transcript}
              </p>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

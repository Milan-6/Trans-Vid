/**
 * Normalizes whatever the n8n workflow returns into:
 * { title, overview, keyPoints[], conclusion, body, transcript, docUrl }
 * Throws ResponseError on anything that is not a usable, successful result.
 * Nothing is ever invented: missing fields stay empty.
 */

export class ResponseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ResponseError";
    this.code = code; // empty | invalid-json | failed | no-summary | unsupported
  }
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v.trim() : "");
const looksJson = (s) => /^[[{]/.test(s);
const MAX_DEPTH = 6;
const NO_SUMMARY = () => new ResponseError("no-summary", "The response did not contain a usable summary.");

const SUMMARY_KEYS = ["summary", "output", "text", "result", "content", "response"];
const WRAPPER_KEYS = ["json", "data", "body", "payload", "result"];
const TRANSCRIPT_KEYS = ["transcript", "transcription", "transcript_text", "transcriptText"];
const DOC_URL_KEYS = ["googleDocUrl", "googleDocURL", "google_doc_url", "documentUrl", "document_url", "docUrl", "docURL"];

const SECTION_PATTERNS = {
  overview: /^(overview|summary|tl;?\s?dr|abstract|introduction)$/i,
  keyPoints: /^(key\s*(points|takeaways|insights|highlights)|main\s*points|highlights|takeaways)$/i,
  conclusion: /^(conclusion|final\s*thoughts|closing\s*thoughts|wrap[- ]?up)$/i,
};
const classifyHeading = (text) =>
  Object.keys(SECTION_PATTERNS).find((k) => SECTION_PATTERNS[k].test(text)) || null;

// ---------- Google Docs URL ----------

const DOC_URL_RE = /https:\/\/docs\.google\.com\/document\/d\/[A-Za-z0-9_-]+[^\s"'<>)\]\\]*/g;

export function validateGoogleDocUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value.trim().replace(/[.,;:!?]+$/, ""));
    if (u.protocol !== "https:" || u.hostname !== "docs.google.com") return null;
    if (!/^\/document\/d\/[A-Za-z0-9_-]+/.test(u.pathname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

function findDocUrlInText(text) {
  if (typeof text !== "string") return null;
  const matches = text.replace(/\\\//g, "/").match(DOC_URL_RE) || [];
  for (const m of matches) {
    const ok = validateGoogleDocUrl(m);
    if (ok) return ok;
  }
  return null;
}

// ---------- Summary pieces ----------

const emptyParts = () => ({ title: "", overview: "", keyPoints: [], conclusion: "", body: "" });
const hasContent = (p) => Boolean(p.overview || p.keyPoints.length || p.conclusion || p.body);
const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;

function toList(value) {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : isObj(v) ? v.text || v.point || v.description || v.content : ""))
      .map((v) => str(v))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((l) => l.replace(BULLET_RE, "$1").trim())
      .filter(Boolean);
  }
  return [];
}

/** `inner` = the object IS the summary (so `summary`/`description` are overview aliases). */
function summaryFromObject(o, inner = false) {
  return {
    title: str(o.title),
    overview: str(o.overview) || (inner ? str(o.description) || str(o.summary) : ""),
    keyPoints: toList(o.key_points ?? o.keyPoints ?? o.keypoints ?? o.points ?? o.key_takeaways ?? o.keyTakeaways),
    conclusion: str(o.conclusion),
    body: "",
  };
}

const cleanHeading = (t) => t.replace(/\*+/g, "").replace(/:\s*$/, "").trim();
function asHeading(line) {
  let m = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
  if (m) return { level: m[1].length, text: cleanHeading(m[2]) };
  m = line.match(/^\s*\*\*(.+?)\*\*\s*:?\s*$/);
  if (m) return { level: 3, text: cleanHeading(m[1]) };
  m = line.match(/^\s*([A-Za-z][A-Za-z ;/-]{2,30}):\s*$/);
  if (m && classifyHeading(cleanHeading(m[1]))) return { level: 3, text: cleanHeading(m[1]) };
  return null;
}

/** Conservative Markdown parser: falls back to a single body if unsure. */
function parseMarkdown(text) {
  const original = text.trim();
  const lines = original.replace(/\r\n?/g, "\n").split("\n");
  const sections = { overview: [], keyPoints: [], conclusion: [] };
  let title = "";
  let current = null;
  let sawKnown = false;
  let sawUnknown = false;
  let seenHeading = false;
  let preamble = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (current === "overview" || current === "conclusion") sections[current].push("");
      continue;
    }
    const h = asHeading(line);
    if (h) {
      const kind = classifyHeading(h.text);
      if (kind) {
        current = kind;
        sawKnown = true;
      } else if (!title && !seenHeading && !preamble) {
        title = h.text;
        current = null;
      } else {
        sawUnknown = true;
      }
      seenHeading = true;
      continue;
    }
    if (!current) {
      preamble = true;
      continue;
    }
    if (current === "keyPoints") {
      const b = line.match(BULLET_RE);
      if (b) sections.keyPoints.push(b[1].trim());
      else if (/^\s+\S/.test(line) && sections.keyPoints.length) {
        sections.keyPoints[sections.keyPoints.length - 1] += " " + line.trim();
      } else sections.keyPoints.push(line.trim());
    } else {
      sections[current].push(line.trim());
    }
  }

  if (!sawKnown || sawUnknown || preamble) return { ...emptyParts(), body: original };
  return {
    title,
    overview: sections.overview.join("\n").trim(),
    keyPoints: sections.keyPoints,
    conclusion: sections.conclusion.join("\n").trim(),
    body: "",
  };
}

function summaryFromValue(value, chain, depth) {
  if (depth > MAX_DEPTH) throw new ResponseError("unsupported", "The response is nested too deeply to read.");

  if (typeof value === "string") {
    const t = value.trim();
    if (looksJson(t)) {
      try {
        return summaryFromValue(JSON.parse(t), chain, depth + 1);
      } catch (e) {
        if (e instanceof ResponseError) throw e;
      }
    }
    return { parts: parseMarkdown(t), extras: {} };
  }

  if (Array.isArray(value)) {
    const strings = value.filter((v) => typeof v === "string" && v.trim());
    if (strings.length && strings.length === value.length) {
      return { parts: { ...emptyParts(), body: strings.map((s) => s.trim()).join("\n") }, extras: {} };
    }
    for (const item of value) {
      try {
        return summaryFromValue(item, chain, depth + 1);
      } catch (e) {
        if (!(e instanceof ResponseError)) throw e;
      }
    }
    throw NO_SUMMARY();
  }

  if (isObj(value)) {
    const parts = summaryFromObject(value, true);
    if (hasContent(parts)) return { parts, extras: {} };
    const nested = normalize(value, chain, depth + 1);
    const { transcript, docUrl, ...rest } = nested;
    return { parts: rest, extras: { transcript, docUrl } };
  }
  throw NO_SUMMARY();
}

// ---------- Payload handling ----------

function pickSummaryValue(node) {
  for (const key of SUMMARY_KEYS) {
    const v = node[key];
    if (typeof v === "string" && v.trim()) return v;
    if (Array.isArray(v) && v.length) return v;
    if (isObj(v) && Object.keys(v).length) return v;
  }
  return undefined;
}

function assertNotFailed(node) {
  const flag = node.success;
  const status = typeof node.status === "string" ? node.status.toLowerCase() : "";
  const failed =
    flag === false ||
    (typeof flag === "string" && flag.toLowerCase() === "false") ||
    ["error", "failed", "failure"].includes(status);
  const err = node.error;
  const msg = str(node.message) || str(err) || (isObj(err) ? str(err.message) : "");
  if (failed || (err && pickSummaryValue(node) === undefined)) {
    throw new ResponseError(
      "failed",
      msg ? `The workflow reported a failure: ${msg}` : "The workflow reported that the run was unsuccessful."
    );
  }
}

function findInChain(chain, keys) {
  for (const obj of chain) {
    if (!isObj(obj)) continue;
    for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function transcriptFrom(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((s) => (typeof s === "string" ? s : isObj(s) ? str(s.text) : ""))
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n");
  }
  if (isObj(value)) return str(value.text) || str(value.transcript);
  return "";
}

/** Returns a full result, or null if `node` holds no summary itself. */
function build(node, chain, depth) {
  let found = null;
  if (isObj(node)) {
    const direct = summaryFromObject(node);
    const value = pickSummaryValue(node);
    if (hasContent(direct)) found = { parts: direct, extras: {} };
    else if (value !== undefined) found = summaryFromValue(value, chain, depth);
  } else {
    found = summaryFromValue(node, chain, depth);
  }
  if (!found) return null;

  const { parts, extras } = found;
  if (!parts.title && isObj(node)) parts.title = str(node.title);
  if (!hasContent(parts)) throw NO_SUMMARY();

  const transcript = transcriptFrom(findInChain(chain, TRANSCRIPT_KEYS)) || extras.transcript || "";

  let docUrl = null;
  for (const obj of chain) {
    if (!isObj(obj)) continue;
    for (const k of DOC_URL_KEYS) {
      docUrl = validateGoogleDocUrl(obj[k]);
      if (docUrl) break;
    }
    if (docUrl) break;
  }
  docUrl =
    docUrl ||
    extras.docUrl ||
    findDocUrlInText([parts.overview, parts.conclusion, parts.body, ...parts.keyPoints].join("\n"));

  return { ...parts, transcript, docUrl: docUrl || null };
}

function normalize(node, ancestors, depth) {
  if (depth > MAX_DEPTH) throw new ResponseError("unsupported", "The response is nested too deeply to read.");

  if (Array.isArray(node)) {
    if (!node.length) throw new ResponseError("empty", "The webhook returned an empty list.");
    let lastErr;
    for (const item of node) {
      try {
        return normalize(item, ancestors, depth + 1);
      } catch (e) {
        if (!(e instanceof ResponseError) || e.code === "failed") throw e;
        lastErr = e;
      }
    }
    throw lastErr;
  }

  if (typeof node === "string") {
    const t = node.trim();
    if (!t) throw NO_SUMMARY();
    if (looksJson(t)) {
      try {
        return normalize(JSON.parse(t), ancestors, depth + 1);
      } catch (e) {
        if (e instanceof ResponseError) throw e;
      }
    }
    return build(t, ancestors, depth);
  }

  if (isObj(node)) {
    assertNotFailed(node);
    const chain = [node, ...ancestors];
    const result = build(node, chain, depth);
    if (result) return result;
    for (const key of WRAPPER_KEYS) {
      if (node[key] === undefined || node[key] === null) continue;
      try {
        return normalize(node[key], chain, depth + 1);
      } catch (e) {
        if (!(e instanceof ResponseError) || e.code === "failed") throw e;
      }
    }
    throw NO_SUMMARY();
  }

  throw new ResponseError("unsupported", "The response format is not supported.");
}

/** @param {{text: string, contentType?: string}} response */
export function parseWebhookResponse({ text, contentType = "" } = {}) {
  const body = typeof text === "string" ? text.trim() : "";
  if (!body) throw new ResponseError("empty", "The webhook returned an empty response.");

  let data = body;
  const declaredJson = /json/i.test(contentType);
  if (looksJson(body) || declaredJson) {
    try {
      data = JSON.parse(body);
    } catch {
      if (declaredJson) throw new ResponseError("invalid-json", "The webhook declared JSON but returned invalid JSON.");
      data = body;
    }
  }

  const result = normalize(data, [], 0);
  if (!result.docUrl) result.docUrl = findDocUrlInText(body);
  return result;
}

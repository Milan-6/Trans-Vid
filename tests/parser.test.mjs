import assert from "node:assert/strict";
import { parseWebhookResponse, ResponseError } from "../src/services/responseParser.js";
import { submitMediaUrl, WebhookError } from "../src/services/webhookService.js";
import { DEFAULT_PROMPT } from "../src/config/constants.js";
import http from "node:http";

const DOC = "https://docs.google.com/document/d/1AbC_dEf-123/edit";
const json = (o) => ({ text: JSON.stringify(o), contentType: "application/json" });
const txt = (t) => ({ text: t, contentType: "text/plain" });
const fails = (input, code) => {
  try { parseWebhookResponse(input); } catch (e) {
    assert.ok(e instanceof ResponseError, `expected ResponseError, got ${e}`);
    if (code) assert.equal(e.code, code);
    return;
  }
  assert.fail("expected failure");
};
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("preferred structured JSON", () => {
  const r = parseWebhookResponse(json({ success: true, summary: { title: "T", overview: "O", key_points: ["a", "b"], conclusion: "C" }, transcript: "hello", googleDocUrl: DOC }));
  assert.deepEqual([r.title, r.overview, r.keyPoints, r.conclusion, r.transcript, r.docUrl], ["T", "O", ["a", "b"], "C", "hello", DOC]);
});
t("array-wrapped", () => {
  const r = parseWebhookResponse(json([{ summary: { overview: "O", key_points: ["x"] }, documentUrl: DOC }]));
  assert.equal(r.overview, "O"); assert.equal(r.docUrl, DOC);
});
t("LangChain output with markdown", () => {
  const md = `# My Title\n\n## Overview\nLine one.\n\n## Key Points\n- first\n- second\n  continued\n\n## Conclusion\nDone. ${DOC}`;
  const r = parseWebhookResponse(json([{ output: md }]));
  assert.equal(r.title, "My Title"); assert.equal(r.overview, "Line one.");
  assert.deepEqual(r.keyPoints, ["first", "second continued"]); assert.ok(r.conclusion.startsWith("Done."));
  assert.equal(r.docUrl, DOC);
});
t("LangChain text field + bold headings", () => {
  const r = parseWebhookResponse(json({ text: "**Overview**\nAbout it\n**Key Points**\n* one\n* two\n**Conclusion**\nEnd" }));
  assert.deepEqual(r.keyPoints, ["one", "two"]); assert.equal(r.title, "");
});
t("plain string summary", () => {
  const r = parseWebhookResponse(json({ summary: "Just a paragraph." }));
  assert.equal(r.body, "Just a paragraph."); assert.equal(r.overview, ""); assert.equal(r.title, "");
});
t("plain text response, unstructured markdown stays whole", () => {
  const r = parseWebhookResponse(txt("Intro text\n## Random Heading\nstuff"));
  assert.equal(r.body, "Intro text\n## Random Heading\nstuff");
});
t("JSON string inside output", () => {
  const r = parseWebhookResponse(json({ output: JSON.stringify({ title: "Z", overview: "O" }) }));
  assert.equal(r.title, "Z");
});
t("doc URL embedded in plain text", () => {
  const r = parseWebhookResponse(txt(`Summary text.\nDoc: ${DOC}.`));
  assert.equal(r.docUrl, DOC);
});
t("non-google doc URL is rejected", () => {
  const r = parseWebhookResponse(json({ summary: "x", googleDocUrl: "https://evil.example/document/d/abc" }));
  assert.equal(r.docUrl, null);
});
t("nested data wrapper + transcript segments", () => {
  const r = parseWebhookResponse(json({ data: { summary: { overview: "O" } }, transcript: [{ text: "a" }, { text: "b" }] }));
  assert.equal(r.overview, "O"); assert.equal(r.transcript, "a\nb");
});
t("structured image response", () => {
  const r = parseWebhookResponse(json({ summary: "City image generated", image: { url: "https://example.com/city.png", prompt: "futuristic city" } }));
  assert.equal(r.image?.url, "https://example.com/city.png");
  assert.equal(r.image?.prompt, "futuristic city");
});
t("calendar event confirmation in text", () => {
  const r = parseWebhookResponse(txt("Event created: AI Study Session\nDate: Tomorrow at 10 AM\nhttps://calendar.google.com/event?id=123"));
  assert.equal(r.calendar?.confirmed, true);
  assert.equal(r.calendar?.title, "AI Study Session");
});
t("gmail confirmation in text", () => {
  const r = parseWebhookResponse(txt("Email successfully delivered\nSent to: user@example.com\nSubject: Your Study Plan"));
  assert.equal(r.email?.confirmed, true);
  assert.equal(r.email?.recipient, "user@example.com");
  assert.equal(r.email?.subject, "Your Study Plan");
});
t("failures", () => {
  fails(txt("   "), "empty");
  fails({ text: "{bad", contentType: "application/json" }, "invalid-json");
  fails(json({ success: false, message: "boom" }), "failed");
  fails(json({ success: true }), "no-summary");
  fails(json({ success: true, transcript: "only transcript" }), "no-summary");
  fails(json([]), "empty");
  fails(json({ summary: { title: "only a title" } }), "no-summary");
});

// ---- service: real HTTP against a local server (test harness only) ----
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.url === "/ok") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ echoed: JSON.parse(body), method: req.method, ct: req.headers["content-type"] })); }
    if (req.url === "/500") { res.statusCode = 500; return res.end("server broke"); }
    if (req.url === "/slow") return; // never responds
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const kind = async (p) => { try { await p; return "none"; } catch (e) { assert.ok(e instanceof WebhookError); return e.kind; } };

const ok = await submitMediaUrl("https://x.test/v", { endpoint: base + "/ok" });
const echoed = JSON.parse(ok.text);
assert.deepEqual([echoed.echoed, echoed.method, echoed.ct], [{ url: "https://x.test/v", prompt: DEFAULT_PROMPT }, "POST", "application/json"]); n++; console.log("ok - POST contract (default prompt)");

const okCustom = await submitMediaUrl("https://x.test/v", { endpoint: base + "/ok", prompt: "  Custom AI task instruction  " });
const echoedCustom = JSON.parse(okCustom.text);
assert.equal(echoedCustom.echoed.prompt, "Custom AI task instruction"); n++; console.log("ok - POST contract (custom prompt trimmed)");

const okWhitespace = await submitMediaUrl("https://x.test/v", { endpoint: base + "/ok", prompt: "   " });
const echoedWhitespace = JSON.parse(okWhitespace.text);
assert.equal(echoedWhitespace.echoed.prompt, DEFAULT_PROMPT); n++; console.log("ok - POST contract (whitespace falls back to default)");

assert.equal(await kind(submitMediaUrl("u", { endpoint: base + "/500" })), "http"); n++; console.log("ok - HTTP error");
assert.equal(await kind(submitMediaUrl("u", { endpoint: base + "/slow", timeoutMs: 150 })), "timeout"); n++; console.log("ok - timeout");
const ac = new AbortController(); setTimeout(() => ac.abort(), 50);
assert.equal(await kind(submitMediaUrl("u", { endpoint: base + "/slow", signal: ac.signal })), "aborted"); n++; console.log("ok - abort");
assert.equal(await kind(submitMediaUrl("u", { endpoint: "http://127.0.0.1:1/x" })), "network"); n++; console.log("ok - network failure");
server.close(); server.closeAllConnections?.();
console.log(`\n${n} checks passed`);

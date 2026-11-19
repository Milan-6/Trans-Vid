import { WEBHOOK_URL, REQUEST_TIMEOUT_MS, DEFAULT_PROMPT } from "../config/constants.js";

/** kind: "timeout" | "network" | "http" | "aborted" */
export class WebhookError extends Error {
  constructor(kind, message, details = {}) {
    super(message);
    this.name = "WebhookError";
    this.kind = kind;
    Object.assign(this, details);
  }
}

/**
 * POSTs { url, prompt } to the n8n webhook. Never retries (a retry could trigger a
 * second backend execution). Resolves with the raw response text; parsing is
 * the responsibility of responseParser.js.
 */
export async function submitMediaUrl(
  mediaUrl,
  { signal, timeoutMs = REQUEST_TIMEOUT_MS, endpoint = WEBHOOK_URL, prompt } = {}
) {
  const controller = new AbortController();
  let timedOut = false;

  if (signal?.aborted) {
    throw new WebhookError("aborted", "The request was cancelled.");
  }
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const classify = (err) => {
    if (timedOut) {
      return new WebhookError(
        "timeout",
        `No response within ${Math.round(timeoutMs / 1000)} seconds.`
      );
    }
    if (controller.signal.aborted) {
      return new WebhookError("aborted", "The request was cancelled.");
    }
    return new WebhookError("network", "Could not reach the webhook.", {
      cause: err,
    });
  };

  try {
    let response;
    const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : "";
    const effectivePrompt = trimmedPrompt || DEFAULT_PROMPT;
    const trimmedUrl = typeof mediaUrl === "string" ? mediaUrl.trim() : "";
    const payload = {
      prompt: effectivePrompt,
      url: trimmedUrl,
    };

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      throw classify(err);
    }

    let text;
    try {
      text = await response.text();
    } catch (err) {
      throw classify(err);
    }

    if (!response.ok) {
      throw new WebhookError(
        "http",
        `The webhook responded with HTTP ${response.status}.`,
        { status: response.status, bodySnippet: text.slice(0, 300) }
      );
    }

    return {
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      text,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

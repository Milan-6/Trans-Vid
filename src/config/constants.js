export const WEBHOOK_URL =
  "https://jacket-stud-classical-organize.trycloudflare.com/webhook-test/a4630b92-b33f-45ab-bf23-6b6d7f9a275a";

export const REQUEST_TIMEOUT_MS = 180000;

export const PALETTE = {
  cyan: "#51E2F5",
  mint: "#9DF9EF",
  ice: "#EDF7F6",
  coral: "#FFA8B6",
  mauve: "#A28089",
};

export const INK = "#080e11";

export const APP_STATES = {
  IDLE: "idle",
  VALIDATING: "validating",
  PROCESSING: "processing",
  COMPLETED: "completed",
  ERROR: "error",
};

export const PROCESSING_MESSAGE =
  "Executing n8n pipeline — downloading, transcribing & syncing Doc...";

export const PIPELINE_STAGES = [
  { id: "fetch", title: "Downloading Media", detail: "Media Fetch" },
  { id: "transcribe", title: "Transcribing Audio", detail: "Whisper Large v3" },
  {
    id: "summarize",
    title: "Summarizing & Syncing Google Doc",
    detail: "Gemini 3.5 Flash Lite",
  },
];

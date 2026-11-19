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

export const DEFAULT_PROMPT =
  "Transcribe and summarize the provided media. Produce a clear, well-structured summary containing the main ideas, important points and key takeaways. Save the completed summary to a Google Doc and return the document link.";

export const PROMPT_PRESETS = [
  {
    id: "calendar-email",
    label: "Study Schedule + Email",
    prompt:
      "Create a 3-day AI security study schedule on Google Calendar and email me the plan.",
  },
  {
    id: "summary-doc-image",
    label: "Summarize + Docs + Cyberpunk Image",
    prompt:
      "Summarize this video, save the summary to Google Docs and generate a cyberpunk cover image.",
  },
  {
    id: "image-email",
    label: "Futuristic City Image + Email",
    prompt:
      "Create an image of a futuristic city and email it to me.",
  },
];

export const PIPELINE_STAGES_MEDIA = [
  { id: "fetch", title: "Getting your video", detail: "Media Fetch" },
  { id: "transcribe", title: "Transcribing the audio", detail: "Whisper Large v3" },
  {
    id: "process",
    title: "Understanding your request and completing tasks",
    detail: "Gemini AI & Tools",
  },
  { id: "prepare", title: "Preparing your results", detail: "Workspace Sync" },
];

export const PIPELINE_STAGES_NO_MEDIA = [
  {
    id: "understand",
    title: "Understanding your request",
    detail: "Gemini AI",
  },
  {
    id: "execute",
    title: "Completing your requested tasks",
    detail: "Multi-tool Execution",
  },
  { id: "prepare", title: "Preparing your results", detail: "Workspace Sync" },
];

// Fallback for legacy imports
export const PIPELINE_STAGES = PIPELINE_STAGES_MEDIA;

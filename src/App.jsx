import { useCallback, useEffect, useRef, useState } from "react";
import WebGLCanvas from "./components/WebGLCanvas.jsx";
import CustomCursor from "./components/CustomCursor.jsx";
import HeroHeader from "./components/HeroHeader.jsx";
import UrlConsole from "./components/UrlConsole.jsx";
import PipelineTracker from "./components/PipelineTracker.jsx";
import OutputWindow from "./components/OutputWindow.jsx";
import { submitMediaUrl, WebhookError } from "./services/webhookService.js";
import { parseWebhookResponse, ResponseError } from "./services/responseParser.js";
import { useReducedMotion } from "./hooks/useReducedMotion.js";
import { useFinePointer } from "./hooks/usePointerPhysics.js";
import { APP_STATES, REQUEST_TIMEOUT_MS } from "./config/constants.js";

function describeError(err) {
  if (err instanceof WebhookError) {
    switch (err.kind) {
      case "timeout":
        return `The pipeline did not respond within ${REQUEST_TIMEOUT_MS / 60000} minutes. The workflow may still be running in n8n, so check its executions before running it again.`;
      case "http": {
        const detail = err.bodySnippet ? ` Server said: ${err.bodySnippet.replace(/\s+/g, " ").slice(0, 160)}` : "";
        return `${err.message}${detail}`;
      }
      case "network":
        return "Could not reach the webhook. Check your connection. If you're online, the n8n server may be blocking this origin (CORS) or be offline.";
      default:
        return err.message;
    }
  }
  if (err instanceof ResponseError) return `The webhook replied, but the result couldn't be used. ${err.message}`;
  return "Something unexpected went wrong while running the pipeline.";
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export default function App() {
  const reducedMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const pointerFx = finePointer && !reducedMotion;

  const [appState, setAppState] = useState(APP_STATES.IDLE);
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [promptError, setPromptError] = useState("");
  const [urlError, setUrlError] = useState("");
  const [message, setMessage] = useState("");
  const [output, setOutput] = useState(null);
  const [hasMedia, setHasMedia] = useState(false);

  const busyRef = useRef(false);
  const activeRequestId = useRef(0);
  const controllerRef = useRef(null);

  useEffect(() => () => {
    activeRequestId.current += 1; // invalidate any in-flight response
    controllerRef.current?.abort();
  }, []);

  const handlePromptChange = useCallback((value) => {
    setPrompt(value);
    setPromptError("");
  }, []);

  const handleUrlChange = useCallback((value) => {
    setUrl(value);
    setUrlError("");
  }, []);

  const run = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const id = ++activeRequestId.current;

    // Reset previous errors and outputs
    setPromptError("");
    setUrlError("");
    setOutput(null);
    setMessage("");

    // Validate inputs
    const trimmedPrompt = (prompt || "").trim();
    const trimmedUrl = (url || "").trim();

    let pErr = "";
    let uErr = "";

    if (!trimmedPrompt) {
      pErr = "Please enter a task prompt describing what you want me to do.";
    }

    if (trimmedUrl) {
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          uErr = `Only http: and https: links are supported (this one uses ${parsed.protocol}).`;
        }
      } catch {
        uErr = "That isn't a valid URL. Include the full address, for example https://example.com/video.";
      }
    }

    if (pErr || uErr) {
      setPromptError(pErr);
      setUrlError(uErr);
      setAppState(APP_STATES.ERROR);
      busyRef.current = false;
      return;
    }

    const currentHasMedia = Boolean(trimmedUrl);
    setHasMedia(currentHasMedia);

    setAppState(APP_STATES.VALIDATING);
    await nextFrame();
    if (id !== activeRequestId.current) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    setAppState(APP_STATES.PROCESSING);

    try {
      const raw = await submitMediaUrl(trimmedUrl, {
        signal: controller.signal,
        prompt: trimmedPrompt,
      });
      if (id !== activeRequestId.current) return;
      const result = parseWebhookResponse(raw);
      setOutput(result);
      setAppState(APP_STATES.COMPLETED);
    } catch (err) {
      if (id !== activeRequestId.current) return;
      setMessage(describeError(err));
      setAppState(APP_STATES.ERROR);
    } finally {
      if (id === activeRequestId.current) busyRef.current = false;
    }
  }, [url, prompt]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <WebGLCanvas appState={appState} reducedMotion={reducedMotion} pointerFx={pointerFx} />
      <CustomCursor enabled={pointerFx} />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-20 pt-6 sm:px-8 sm:pt-8">
        <HeroHeader reducedMotion={reducedMotion} />
        <div className="mt-10 sm:mt-14">
          <UrlConsole
            value={url}
            onChange={handleUrlChange}
            prompt={prompt}
            onChangePrompt={handlePromptChange}
            promptError={promptError}
            urlError={urlError}
            onSubmit={run}
            appState={appState}
            message={message}
            pointerFx={pointerFx}
            reducedMotion={reducedMotion}
          />
          <PipelineTracker
            appState={appState}
            hasMedia={hasMedia}
            reducedMotion={reducedMotion}
          />
        </div>
        {output && appState === APP_STATES.COMPLETED && (
          <OutputWindow output={output} pointerFx={pointerFx} reducedMotion={reducedMotion} />
        )}
      </main>
    </div>
  );
}

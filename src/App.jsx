import { useCallback, useEffect, useRef, useState } from "react";
import WebGLCanvas from "./components/WebGLCanvas.jsx";
import CustomCursor from "./components/CustomCursor.jsx";
import HeroHeader from "./components/HeroHeader.jsx";
import UrlConsole, { validateMediaUrl } from "./components/UrlConsole.jsx";
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
  const [message, setMessage] = useState("");
  const [output, setOutput] = useState(null);

  const busyRef = useRef(false);
  const requestId = useRef(0);
  const controllerRef = useRef(null);

  useEffect(() => () => {
    requestId.current += 1; // invalidate any in-flight response
    controllerRef.current?.abort();
  }, []);

  const handleUrlChange = useCallback((value) => {
    setUrl(value);
    setMessage((m) => (m ? "" : m));
  }, []);

  const run = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const id = ++requestId.current;

    setOutput(null);
    setMessage("");
    setAppState(APP_STATES.VALIDATING);
    await nextFrame();
    if (id !== requestId.current) return;

    const check = validateMediaUrl(url);
    if (!check.ok) {
      setMessage(check.message);
      setAppState(APP_STATES.ERROR);
      busyRef.current = false;
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setAppState(APP_STATES.PROCESSING);

    try {
      const raw = await submitMediaUrl(check.url, { signal: controller.signal });
      if (id !== requestId.current) return;
      const result = parseWebhookResponse(raw);
      setOutput(result);
      setAppState(APP_STATES.COMPLETED);
    } catch (err) {
      if (id !== requestId.current) return;
      setMessage(describeError(err));
      setAppState(APP_STATES.ERROR);
    } finally {
      if (id === requestId.current) busyRef.current = false;
    }
  }, [url]);

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
            onSubmit={run}
            appState={appState}
            message={message}
            pointerFx={pointerFx}
            reducedMotion={reducedMotion}
          />
          <PipelineTracker appState={appState} reducedMotion={reducedMotion} />
        </div>
        {output && appState === APP_STATES.COMPLETED && (
          <OutputWindow output={output} pointerFx={pointerFx} reducedMotion={reducedMotion} />
        )}
      </main>
    </div>
  );
}

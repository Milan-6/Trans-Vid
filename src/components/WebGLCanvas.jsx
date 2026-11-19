import { useEffect, useRef, useState } from "react";
import { StudioScene } from "../three/StudioScene.js";
import { usePointerSpotlight } from "../hooks/usePointerPhysics.js";

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

/** CSS-only atmosphere used when WebGL is unavailable or fails. */
function FallbackBackdrop({ pointerFx }) {
  const ref = useRef(null);
  usePointerSpotlight(ref, pointerFx);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background: `
          radial-gradient(520px circle at var(--sx, 50%) var(--sy, 40%), rgba(237,247,246,0.07), transparent 60%),
          radial-gradient(900px 600px at 15% 85%, rgba(81,226,245,0.14), transparent 65%),
          radial-gradient(800px 500px at 85% 10%, rgba(255,168,182,0.10), transparent 65%),
          radial-gradient(900px 700px at 60% 60%, rgba(162,128,137,0.18), transparent 70%),
          #080e11`,
      }}
    />
  );
}

export default function WebGLCanvas({ appState, reducedMotion, pointerFx }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let scene = null;
    try {
      if (!webglAvailable()) throw new Error("WebGL unavailable");
      scene = new StudioScene(mountRef.current, { onContextLost: () => setFailed(true) });
      sceneRef.current = scene;
    } catch (err) {
      console.warn("WebGL scene disabled, using CSS fallback:", err);
      setFailed(true);
    }
    return () => {
      try { scene?.dispose(); } catch (err) { console.warn("Scene cleanup failed:", err); }
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => { sceneRef.current?.setAppState(appState); }, [appState, failed]);
  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
    sceneRef.current?.setPointerEnabled(pointerFx);
  }, [reducedMotion, pointerFx, failed]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <div ref={mountRef} className="absolute inset-0" />
      {failed && <FallbackBackdrop pointerFx={pointerFx} />}
    </div>
  );
}

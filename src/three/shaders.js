const COLORS = `uniform vec3 cCyan; uniform vec3 cMint; uniform vec3 cIce; uniform vec3 cCoral; uniform vec3 cMauve;`;

export const backgroundVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;

export const backgroundFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime; uniform float uAspect; uniform float uEnergy;
uniform float uCoralAmt; uniform float uMintAmt; uniform vec2 uPointer;
${COLORS}
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + vec2(17.1, 9.7); a *= 0.5; } return v; }
void main(){
  vec2 uv = vUv; vec2 p = (uv - 0.5) * vec2(uAspect, 1.0); float t = uTime * 0.06;
  float n = fbm(p * 1.6 + vec2(t, -t * 0.7));
  float n2 = fbm(p * 2.8 - vec2(t * 1.3, t) + n * 1.5);
  vec3 col = vec3(0.027, 0.05, 0.062);
  col += cMauve * 0.20 * smoothstep(0.35, 0.85, n);
  col += cCyan * 0.10 * smoothstep(0.4, 0.9, n2) * (1.0 - uv.y * 0.5);
  float coral = 0.12 + 0.55 * uCoralAmt;
  col += cCoral * 0.10 * coral * smoothstep(0.45, 0.95, fbm(p * 1.2 + vec2(5.0, t * 2.0))) * uv.y;
  col += cMint * 0.14 * uMintAmt * smoothstep(0.2, 0.9, n2);
  vec2 d = (uv - vec2(0.78, 1.15)) * vec2(uAspect, 1.0);
  float shafts = fbm(vec2(atan(d.y, d.x) * 5.0, t * 3.0)) * smoothstep(1.7, 0.0, length(d));
  col += mix(cIce, cCyan, 0.5) * shafts * 0.10 * (0.7 + 0.6 * uEnergy);
  vec2 pd = (uv - uPointer) * vec2(uAspect, 1.0);
  col += cIce * 0.06 * exp(-dot(pd, pd) * 7.0);
  col *= mix(0.55, 1.0, smoothstep(1.05, 0.25, length(p * vec2(0.9, 1.1))));
  col += (hash(uv * vec2(1920.0, 1080.0) + fract(uTime)) - 0.5) * 0.035;
  gl_FragColor = vec4(col, 1.0);
}
`;

// NOTE: waveY must stay in sync with waveHeight() in StudioScene.js (nodes ride the ribbon).
export const ribbonVertex = /* glsl */ `
uniform float uTime; uniform float uEnergy; uniform float uExpand; uniform float uLayer; uniform vec3 uRipple;
varying vec2 vUv; varying float vRip;
float waveY(float x, float t, float e, float layer){
  float env = 0.35 + 0.65 * (1.0 - pow(abs(x) / 3.4, 2.0));
  return 0.6 * env * ((0.32 + 0.55 * e) * sin(x * 1.4 + t * 0.9 + layer * 1.7)
    + (0.12 + 0.5 * e) * sin(x * 3.1 - t * 1.6 + layer * 2.3) + 0.06 * e * sin(x * 7.0 + t * 3.0));
}
void main(){
  vUv = uv; vec3 p = position;
  float w = (1.0 + uExpand * 0.6) * (0.9 + 0.1 * uLayer);
  float a = p.x * 0.9 + uTime * 0.35 + uLayer * 1.3;
  float v = p.y * w;
  p.y = waveY(p.x, uTime, uEnergy, uLayer) + v * (0.35 + 0.65 * cos(a));
  p.z = v * sin(a) * 1.1;
  vec2 dd = (uv - uRipple.xy) * vec2(6.8, 1.0);
  float d = length(dd);
  float rip = uRipple.z * sin(d * 9.0 - uTime * 6.0) * exp(-d * 1.4);
  p.z += rip * 0.35; p.y += rip * 0.25; vRip = abs(rip);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const ribbonFragment = /* glsl */ `
precision highp float;
varying vec2 vUv; varying float vRip;
uniform float uTime; uniform float uEnergy; uniform float uCoralAmt; uniform float uMintAmt; uniform float uAlpha; uniform float uLayer;
${COLORS}
void main(){
  float across = abs(vUv.y - 0.5) * 2.0;
  float edge = smoothstep(1.0, 0.82, across);
  float line = smoothstep(0.12, 0.0, abs(across - 0.86));
  float flow = 0.5 + 0.5 * sin(vUv.x * 22.0 - uTime * (1.2 + 2.6 * uEnergy) + uLayer * 2.0);
  float flow2 = 0.5 + 0.5 * sin(vUv.x * 47.0 + uTime * (0.8 + 1.5 * uEnergy));
  vec3 base = mix(cMauve, cCyan, smoothstep(0.0, 0.6, vUv.x));
  base = mix(base, cIce, smoothstep(0.55, 1.0, vUv.x) * 0.55);
  float pulse = 0.5 + 0.5 * sin(uTime * (2.0 + 3.0 * uEnergy) - vUv.x * 9.0);
  base = mix(base, cCoral, uCoralAmt * (0.55 + 0.45 * pulse));
  base = mix(base, cMint, uMintAmt * 0.7);
  float ends = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  float a = (0.10 + 0.30 * flow * flow2 * (0.6 + uEnergy) + 0.55 * line + vRip * 0.4) * edge * ends * uAlpha;
  gl_FragColor = vec4(base * (1.0 + 0.5 * flow), a);
}
`;

export const particleVertex = /* glsl */ `
attribute float aSeed; attribute vec3 aColor;
uniform float uSize; uniform float uEnergy; uniform float uTime;
varying vec3 vColor; varying float vA;
void main(){
  vColor = aColor; vA = 0.4 + 0.6 * fract(aSeed * 7.3 + uTime * 0.1);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (0.6 + aSeed) * (1.0 + 0.6 * uEnergy) * (6.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

export const particleFragment = /* glsl */ `
precision highp float;
varying vec3 vColor; varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

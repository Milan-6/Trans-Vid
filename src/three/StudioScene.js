import * as THREE from "three";
import { PALETTE, APP_STATES } from "../config/constants.js";
import {
  backgroundVertex, backgroundFragment, ribbonVertex, ribbonFragment,
  particleVertex, particleFragment,
} from "./shaders.js";

const RIBBON_LENGTH = 6.8;
const HALF = RIBBON_LENGTH / 2;
const NODE_X = [-2.4, -0.8, 0.8, 2.4];

// Mirrors waveY() in the ribbon vertex shader.
function waveHeight(x, t, e, layer) {
  const env = 0.35 + 0.65 * (1 - Math.pow(Math.abs(x) / 3.4, 2));
  return 0.6 * env * ((0.32 + 0.55 * e) * Math.sin(x * 1.4 + t * 0.9 + layer * 1.7)
    + (0.12 + 0.5 * e) * Math.sin(x * 3.1 - t * 1.6 + layer * 2.3) + 0.06 * e * Math.sin(x * 7 + t * 3));
}

// Shader uniforms bypass colour management, so pass raw sRGB components.
const rawColor = (hex) => {
  const c = new THREE.Color(hex);
  c.convertLinearToSRGB();
  return new THREE.Vector3(c.r, c.g, c.b);
};
const paletteUniforms = () => ({
  cCyan: { value: rawColor(PALETTE.cyan) }, cMint: { value: rawColor(PALETTE.mint) },
  cIce: { value: rawColor(PALETTE.ice) }, cCoral: { value: rawColor(PALETTE.coral) },
  cMauve: { value: rawColor(PALETTE.mauve) },
});

const TARGETS = {
  [APP_STATES.IDLE]: { energy: 0.25, coral: 0, mint: 0 },
  [APP_STATES.VALIDATING]: { energy: 0.5, coral: 0.3, mint: 0 },
  [APP_STATES.PROCESSING]: { energy: 1.0, coral: 1, mint: 0 },
  [APP_STATES.COMPLETED]: { energy: 0.18, coral: 0, mint: 1 },
  [APP_STATES.ERROR]: { energy: 0.7, coral: 1, mint: 0 },
};

export class StudioScene {
  constructor(container, { onContextLost } = {}) {
    this.container = container;
    this.onContextLost = onContextLost;
    this.isMobile = window.matchMedia("(max-width: 767px)").matches || window.matchMedia("(pointer: coarse)").matches;

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isMobile, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x080e11, 1);
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = "display:block;width:100%;height:100%";
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    this.camera.position.set(0, 0, 7);

    this.time = 0;
    this.timeScale = 1;
    this.appState = APP_STATES.IDLE;
    this.target = { ...TARGETS.idle };
    this.cur = { ...TARGETS.idle };
    this.expand = 0;
    this.errorTimer = null;
    this.reduced = false;
    this.pointerEnabled = true;
    this.pointer = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, inside: false };
    this.ripple = new THREE.Vector3(0.5, 0.5, 0);
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.hit = new THREE.Vector3();
    this.nodeColor = new THREE.Color(PALETTE.cyan);
    this.disposed = false;
    this.raf = 0;

    this._buildBackground();
    this._buildRibbon();
    this._buildNodes();
    this._buildParticles();

    this._onResize = () => this.resize();
    this._onPointer = (e) => {
      this.pointer.x = e.clientX / window.innerWidth;
      this.pointer.y = e.clientY / window.innerHeight;
      this.pointer.inside = true;
    };
    this._onLeave = () => { this.pointer.inside = false; };
    this._onVisibility = () => (document.hidden ? this._stop() : this._start());
    this._onLost = (e) => { e.preventDefault(); this._stop(); this.onContextLost?.(); };
    window.addEventListener("resize", this._onResize);
    window.addEventListener("pointermove", this._onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", this._onLeave);
    document.addEventListener("visibilitychange", this._onVisibility);
    this.canvas.addEventListener("webglcontextlost", this._onLost);

    this.resize();
    this._start();
  }

  _buildBackground() {
    this.bgMaterial = new THREE.ShaderMaterial({
      vertexShader: backgroundVertex, fragmentShader: backgroundFragment,
      depthTest: false, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uAspect: { value: 1 }, uEnergy: { value: 0 },
        uCoralAmt: { value: 0 }, uMintAmt: { value: 0 }, uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        ...paletteUniforms(),
      },
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMaterial);
    bg.frustumCulled = false;
    bg.renderOrder = -10;
    this.scene.add(bg);
  }

  _buildRibbon() {
    this.group = new THREE.Group();
    this.scene.add(this.group);
    const geometry = new THREE.PlaneGeometry(RIBBON_LENGTH, 1, this.isMobile ? 160 : 320, 16);
    this.ribbonMaterials = [0, 1].map((layer) => new THREE.ShaderMaterial({
      vertexShader: ribbonVertex, fragmentShader: ribbonFragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uEnergy: { value: 0 }, uExpand: { value: 0 }, uLayer: { value: layer },
        uRipple: { value: this.ripple }, uCoralAmt: { value: 0 }, uMintAmt: { value: 0 },
        uAlpha: { value: layer === 0 ? 1 : 0.55 }, ...paletteUniforms(),
      },
    }));
    this.ribbonMaterials.forEach((m) => {
      const mesh = new THREE.Mesh(geometry, m);
      mesh.frustumCulled = false;
      this.group.add(mesh);
    });
    this.ribbonGeometry = geometry;
  }

  _buildNodes() {
    this.nodeGeometry = new THREE.IcosahedronGeometry(0.085, 1);
    this.haloGeometry = new THREE.RingGeometry(0.15, 0.17, 40);
    this.nodes = NODE_X.map((x) => {
      const mat = new THREE.MeshBasicMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.95 });
      const haloMat = new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(this.nodeGeometry, mat);
      const halo = new THREE.Mesh(this.haloGeometry, haloMat);
      mesh.add(halo);
      mesh.userData = { x, mat, haloMat, halo };
      this.group.add(mesh);
      return mesh;
    });
  }

  _buildParticles() {
    const count = this.isMobile ? 30 : 80;
    this.particleCount = count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    this.particleData = [];
    const palette = [PALETTE.cyan, PALETTE.ice, PALETTE.mint, PALETTE.coral, PALETTE.mauve].map((h) => new THREE.Color(h));
    for (let i = 0; i < count; i++) {
      seeds[i] = Math.random();
      const c = palette[i % palette.length];
      colors.set([c.r, c.g, c.b], i * 3);
      this.particleData.push({
        x: (Math.random() - 0.5) * RIBBON_LENGTH, speed: 0.12 + Math.random() * 0.35,
        oy: (Math.random() - 0.5) * 1.4, oz: (Math.random() - 0.5) * 1.2, phase: Math.random() * 6.28,
      });
    }
    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.particleGeometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    this.particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    this.particleMaterial = new THREE.ShaderMaterial({
      vertexShader: particleVertex, fragmentShader: particleFragment,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: 5 * Math.min(window.devicePixelRatio || 1, 2) }, uEnergy: { value: 0 }, uTime: { value: 0 } },
    });
    const points = new THREE.Points(this.particleGeometry, this.particleMaterial);
    points.frustumCulled = false;
    this.group.add(points);
  }

  // ---------- public API (driven by real app state only) ----------

  setAppState(state) {
    if (!TARGETS[state] || state === this.appState) return;
    this.appState = state;
    clearTimeout(this.errorTimer);
    this.target = { ...TARGETS[state] };
    if (state === APP_STATES.COMPLETED) this.expand = 1;
    if (state === APP_STATES.ERROR) {
      this.errorTimer = setTimeout(() => { this.target = { ...TARGETS.idle }; }, 1600);
    }
  }

  setReducedMotion(reduced) {
    this.reduced = reduced;
    this.timeScale = reduced ? 0.12 : 1;
  }

  setPointerEnabled(enabled) {
    this.pointerEnabled = enabled;
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.bgMaterial.uniforms.uAspect.value = w / h;
    const visibleWidth = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z * this.camera.aspect;
    this.baseScale = Math.min(1.15, (visibleWidth * 0.94) / RIBBON_LENGTH);
    this.baseY = w < 768 ? -0.9 : -0.35;
    this.group.scale.setScalar(this.baseScale);
  }

  // ---------- loop ----------

  _start() {
    if (this.raf || this.disposed) return;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this._tick);
  }

  _stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  _tick = (now) => {
    this.raf = requestAnimationFrame(this._tick);
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const k = 1 - Math.exp(-dt * 3);
    const { cur, target } = this;
    cur.energy += (target.energy - cur.energy) * k;
    cur.coral += (target.coral - cur.coral) * k;
    cur.mint += (target.mint - cur.mint) * k;
    this.expand = Math.max(0, this.expand - dt * 0.8);
    this.time += dt * this.timeScale;

    const t = this.time;
    const breathing = this.appState === APP_STATES.IDLE ? 0.05 * Math.sin(t * 0.55) : 0;
    const energy = Math.max(0, cur.energy + breathing);
    const expand = this.expand * this.expand * (3 - 2 * this.expand);

    // pointer + parallax
    const fx = this.pointerEnabled && !this.reduced;
    const pk = 1 - Math.exp(-dt * 5);
    this.pointer.sx += (this.pointer.x - this.pointer.sx) * pk;
    this.pointer.sy += (this.pointer.y - this.pointer.sy) * pk;
    const px = fx ? this.pointer.sx - 0.5 : 0;
    const py = fx ? this.pointer.sy - 0.5 : 0;
    this.camera.position.x += (px * 0.6 - this.camera.position.x) * pk;
    this.camera.position.y += (-py * 0.35 - this.camera.position.y) * pk;
    this.camera.lookAt(0, 0, 0);
    this.group.position.y = this.baseY + (this.reduced ? 0 : 0.05 * Math.sin(t * 0.6));
    this.group.scale.setScalar(this.baseScale * (1 + expand * 0.08));

    this._updateRipple(dt, fx, t, energy);

    const bg = this.bgMaterial.uniforms;
    bg.uTime.value = t; bg.uEnergy.value = energy; bg.uCoralAmt.value = cur.coral; bg.uMintAmt.value = cur.mint;
    bg.uPointer.value.set(this.pointer.sx, 1 - this.pointer.sy);

    for (const m of this.ribbonMaterials) {
      const u = m.uniforms;
      u.uTime.value = t; u.uEnergy.value = energy; u.uExpand.value = expand;
      u.uCoralAmt.value = cur.coral; u.uMintAmt.value = cur.mint;
    }

    this._updateNodes(t, energy);
    this._updateParticles(dt, t, energy);
    this.renderer.render(this.scene, this.camera);
  };

  _updateRipple(dt, fx, t, energy) {
    let hitNow = false;
    if (fx && this.pointer.inside) {
      this.raycaster.setFromCamera(new THREE.Vector2(this.pointer.x * 2 - 1, -(this.pointer.y * 2 - 1)), this.camera);
      if (this.raycaster.ray.intersectPlane(this.plane, this.hit)) {
        const local = this.group.worldToLocal(this.hit.clone());
        const wave = waveHeight(local.x, t, energy, 0);
        // Hit test follows the visible ribbon, not the whole viewport.
        if (Math.abs(local.x) < HALF && Math.abs(local.y - wave) < 0.55) {
          hitNow = true;
          this.ripple.x = local.x / RIBBON_LENGTH + 0.5;
          this.ripple.y = THREE.MathUtils.clamp((local.y - wave) + 0.5, 0, 1);
        }
      }
    }
    const rk = 1 - Math.exp(-dt * (hitNow ? 6 : 2.5));
    this.ripple.z += ((hitNow ? 1 : 0) - this.ripple.z) * rk;
  }

  _updateNodes(t, energy) {
    const { coral, mint } = this.cur;
    this.nodeColor.set(PALETTE.cyan).lerp(new THREE.Color(PALETTE.coral), coral).lerp(new THREE.Color(PALETTE.mint), mint);
    // All nodes pulse in unison: this reflects activity, not per-stage progress.
    const pulse = 1 + coral * 0.25 * Math.sin(t * 5);
    for (const node of this.nodes) {
      const { x, haloMat, halo } = node.userData;
      node.position.set(x, waveHeight(x, t, energy, 0), 0);
      node.scale.setScalar(pulse);
      halo.scale.setScalar(1 + this.expand * 0.8 + 0.1 * Math.sin(t * 1.5 + x));
      halo.lookAt(this.camera.position);
      haloMat.color.copy(this.nodeColor);
    }
  }

  _updateParticles(dt, t, energy) {
    const pos = this.particleGeometry.attributes.position;
    const speedBoost = 0.5 + energy * 1.6;
    for (let i = 0; i < this.particleCount; i++) {
      const p = this.particleData[i];
      p.x += p.speed * dt * speedBoost * this.timeScale;
      if (p.x > HALF) p.x = -HALF;
      pos.setXYZ(i, p.x, waveHeight(p.x, t, energy, 0) + p.oy * (0.5 + energy * 0.5) + Math.sin(t + p.phase) * 0.05, p.oz);
    }
    pos.needsUpdate = true;
    this.particleMaterial.uniforms.uEnergy.value = energy;
    this.particleMaterial.uniforms.uTime.value = t;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._stop();
    clearTimeout(this.errorTimer);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("pointermove", this._onPointer);
    document.documentElement.removeEventListener("pointerleave", this._onLeave);
    document.removeEventListener("visibilitychange", this._onVisibility);
    this.canvas.removeEventListener("webglcontextlost", this._onLost);
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => m.dispose());
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

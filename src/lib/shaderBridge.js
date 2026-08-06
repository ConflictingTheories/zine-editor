// VOID PRESS — Shader Bridge for React (Vite)
// Exposes window.VPShader using mushu-flow

import { mushu } from '../lib/mushu/src/index.js'
import { noise2D, fbm2D } from '../lib/mushu/src/glsl/index.js'

const PRESETS = {
  plasma: {
    name: '🌀 Plasma',
    code: `
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        float t = time * 0.5;
        float v = sin(uv.x * 10.0 + t) + sin(uv.y * 10.0 + t);
        v += sin((uv.x + uv.y) * 10.0 + t) + sin(length(uv - 0.5) * 14.0 - t);
        v *= 0.25;
        vec3 col = vec3(
          0.5 + 0.5 * sin(v * 3.14159 + 0.0),
          0.5 + 0.5 * sin(v * 3.14159 + 2.094),
          0.5 + 0.5 * sin(v * 3.14159 + 4.188)
        );
        O = vec4(col, 1.0);
      }
    `
  },
  fire: {
    name: '🔥 Fire',
    code: `
      ${fbm2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        uv.y = 1.0 - uv.y;
        float n = fbm2D(vec2(uv.x * 4.0, uv.y * 4.0 - time * 2.0));
        float intensity = smoothstep(0.8, 0.0, uv.y) * n;
        vec3 col = mix(vec3(0.1,0.0,0.0), vec3(1.0,0.3,0.0), intensity);
        col = mix(col, vec3(1.0,0.9,0.2), pow(intensity, 3.0));
        O = vec4(col, intensity > 0.1 ? 1.0 : 0.0);
      }
    `
  },
  lightning: {
    name: '⚡ Lightning',
    code: `
      ${noise2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        vec2 center = vec2(0.5);
        float d = length(uv - center);
        float n = noise2D(uv * 8.0 + time * 3.0);
        float bolt = smoothstep(0.02, 0.0, abs(uv.x - 0.5 + n * 0.3) - 0.005 / (d + 0.1));
        float glow = exp(-d * 4.0) * 0.3;
        vec3 col = vec3(0.4, 0.6, 1.0) * (bolt + glow);
        O = vec4(col, max(bolt, glow) > 0.05 ? 1.0 : 0.0);
      }
    `
  },
  smoke: {
    name: '💨 Smoke',
    code: `
      ${fbm2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        float n = fbm2D(uv * 3.0 + vec2(time * 0.2, time * 0.5));
        float n2 = fbm2D(uv * 5.0 - vec2(time * 0.3, time * 0.1));
        float smoke = (n + n2) * 0.5;
        smoke = smoothstep(0.2, 0.8, smoke);
        vec3 col = mix(vec3(0.05), vec3(0.4), smoke);
        O = vec4(col, smoke * 0.8);
      }
    `
  },
  water: {
    name: '🌊 Water',
    code: `
      ${noise2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        float wave1 = sin(uv.x * 15.0 + time * 2.0 + noise2D(uv * 5.0) * 2.0) * 0.02;
        float wave2 = sin(uv.y * 12.0 + time * 1.5 + noise2D(uv * 3.0 + 10.0) * 3.0) * 0.015;
        vec2 distort = uv + vec2(wave1, wave2);
        float n = noise2D(distort * 8.0 + time * 0.5);
        vec3 deep = vec3(0.0, 0.05, 0.2);
        vec3 surface = vec3(0.1, 0.4, 0.7);
        vec3 highlight = vec3(0.6, 0.8, 1.0);
        vec3 col = mix(deep, surface, n);
        col = mix(col, highlight, pow(n, 4.0));
        O = vec4(col, 1.0);
      }
    `
  },
  voidNoise: {
    name: '🕳️ Void',
    code: `
      ${fbm2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        vec2 center = uv - 0.5;
        float d = length(center);
        float angle = atan(center.y, center.x) + time * 0.3;
        float n = fbm2D(vec2(angle * 2.0, d * 5.0 - time));
        float vortex = smoothstep(0.5, 0.0, d) * n;
        vec3 col = mix(vec3(0.0), vec3(0.5, 0.0, 0.8), vortex);
        col += vec3(0.8, 0.2, 1.0) * pow(vortex, 3.0);
        col += vec3(0.1) * exp(-d * 8.0);
        O = vec4(col, 1.0);
      }
    `
  },
  energy: {
    name: '✨ Energy',
    code: `
      ${noise2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        float t = time * 0.8;
        float n1 = noise2D(uv * 6.0 + t);
        float n2 = noise2D(uv * 12.0 - t * 1.3);
        float pattern = abs(sin(n1 * 6.28 + n2 * 3.14));
        pattern = pow(pattern, 3.0);
        vec3 col1 = vec3(0.0, 1.0, 0.8);
        vec3 col2 = vec3(1.0, 0.2, 0.8);
        vec3 col = mix(col1, col2, n1) * pattern;
        col += vec3(1.0) * pow(pattern, 8.0);
        O = vec4(col, pattern > 0.1 ? 1.0 : 0.0);
      }
    `
  },
  galaxy: {
    name: '🌌 Galaxy',
    code: `
      ${fbm2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        vec2 center = uv - 0.5;
        float d = length(center);
        float angle = atan(center.y, center.x);
        float spiral = fbm2D(vec2(angle * 3.0 + d * 10.0 - time * 0.5, d * 5.0));
        float stars = pow(fbm2D(uv * 40.0), 8.0) * 2.0;
        float core = exp(-d * 6.0);
        vec3 col = vec3(0.02, 0.01, 0.05);
        col += vec3(0.3, 0.1, 0.5) * spiral * smoothstep(0.5, 0.1, d);
        col += vec3(0.8, 0.6, 1.0) * core;
        col += vec3(1.0) * stars;
        O = vec4(col, 1.0);
      }
    `
  },
  crystal: {
    name: '💎 Crystal',
    code: `
      ${noise2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        vec2 p = uv - 0.5;
        float d = length(p);
        float ang = atan(p.y, p.x);
        float facets = abs(sin(ang * 6.0 + time * 0.4));
        float n = noise2D(uv * 6.0 - time * 0.6);
        float body = smoothstep(0.5, 0.05, d) * facets;
        vec3 a = vec3(0.4, 0.1, 0.9);
        vec3 b = vec3(0.1, 0.9, 1.0);
        vec3 c = mix(a, b, n);
        vec3 col = c * (0.4 + body * 1.2);
        col += vec3(1.0) * pow(body, 6.0) * 0.8;
        col += vec3(0.6, 0.9, 1.0) * exp(-d * 6.0) * 0.5;
        O = vec4(col, 1.0);
      }
    `
  },
  lava: {
    name: '🌋 Lava',
    code: `
      ${fbm2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        float n = fbm2D(uv * 3.0 + vec2(time * 0.4, time * 0.2));
        float cracks = pow(abs(sin(n * 6.283 + uv.x * 4.0)), 8.0);
        float glow = smoothstep(0.5, 0.0, uv.y);
        vec3 black = vec3(0.02, 0.01, 0.0);
        vec3 lava = vec3(1.0, 0.3, 0.02);
        vec3 hot = vec3(1.0, 0.9, 0.4);
        vec3 col = mix(black, lava, cracks * 0.8 + glow * 0.3);
        col = mix(col, hot, pow(cracks, 3.0) * 0.9);
        col += hot * glow * 0.2;
        O = vec4(col, 1.0);
      }
    `
  },
  nebula: {
    name: '🌠 Nebula',
    code: `
      ${fbm2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        float n1 = fbm2D(uv * 2.5 + vec2(time * 0.1, 0.0));
        float n2 = fbm2D(uv * 4.0 - vec2(0.0, time * 0.15));
        float n = (n1 + n2) * 0.5;
        vec3 deep = vec3(0.02, 0.0, 0.08);
        vec3 a = vec3(0.6, 0.1, 0.8);
        vec3 b = vec3(0.1, 0.4, 0.9);
        vec3 col = deep;
        col = mix(col, a, smoothstep(0.3, 0.7, n));
        col = mix(col, b, smoothstep(0.6, 0.9, n2));
        float stars = pow(fbm2D(uv * 30.0), 12.0);
        col += vec3(1.0) * stars;
        O = vec4(col, 1.0);
      }
    `
  },
  aurora: {
    name: '🌌 Aurora',
    code: `
      ${noise2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        uv.y = 1.0 - uv.y;
        float t = time * 0.3;
        vec3 col = vec3(0.0, 0.02, 0.08);
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float band = sin(uv.y * 6.0 + t * (1.0 + fi * 0.3) + fi * 2.0);
          float n = noise2D(vec2(uv.x * 8.0 + t * (0.5 + fi * 0.2), uv.y * 3.0));
          float curtain = exp(-abs(band) * 3.0) * smoothstep(0.9, 0.2, uv.y) * n;
          vec3 colr = i == 0 ? vec3(0.2, 1.0, 0.5)
                    : i == 1 ? vec3(0.3, 0.6, 1.0)
                    : vec3(0.8, 0.3, 1.0);
          col += colr * curtain * 0.8;
        }
        col += vec3(1.0) * pow(noise2D(uv * 40.0 + t), 14.0);
        O = vec4(col, 1.0);
      }
    `
  },
  hologram: {
    name: '🛸 Hologram',
    code: `
      ${noise2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        float t = time * 0.8;
        vec2 p = uv - 0.5;
        float d = length(p);
        float n = noise2D(p * 6.0 + t);
        float scanline = sin(uv.y * 120.0 + t * 20.0) * 0.5 + 0.5;
        float ring = abs(sin(d * 20.0 - t * 3.0));
        float flicker = 0.7 + 0.3 * sin(t * 10.0);
        vec3 col = vec3(0.0, 1.0, 0.9) * (0.3 + n * 0.5);
        col += vec3(0.0, 1.0, 0.9) * ring * 0.4;
        col *= 0.6 + 0.4 * scanline;
        col *= flicker;
        col += vec3(0.0, 0.8, 1.0) * exp(-d * 6.0) * 0.3;
        O = vec4(col, 0.35 + 0.4 * n);
      }
    `
  },
  matrix: {
    name: '🔢 Matrix',
    code: `
      ${noise2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        float t = time * 3.0;
        float col = floor(uv.x * 24.0);
        float row = floor(uv.y * 40.0);
        float seed = noise2D(vec2(col * 0.3, row * 0.3 + t));
        float glyph = step(0.5, fract(seed * 7.0));
        float trail = smoothstep(0.0, 0.4, fract(row * 0.1 - t));
        vec3 colr = vec3(0.0, 1.0, 0.2) * glyph * trail;
        colr += vec3(0.0, 0.5, 0.1) * (1.0 - glyph) * trail * 0.4;
        O = vec4(colr, trail > 0.05 ? 1.0 : 0.0);
      }
    `
  },
  ember: {
    name: '🔥 Ember',
    code: `
      ${noise2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        uv.y = 1.0 - uv.y;
        float t = time * 1.2;
        vec3 col = vec3(0.02, 0.01, 0.01);
        float n = noise2D(uv * 8.0 + vec2(0.0, -t * 2.0));
        float ember = step(0.85, n) * smoothstep(1.0, 0.0, uv.y);
        col += vec3(1.0, 0.5, 0.1) * ember * 1.5;
        col += vec3(1.0, 0.8, 0.3) * pow(ember, 3.0) * 2.0;
        float drift = noise2D(uv * 3.0 - vec2(t * 0.3, 0.0));
        col += vec3(0.4, 0.1, 0.0) * drift * 0.3 * smoothstep(1.0, 0.3, uv.y);
        O = vec4(col, 1.0);
      }
    `
  },
  toxic: {
    name: '☣ Toxic',
    code: `
      ${fbm2D}
      void mainImage(out vec4 O, vec2 C) {
        vec2 uv = C / resolution;
        float t = time * 0.5;
        float n = fbm2D(uv * 4.0 + vec2(t, t * 0.7));
        float bubbles = step(0.6, fbm2D(uv * 12.0 - t * 1.5)) * 0.5;
        float slime = smoothstep(0.3, 0.8, n);
        vec3 a = vec3(0.2, 0.9, 0.1);
        vec3 b = vec3(0.0, 0.5, 0.2);
        vec3 c = vec3(0.9, 1.0, 0.3);
        vec3 col = mix(b, a, slime);
        col += c * bubbles;
        col += vec3(0.3, 1.0, 0.2) * exp(-length(uv - 0.5) * 5.0) * 0.3;
        O = vec4(col, 1.0);
      }
    `
  }
}

const activeShaders = new Map()

if (typeof window !== 'undefined') {
  window.VPShader = {
    presets: PRESETS,
    start(canvas, presetKey, customCode) {
      this.stop(canvas)
      const code = presetKey === 'custom' ? customCode : (PRESETS[presetKey]?.code || PRESETS.plasma.code)
      try {
        const inst = mushu(canvas).gl(code)
        activeShaders.set(canvas, inst)
        return inst
      } catch (e) {
        console.warn('Shader failed to start:', e)
        return null
      }
    },
    stop(canvas) {
      const inst = activeShaders.get(canvas)
      if (inst && typeof inst.stop === 'function') inst.stop()
      activeShaders.delete(canvas)
    },
    resize(canvas) {
      const inst = activeShaders.get(canvas)
      if (inst && typeof inst.resize === 'function') inst.resize()
    },
    getPresetList() {
      return Object.entries(PRESETS).map(([key, val]) => ({ key, name: val.name }))
    }
  }
}

export { PRESETS }
export default window?.VPShader

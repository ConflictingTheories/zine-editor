// ═══════════════════════════════════════════
// VOID PRESS — Shader Bridge (ES Module)
// Bridges mushu-flow into the VP editor
// ═══════════════════════════════════════════

import { mushu, flow, shader } from './node_modules/mushu-flow/src/index.js';
import { noise2D, fbm2D, color, voronoi, simplex2D } from './node_modules/mushu-flow/src/glsl/index.js';

// ── Shader Presets ──
const PRESETS = {
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
        float flash = pow(max(0.0, sin(time * 8.0)), 20.0) * 0.5;
        vec3 col = vec3(0.4, 0.6, 1.0) * (bolt + glow + flash);
        O = vec4(col, max(bolt, glow + flash) > 0.05 ? 1.0 : 0.0);
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
    }
};

// ── Active shader instances ──
const activeShaders = new Map();

// ── Public API mounted on window.VPShader ──
window.VPShader = {
    presets: PRESETS,

    /**
     * Start a shader on a canvas element
     * @param {HTMLCanvasElement} canvas
     * @param {string} presetKey — key from PRESETS or 'custom'
     * @param {string=} customCode — if presetKey === 'custom'
     * @returns {object} The mushu flow instance (for stopping)
     */
    start(canvas, presetKey, customCode) {
        // Stop any existing shader on this canvas
        this.stop(canvas);

        const code = presetKey === 'custom'
            ? customCode
            : (PRESETS[presetKey]?.code || PRESETS.plasma.code);

        try {
            const inst = mushu(canvas).gl(code);
            activeShaders.set(canvas, inst);
            return inst;
        } catch (e) {
            console.warn('Shader failed to start:', e);
            return null;
        }
    },

    /**
     * Stop a shader running on a canvas
     */
    stop(canvas) {
        const inst = activeShaders.get(canvas);
        if (inst && typeof inst.stop === 'function') {
            inst.stop();
        }
        activeShaders.delete(canvas);
    },

    /**
     * Get list of preset names for UI
     */
    getPresetList() {
        return Object.entries(PRESETS).map(([key, val]) => ({
            key,
            name: val.name
        }));
    }
};

console.log('🍡 mushu-flow shader bridge loaded');

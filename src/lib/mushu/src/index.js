// ═══════════════════════════════════════════════════════════════════════════
// mushu — The Hookable Fluent Pattern for Creative Coding
// 
// Unified entry point:
//   mushu(canvas).glsl(code)           — Simple shader
//   mushu(canvas).flow()               — WebGL2 with plugin system
//   mushu(canvas).gpu()                — WebGPU simple render
//   mushu(canvas).gpu().flow()         — WebGPU with simulation
//
// Or import specific modules:
//   import { flow, shader } from 'mushu/core';
//   import { gpuFlow, gpu } from 'mushu/gpu';
//   import { noise, fbm } from 'mushu/glsl';
// ═══════════════════════════════════════════════════════════════════════════

// Core WebGL runtime
export * from './core/index.js';

// GLSL shader utilities
export * from './glsl/index.js';

// WebGPU runtime
export * from './gpu/index.js';

// Import for mushu() unified API
import { flow, shader } from './core/index.js';
import { gpuFlow, gpu as gpuSimple } from './gpu/index.js';
import { mushuScene } from './core/scene.js';

// ─────────────────────────────────────────────────────────────────────────────
// mushu() — The Unified Entry Point
// 
// Usage:
//   mushu(canvas).glsl(code)           — Quick shader (auto-start)
//   mushu(canvas).flow()               — WebGL2 plugin system
//   mushu(canvas).scene()              — Scene graph with multi-object support
//   mushu(canvas).gpu()                — WebGPU simple display
//   mushu(canvas).gpu().flow()         — WebGPU with simulation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified entry point for mushu.
 * @param {HTMLElement|string=} canvasOrSelector - Canvas element or CSS selector. If omitted, a fullscreen canvas is created.
 * @returns {{glsl: function(string=), gl: function(string=), flow: function(): *, scene: function(): *, gpu: function(*=, *=, *=): *}}
 */
/**
 * Convenience entry to create a mushu rendering flow for a canvas.
 * Re-exports deeper runtimes but provides a single top-level constructor.
 * @param {HTMLCanvasElement|string} canvasOrSelector Canvas element or selector.
 * @returns {object} The created flow instance.
 */
export function mushu(canvasOrSelector) {
  let canvas;

  if (!canvasOrSelector) {
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
    document.body.appendChild(canvas);
  } else if (typeof canvasOrSelector === 'string') {
    canvas = document.querySelector(canvasOrSelector);
  } else {
    canvas = canvasOrSelector;
  }

  return {
    // Quick shader helper - auto starts if code provided, otherwise returns flow builder
    gl(fragSource) {
      // If called with shader code, auto-start
      if (fragSource !== undefined) {
        return flow(canvas)
          .use(shader(fragSource))
          .go();
      }
      // Otherwise return flow builder for chaining
      return flow(canvas);
    },

    glsl(fragSource) {
      // If called with shader code, auto-start
      if (fragSource !== undefined) {
        return flow(canvas)
          .use(shader(fragSource))
          .go();
      }
      // Otherwise return flow builder for chaining
      return flow(canvas);
    },

    // WebGL2 fluent runtime with plugin system
    flow() {
      return flow(canvas);
    },

    // Scene graph for multi-object 3D scenes
    scene(settings) {
      return mushuScene(canvas, settings);
    },

    // WebGPU API
    gpu(computeCode, renderCode, options) {
      // If called with arguments, use the simple gpu() helper
      if (computeCode !== undefined || renderCode !== undefined) {
        return gpuSimple(computeCode, renderCode, { canvas, ...options });
      }

      // Otherwise return chainable GPU builder
      return {
        // WebGL2 fluent runtime with plugin system (new syntax)
        gl() {
          return flow(canvas);
        },

        // WebGPU fluent runtime with simulation
        flow() {
          return gpuFlow(canvas);
        },

        // WebGPU simple display/compute
        display(code) {
          return gpuFlow(canvas).display(code);
        },

        simulate(code) {
          return gpuFlow(canvas).simulate(code);
        }
      };
    }
  };
}

// Default export
export default mushu;

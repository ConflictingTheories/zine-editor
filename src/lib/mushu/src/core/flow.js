// ═══════════════════════════════════════════════════════════════════════════
// mushu/core — WebGL2 Hookable Runtime
// 
// Philosophy:
//   • Simple by default — works with zero config
//   • Powerful when needed — hook into any stage
//   • Chainable — compose behaviors fluently
//   • Hot-reloadable — change anything at runtime
//
// Usage:
//   mushu(canvas).flow()
//     .use(shader(myCode))
//     .use(uniform('time', ctx => ctx.time))
//     .go()
//
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Core: The Hookable Runtime (flow)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flow context object passed to plugins.
 * @typedef {Object} FlowContext
 * @property {WebGL2RenderingContext} gl
 * @property {HTMLCanvasElement} canvas
 * @property {number} time
 * @property {number} delta
 * @property {number} frame
 * @property {number} width
 * @property {number} height
 * @property {number} aspect
 * @property {[number,number]} mouse
 * @property {[number,number]} mouseNDC
 * @property {boolean} mouseDown
 * @property {[number,number]} mouseVelocity
 * @property {WebGLProgram|null} program
 * @property {Object} state - shared plugin state
 */

/**
 * Create a WebGL2 flow runtime with plugin support.
 * @param {HTMLCanvasElement|string|WebGL2RenderingContext} canvasOrGl - Canvas element, selector or GL context.
 * @returns {{use:function(*):*, scale:function(number):*, go:function():*, stop:function():*, ctx: FlowContext, hot:function(string, *):*, reset:function():*, destroy:function():*}}
 */
/**
 * Create a WebGL flow runtime which manages a render loop and plugins.
 * @param {HTMLCanvasElement|WebGLRenderingContext|string} canvasOrGl Canvas or selector or an existing GL context.
 * @returns {object} Flow instance with `.use()` and `.start()` helpers.
 */
export function flow(canvasOrGl) {
  // Accept either canvas element, selector, or WebGL context
  let canvas, gl;

  if (typeof canvasOrGl === 'string') {
    canvas = document.querySelector(canvasOrGl);
  } else if (canvasOrGl.getContext) {
    canvas = canvasOrGl;
  } else if (canvasOrGl.canvas) {
    canvas = canvasOrGl.canvas;
    gl = canvasOrGl;
  }

  if (!gl) {
    gl = canvas.getContext('webgl2');
  }

  if (!gl) {
    console.error('WebGL2 not supported');
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal state
  // ─────────────────────────────────────────────────────────────────────────
  const plugins = [];
  let running = false;
  let animationId = null;

  // Shared context passed to all plugins
  const ctx = {
    gl,
    canvas,
    time: 0,
    delta: 0,
    frame: 0,
    width: 0,
    height: 0,
    aspect: 1,
    mouse: [0.5, 0.5],     // Normalized 0-1
    mouseNDC: [0, 0],       // Normalized device coords -1 to 1
    mouseDown: false,
    mouseVelocity: [0, 0],  // Mouse movement velocity
    program: null,
    // Allow plugins to store shared state
    state: {},
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-resize
  // ─────────────────────────────────────────────────────────────────────────
  let dprScale = 1;
  const resize = () => {
    const dpr = (window.devicePixelRatio || 1) * dprScale;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.width = canvas.width;
    ctx.height = canvas.height;
    ctx.aspect = canvas.width / canvas.height;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Notify plugins of resize
    for (const plugin of plugins) {
      if (plugin.resize) plugin.resize(ctx);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Mouse tracking
  // ─────────────────────────────────────────────────────────────────────────
  let lastMouse = [0.5, 0.5];
  const onMouseMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    ctx.mouseVelocity[0] = x - lastMouse[0];
    ctx.mouseVelocity[1] = y - lastMouse[1];
    lastMouse[0] = x;
    lastMouse[1] = y;

    ctx.mouse[0] = x;
    ctx.mouse[1] = y;
    ctx.mouseNDC[0] = x * 2 - 1;
    ctx.mouseNDC[1] = 1 - y * 2;
  };

  const onTouchMove = (e) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      ctx.mouse[0] = (touch.clientX - rect.left) / rect.width;
      ctx.mouse[1] = (touch.clientY - rect.top) / rect.height;
      ctx.mouseNDC[0] = ctx.mouse[0] * 2 - 1;
      ctx.mouseNDC[1] = 1 - ctx.mouse[1] * 2;
    }
  };

  const onMouseDown = () => { ctx.mouseDown = true; };
  const onMouseUp = () => { ctx.mouseDown = false; };
  const onTouchStart = () => { ctx.mouseDown = true; };
  const onTouchEnd = () => { ctx.mouseDown = false; };

  // ─────────────────────────────────────────────────────────────────────────
  // The render loop
  // ─────────────────────────────────────────────────────────────────────────
  let lastTime = 0;
  const loop = (t) => {
    ctx.time = t * 0.001;
    ctx.delta = Math.min(ctx.time - lastTime, 0.1); // Cap at 100ms
    lastTime = ctx.time;
    ctx.frame++;

    // Run all plugins in order
    for (const plugin of plugins) {
      if (typeof plugin === 'function') {
        plugin(ctx);
      } else if (plugin.render) {
        plugin.render(ctx);
      }
    }

    // Decay mouse velocity
    ctx.mouseVelocity[0] *= 0.9;
    ctx.mouseVelocity[1] *= 0.9;

    if (running) {
      animationId = requestAnimationFrame(loop);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // The fluent API
  // ─────────────────────────────────────────────────────────────────────────
  const api = {
    // Add a plugin (function or object with render method)
    use(plugin) {
      // If plugin is a function that returns a plugin, call it with ctx
      if (typeof plugin === 'function' && plugin.length === 0) {
        const result = plugin();
        if (result) plugins.push(result);
      } else {
        plugins.push(plugin);
      }
      return api;
    },

    // Set resolution scale (1 = full DPR, 0.5 = half res, etc)
    scale(s) {
      dprScale = s;
      if (running) resize();
      return api;
    },

    // Start the render loop
    go() {
      // Setup
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchstart', onTouchStart);
      window.addEventListener('touchend', onTouchEnd);

      // Initialize plugins
      for (const plugin of plugins) {
        if (plugin.init) plugin.init(ctx);
      }

      running = true;
      animationId = requestAnimationFrame(loop);
      return api;
    },

    // Alias for go
    start() { return api.go(); },

    // Stop the render loop
    stop() {
      running = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      return api;
    },

    // Access context directly
    get ctx() { return ctx; },

    // Hot reload a specific plugin by name
    hot(name, newPlugin) {
      const idx = plugins.findIndex(p => p.name === name);
      if (idx >= 0) {
        if (plugins[idx].destroy) plugins[idx].destroy(ctx);
        plugins[idx] = newPlugin;
        if (newPlugin.init) newPlugin.init(ctx);
      }
      return api;
    },

    // Remove all plugins and reset
    reset() {
      for (const plugin of plugins) {
        if (plugin.destroy) plugin.destroy(ctx);
      }
      plugins.length = 0;
      return api;
    },

    // Cleanup everything
    destroy() {
      api.stop();
      api.reset();
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    }
  };

  return api;
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Plugins
// ─────────────────────────────────────────────────────────────────────────────

// Clear the screen with a color
/**
 * Clear plugin — clears the color buffer each frame.
 * @param {([number,number,number,number]|function(FlowContext):[number,number,number,number])} [colorOrFn=[0,0,0,1]]
 *   Color array [r,g,b,a] or a function that returns one given the flow context.
 * @returns {function(FlowContext): void} plugin compatible with `flow().use(...)`.
 */
/**
 * Built-in plugin: clear the framebuffer each frame.
 * @param {Array<number>|Function} [colorOrFn] Clear color array or a function returning a color.
 * @returns {Function} Plugin function to register with `flow().use()`.
 */
export function clear(colorOrFn = [0, 0, 0, 1]) {
  return (ctx) => {
    const c = typeof colorOrFn === 'function' ? colorOrFn(ctx) : colorOrFn;
    ctx.gl.clearColor(c[0] || 0, c[1] || 0, c[2] || 0, c[3] ?? 1);
    ctx.gl.clear(ctx.gl.COLOR_BUFFER_BIT);
  };
}

// Fullscreen quad (sets up VAO for drawing)
/**
 * Built-in plugin: provide a fullscreen quad/triangle geometry for shader passes.
 * @returns {Function} Plugin that injects a fullscreen geometry into the flow.
 */
export function quad() {
  let vao = null;

  return {
    name: 'quad',
    init(ctx) {
      vao = ctx.gl.createVertexArray();
      ctx.gl.bindVertexArray(vao);
    },
    render(ctx) {
      ctx.gl.bindVertexArray(vao);
      ctx.gl.drawArrays(ctx.gl.TRIANGLES, 0, 3);
    }
  };
}

/**
 * Create a simple fullscreen quad plugin (VAO for a fullscreen triangle).
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext)}}
 */

// Compile and use a fragment shader
/**
 * Built-in plugin: compile and run a fragment shader for full-screen passes.
 * @param {string} fragSource Fragment GLSL source string.
 * @param {object} [options]
 * @returns {Function} Plugin that renders the shader.
 */
export function shader(fragSource, options = {}) {
  let program = null;
  const customUniforms = options.uniforms || {};

  const vertSource = `#version 300 es
    void main() {
      vec2 positions[3] = vec2[](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
      gl_Position = vec4(positions[gl_VertexID], 0, 1);
    }`;

  const compile = (ctx) => {
    const gl = ctx.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vertSource);
    gl.compileShader(vs);

    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vs));
      return null;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    const fullFrag = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      uniform float time;
      uniform float delta;
      uniform int frame;
      uniform vec2 resolution;
      uniform vec2 mouse;
      uniform vec2 mouseVelocity;
      uniform float mouseDown;
      ${fragSource}
      void main() { mainImage(fragColor, gl_FragCoord.xy); }`;
    gl.shaderSource(fs, fullFrag);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fs));
      console.error('Shader source:', fullFrag);
      return null;
    }

    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);

    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(p));
      return null;
    }

    return p;
  };

  return {
    name: 'shader',
    init(ctx) {
      program = compile(ctx);
      ctx.program = program;
    },
    render(ctx) {
      if (!program) return;
      const gl = ctx.gl;
      gl.useProgram(program);
      ctx.program = program;

      // Auto-set built-in uniforms
      gl.uniform1f(gl.getUniformLocation(program, 'time'), ctx.time);
      gl.uniform1f(gl.getUniformLocation(program, 'delta'), ctx.delta);
      gl.uniform1i(gl.getUniformLocation(program, 'frame'), ctx.frame);
      gl.uniform2f(gl.getUniformLocation(program, 'resolution'), ctx.width, ctx.height);
      // Flip mouse Y to match GL coordinate system (Y=0 at bottom)
      gl.uniform2f(gl.getUniformLocation(program, 'mouse'), ctx.mouse[0], 1.0 - ctx.mouse[1]);
      gl.uniform2f(gl.getUniformLocation(program, 'mouseVelocity'), ctx.mouseVelocity[0], -ctx.mouseVelocity[1]);
      gl.uniform1f(gl.getUniformLocation(program, 'mouseDown'), ctx.mouseDown ? 1 : 0);

      // Set custom uniforms
      for (const [name, valueFn] of Object.entries(customUniforms)) {
        const loc = gl.getUniformLocation(program, name);
        if (!loc) continue;
        const value = typeof valueFn === 'function' ? valueFn(ctx) : valueFn;
        if (typeof value === 'number') {
          gl.uniform1f(loc, value);
        } else if (value.length === 2) {
          gl.uniform2fv(loc, value);
        } else if (value.length === 3) {
          gl.uniform3fv(loc, value);
        } else if (value.length === 4) {
          gl.uniform4fv(loc, value);
        }
      }

      // Draw fullscreen triangle
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    // Allow hot-reload
    reload(newSource, ctx) {
      const gl = ctx.gl;
      if (program) gl.deleteProgram(program);
      fragSource = newSource;
      program = compile(ctx);
      ctx.program = program;
    }
  };
}

/**
 * Shader plugin — compiles a fragment shader and draws a fullscreen triangle.
 * The supplied fragment code must define `void mainImage(out vec4 O, vec2 C)`.
 * @param {string} fragSource - GLSL fragment shader source (user code inserted into wrapper).
 * @param {Object} [options] - Optional settings (e.g., uniforms map).
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext), reload:function(string, FlowContext)}}
 */

// Set a custom uniform
/**
 * Built-in plugin: inject a uniform into the shader environment.
 * @param {string} name Uniform name.
 * @param {any|Function} valueOrFn Static value or function producing the value each frame.
 * @returns {Function} Plugin registering the uniform.
 */
export function uniform(name, valueOrFn) {
  let location = null;
  let lastProgram = null;

  return {
    name: `uniform:${name}`,
    render(ctx) {
      if (!ctx.program) return;
      const gl = ctx.gl;

      // Cache location per program
      if (lastProgram !== ctx.program) {
        location = gl.getUniformLocation(ctx.program, name);
        lastProgram = ctx.program;
      }
      if (!location) return;

      const value = typeof valueOrFn === 'function' ? valueOrFn(ctx) : valueOrFn;

      if (typeof value === 'number') {
        gl.uniform1f(location, value);
      } else if (Array.isArray(value) || value instanceof Float32Array) {
        switch (value.length) {
          case 2: gl.uniform2fv(location, value); break;
          case 3: gl.uniform3fv(location, value); break;
          case 4: gl.uniform4fv(location, value); break;
          case 9: gl.uniformMatrix3fv(location, false, value); break;
          case 16: gl.uniformMatrix4fv(location, false, value); break;
        }
      }
    }
  };
}

/**
 * Uniform plugin — sets a named uniform on the active program each frame.
 * @param {string} name - Uniform name in the shader program.
 * @param {(number|Array|function(FlowContext):any)} valueOrFn - Value or a function returning value.
 * @returns {{name:string, render:function(FlowContext)}}
 */

// FPS counter
/**
 * Built-in plugin: provide frames-per-second timing metrics to the flow.
 * @returns {Function} Plugin that tracks FPS and exposes it via `state.fps`.
 */
export function fps() {
  let div = null;
  let lastUpdate = 0;
  let frames = 0;
  let fps = 0;

  return {
    name: 'fps',
    init() {
      div = document.createElement('div');
      div.style.cssText = 'position:fixed;bottom:10px;left:10px;color:white;font:14px monospace;background:rgba(0,0,0,0.6);padding:6px 12px;border-radius:4px;z-index:10000;pointer-events:none';
      document.body.appendChild(div);
    },
    render(ctx) {
      frames++;
      if (ctx.time - lastUpdate > 0.5) {
        fps = Math.round(frames / (ctx.time - lastUpdate));
        div.textContent = `${fps} fps`;
        frames = 0;
        lastUpdate = ctx.time;
      }
    },
    destroy() {
      if (div) div.remove();
    }
  };
}

/**
 * FPS plugin — shows a small FPS counter in the page.
 * @returns {{name:string, init:function(), render:function(FlowContext), destroy:function()}}
 */

// ─────────────────────────────────────────────────────────────────────────────
// Advanced: Ping-pong FBO for simulations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Built-in plugin: simple ping-pong simulation helper for GPGPU or CPU sim steps.
 * @param {object} [options]
 * @returns {Function} Plugin that manages simulation step state.
 */
export function simulation(options = {}) {
  const {
    scale = 0.5,      // Resolution scale
    iterations = 1,   // Simulation iterations per frame
  } = options;

/**
 * Simulation plugin — provides a ping-pong FBO simulation target and renderer.
 * @param {Object} [options]
 * @param {number} [options.scale=0.5]
 * @param {number} [options.iterations=1]
 * @param {string} [options.format='RGBA16F']
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext), destroy:function(FlowContext)}}
 */
  let fboA, fboB, texA, texB;
  let simProgram = null;
  let renderProgram = null;
  let width, height;
  let simSrc = '';
  let renderSrc = '';

  const createFBO = (gl, w, h) => {
    /**
     * Create a framebuffer with an attached RGBA16F texture for simulation.
     * @param {WebGL2RenderingContext} gl
     * @param {number} w Width in pixels
     * @param {number} h Height in pixels
     * @returns {{fb: WebGLFramebuffer, tex: WebGLTexture}}
     */
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    return { fb, tex };
  };

  const compileShader = (gl, fragSrc, includeBackbuffer = false, addHelpers = false) => {
    /**
     * Compile a full-screen shader from fragment source.
     * @param {WebGL2RenderingContext} gl
     * @param {string} fragSrc Fragment shader source.
     * @param {boolean} [includeBackbuffer] Whether to inject backbuffer sampling helpers.
     * @param {boolean} [addHelpers] Whether to add sample helpers.
     * @returns {WebGLProgram|null} The compiled program or null if compilation failed.
     */
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, `#version 300 es
      void main() {
        vec2 positions[3] = vec2[](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
        gl_Position = vec4(positions[gl_VertexID], 0, 1);
      }`);
    gl.compileShader(vs);

    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vs));
      return null;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    const helpers = addHelpers ? `
      // Sample the simulation buffer with offset (in pixels)
      vec4 sample(vec2 offset) {
        vec2 uv = (gl_FragCoord.xy + offset) / resolution;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0);
        return texture(backbuffer, uv);
      }
      
      // Sample with wrapped coordinates
      vec4 sampleWrap(vec2 offset) {
        vec2 uv = fract((gl_FragCoord.xy + offset) / resolution);
        return texture(backbuffer, uv);
      }
    ` : '';

    const prefix = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      uniform float time;
      uniform float delta;
      uniform vec2 resolution;
      uniform vec2 mouse;
      uniform vec2 mouseVelocity;
      uniform float mouseDown;
      ${includeBackbuffer ? 'uniform sampler2D backbuffer;' : ''}
      ${helpers}
    `;

    gl.shaderSource(fs, prefix + fragSrc + `\nvoid main() { mainImage(fragColor, gl_FragCoord.xy); }`);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fs));
      console.error('Source:', prefix + fragSrc);
      return null;
    }

    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);

    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('Link error:', gl.getProgramInfoLog(p));
      return null;
    }

    return p;
  };

  const api = {
    name: 'simulation',

    // Set simulation shader
    simulate(fragSrc) {
      simSrc = fragSrc;
      return api;
    },

    // Set render/display shader
    display(fragSrc) {
      renderSrc = fragSrc;
      return api;
    },

    init(ctx) {
      const gl = ctx.gl;
      gl.getExtension('EXT_color_buffer_float');

      width = Math.floor(ctx.width * scale);
      height = Math.floor(ctx.height * scale);

      const a = createFBO(gl, width, height);
      const b = createFBO(gl, width, height);
      fboA = a.fb; texA = a.tex;
      fboB = b.fb; texB = b.tex;

      if (simSrc) {
        simProgram = compileShader(gl, simSrc, true, true);
      }
      if (renderSrc) {
        renderProgram = compileShader(gl, renderSrc, true, false);
      }
    },

    resize(ctx) {
      const gl = ctx.gl;
      const newWidth = Math.floor(ctx.width * scale);
      const newHeight = Math.floor(ctx.height * scale);

      if (newWidth !== width || newHeight !== height) {
        width = newWidth;
        height = newHeight;

        // Recreate FBOs
        const a = createFBO(gl, width, height);
        const b = createFBO(gl, width, height);
        fboA = a.fb; texA = a.tex;
        fboB = b.fb; texB = b.tex;
      }
    },

    render(ctx) {
      const gl = ctx.gl;

      // Run simulation iterations
      for (let i = 0; i < iterations; i++) {
        if (simProgram) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
          gl.viewport(0, 0, width, height);
          gl.useProgram(simProgram);

          gl.uniform1f(gl.getUniformLocation(simProgram, 'time'), ctx.time);
          gl.uniform1f(gl.getUniformLocation(simProgram, 'delta'), ctx.delta);
          gl.uniform2f(gl.getUniformLocation(simProgram, 'resolution'), width, height);
          gl.uniform2f(gl.getUniformLocation(simProgram, 'mouse'), ctx.mouse[0], 1.0 - ctx.mouse[1]);
          gl.uniform2f(gl.getUniformLocation(simProgram, 'mouseVelocity'), ctx.mouseVelocity[0], -ctx.mouseVelocity[1]);
          gl.uniform1f(gl.getUniformLocation(simProgram, 'mouseDown'), ctx.mouseDown ? 1 : 0);

          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texA);
          gl.uniform1i(gl.getUniformLocation(simProgram, 'backbuffer'), 0);

          gl.drawArrays(gl.TRIANGLES, 0, 3);

          // Swap buffers
          [fboA, fboB] = [fboB, fboA];
          [texA, texB] = [texB, texA];
        }
      }

      // Render to screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, ctx.width, ctx.height);

      if (renderProgram) {
        gl.useProgram(renderProgram);
        gl.uniform1f(gl.getUniformLocation(renderProgram, 'time'), ctx.time);
        gl.uniform2f(gl.getUniformLocation(renderProgram, 'resolution'), ctx.width, ctx.height);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texA);
        gl.uniform1i(gl.getUniformLocation(renderProgram, 'backbuffer'), 0);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
  };

  return api;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple one-liner API for quick demos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convenience: create and mount a `flow()` instance that runs a single GLSL fragment.
 * @param {string} fragSource Fragment GLSL source.
 * @param {HTMLCanvasElement|string} canvasOrSelector Canvas element or selector.
 * @returns {object} The created flow instance.
 */
export function glsl(fragSource, canvasOrSelector) {
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

  return flow(canvas)
    .use(shader(fragSource))
    .go();
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy alias for backwards compatibility
// ─────────────────────────────────────────────────────────────────────────────
export const yo = flow;

// ─────────────────────────────────────────────────────────────────────────────
// Default export
// ─────────────────────────────────────────────────────────────────────────────
export default flow;

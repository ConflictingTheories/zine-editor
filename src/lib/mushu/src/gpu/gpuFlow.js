// ═══════════════════════════════════════════════════════════════════════════
// mushu/gpu — WebGPU Hookable Runtime
// 
// Usage:
//   mushu(canvas).gpu().flow()
//     .simulate(computeWGSL)
//     .display(fragmentWGSL)
//     .go()
//
// Features:
//   • Automatic device/adapter setup
//   • Ping-pong compute textures
//   • Proper resize handling
//   • Touch support
//   • Fallback messages
// ═══════════════════════════════════════════════════════════════════════════

// Check for WebGPU support
/**
 * Return whether WebGPU is available in the current environment.
 * @returns {boolean}
 */
/**
 * Returns true when the current environment supports WebGPU.
 * @returns {boolean} Whether WebGPU is available.
 */
export function hasWebGPU() {
  return !!navigator.gpu;
}

// ─────────────────────────────────────────────────────────────────────────────
// gpuFlow — Fluent WebGPU Runtime
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a fluent WebGPU runtime attached to a canvas.
 * Builder usage:
 *   gpuFlow(canvas).display(wgsl) | .simulate(wgsl) | .go()
 *
 * @param {HTMLCanvasElement|string} canvasOrSelector - Canvas element or selector.
 * @returns {{display: function(string), simulate: function(string), scale: function(number), go: function(): Promise<*> , stop: function(): *}}
 */
/**
 * Create a minimal WebGPU-based rendering flow attached to a canvas.
 * @param {HTMLCanvasElement|string} canvasOrSelector Canvas element or selector string.
 * @returns {object} An object with helpers to build GPU render pipelines and submit frames.
 */
export function gpuFlow(canvasOrSelector) {
  let canvas;

  if (typeof canvasOrSelector === 'string') {
    canvas = document.querySelector(canvasOrSelector);
  } else {
    canvas = canvasOrSelector;
  }

  // Internal state
  let displayCode = null;
  let simulateCode = null;
  let running = false;
  let device = null;
  let context = null;
  let format = null;
  let simScale = 1.0;

  // Mouse state
  const mouse = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, down: false };

  const builder = {
    // Set display/fragment shader
    display(code) {
      displayCode = code;
      return builder;
    },

    // Set simulation/compute shader
    simulate(code) {
      simulateCode = code;
      return builder;
    },

    // Set simulation texture scale (0.5 = half res)
    scale(s) {
      simScale = s;
      return builder;
    },

    // Start the GPU pipeline
    async go() {
      if (!navigator.gpu) {
        showError('WebGPU Not Supported', 'Use Chrome 113+ or Edge 113+ with WebGPU enabled.');
        return null;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          showError('No GPU Adapter', 'Could not find a suitable GPU adapter.');
          return null;
        }

        device = await adapter.requestDevice();
        context = canvas.getContext('webgpu');
        format = navigator.gpu.getPreferredCanvasFormat();

        // Setup mouse events
        setupMouse();

        // Set running flag so animation loops will start
        running = true;

        // Run the appropriate pipeline
        if (simulateCode) {
          await runComputePipeline();
        } else if (displayCode) {
          await runDisplayPipeline();
        }

        return builder;

      } catch (err) {
        showError('WebGPU Error', err.message);
        console.error(err);
        return null;
      }
    },

    stop() {
      running = false;
      return builder;
    }
  };

  /**
   * Render an in-canvas overlay to show an error title and message to the user.
   * This creates/updates an HTML overlay element positioned over the canvas.
   * @param {string} title Short title describing the error.
   * @param {string} message Detailed message to display.
   */
  function showError(title, message) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#111;color:#fff;font-family:system-ui;text-align:center;padding:40px;';
    div.innerHTML = `<div><h1 style="color:#f66">${title}</h1><p style="color:#aaa;max-width:400px">${message}</p></div>`;
    document.body.appendChild(div);
  }

  /**
   * Install pointer and wheel listeners on the canvas to keep a `mouse` state
   * object updated. The returned object contains `mouse` and `dispose()`.
   * @returns {{mouse: {x:number,y:number,down:boolean}, dispose: Function}}
   */
  function setupMouse() {
    const updateMouse = (x, y) => {
      const rect = canvas.getBoundingClientRect();
      mouse.px = mouse.x;
      mouse.py = mouse.y;
      mouse.x = (x - rect.left) / rect.width;
      mouse.y = (y - rect.top) / rect.height;  // No flip - shaders flip when needed
    };

    canvas.addEventListener('mousemove', e => updateMouse(e.clientX, e.clientY));
    canvas.addEventListener('mousedown', () => mouse.down = true);
    canvas.addEventListener('mouseup', () => mouse.down = false);
    canvas.addEventListener('mouseleave', () => mouse.down = false);

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length > 0) {
        updateMouse(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    canvas.addEventListener('touchstart', e => {
      mouse.down = true;
      if (e.touches.length > 0) {
        updateMouse(e.touches[0].clientX, e.touches[0].clientY);
      }
    });
    canvas.addEventListener('touchend', () => mouse.down = false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Compute Pipeline (simulation with ping-pong textures)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Execute the compute pipeline (if provided) to update simulation or GPGPU state.
   * This function encodes commands onto a command encoder and submits them.
   * @returns {Promise<void>} Resolves after commands are submitted.
   */
  async function runComputePipeline() {
    let width, height, simWidth, simHeight;
    let stateA, stateB;

    // Configure context FIRST with initial canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    width = Math.floor(rect.width * dpr);
    height = Math.floor(rect.height * dpr);
    canvas.width = width;
    canvas.height = height;

    context.configure({ device, format, alphaMode: 'premultiplied' });

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = Math.floor(rect.width * dpr);
      height = Math.floor(rect.height * dpr);
      canvas.width = width;
      canvas.height = height;

      simWidth = Math.floor(width * simScale);
      simHeight = Math.floor(height * simScale);

      // Create simulation textures
      const createTex = () => device.createTexture({
        size: [simWidth, simHeight],
        format: 'rgba16float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      });

      stateA = createTex();
      stateB = createTex();
    };

    resize();
    window.addEventListener('resize', resize);

    // Create unified uniform buffer (padded to 16-byte alignment)
    // Layout: time(4) + pad(4) + width(4) + height(4) + mouseX(4) + mouseY(4) + mouseDown(4) + pad(4) + prevMouseX(4) + prevMouseY(4) + pad(8) = 48 bytes
    const uniformBuffer = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Compute shader - prepend uniforms to user code
    // User code should define fn main(@builtin(global_invocation_id) id: vec3<u32>) with @compute @workgroup_size
    const computeShaderCode = /* wgsl */`
      struct Uniforms {
        time: f32,
        _pad0: f32,
        width: f32,
        height: f32,
        mouseX: f32,
        mouseY: f32,
        mouseDown: f32,
        _pad1: f32,
        prevMouseX: f32,
        prevMouseY: f32,
      }
      
      @group(0) @binding(0) var<uniform> u: Uniforms;
      @group(0) @binding(1) var src: texture_storage_2d<rgba16float, read>;
      @group(0) @binding(2) var dst: texture_storage_2d<rgba16float, write>;
      
      // Convenience aliases for user code
      var<private> time: f32;
      var<private> resolution: vec2<f32>;
      var<private> mouse: vec2<f32>;
      var<private> mouseDown: f32;
      
      // Sample helper for storage texture (no mip level)
      fn sample(C: vec2<i32>) -> vec4<f32> {
        let dims = vec2<i32>(textureDimensions(src));
        let p = clamp(C, vec2<i32>(0), dims - vec2<i32>(1));
        return textureLoad(src, p);
      }
      
      // Sample with offset helper
      fn sampleOffset(C: vec2<i32>, offset: vec2<i32>) -> vec4<f32> {
        let dims = vec2<i32>(textureDimensions(src));
        let p = clamp(C + offset, vec2<i32>(0), dims - vec2<i32>(1));
        return textureLoad(src, p);
      }
      
      ${simulateCode}
    `;

    const computeModule = device.createShaderModule({ code: computeShaderCode });

    const computeBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'read-only', format: 'rgba16float' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } }
      ]
    });

    const computePipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
      compute: { module: computeModule, entryPoint: 'main' }
    });

    // Render shader with proper vertex shader
    const renderModule = device.createShaderModule({
      code: `
        struct Uniforms {
          time: f32,
          _pad0: f32,
          width: f32,
          height: f32,
          mouseX: f32,
          mouseY: f32,
          mouseDown: f32,
          _pad1: f32,
          prevMouseX: f32,
          prevMouseY: f32,
        }
        
        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) uv: vec2f
        }
        
        @vertex fn vs(@builtin(vertex_index) i: u32) -> VertexOutput {
          var pos = array<vec2f, 3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
          var output: VertexOutput;
          output.position = vec4f(pos[i], 0.0, 1.0);
          var tmp = pos[i] * 0.5 + 0.5;
          output.uv = vec2f(tmp.x, 1.0 - tmp.y);
          return output;
        }
        
        @group(0) @binding(0) var<uniform> u: Uniforms;
        @group(0) @binding(1) var simTex: texture_2d<f32>;
        @group(0) @binding(2) var texSampler: sampler;
        
        // Convenience aliases for user code
        var<private> time: f32;
        var<private> resolution: vec2<f32>;
        
        ${displayCode}
      `
    });

    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    const renderBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
      ]
    });

    const renderPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
      vertex: { module: renderModule, entryPoint: 'vs' },
      fragment: { module: renderModule, entryPoint: 'main', targets: [{ format }] },
      primitive: { topology: 'triangle-list' }
    });

    const startTime = performance.now();

    const loop = () => {
      if (!running) return;

      const time = (performance.now() - startTime) * 0.001;

      // Update unified uniform buffer
      // Layout: time, pad, width, height, mouseX, mouseY, mouseDown, pad, prevMouseX, prevMouseY, pad, pad
      // Note: Mouse Y is flipped to match GL coordinate system (Y=0 at bottom)
      device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([
        time, 0,
        simWidth, simHeight,
        mouse.x, 1.0 - mouse.y,
        mouse.down ? 1 : 0, 0,
        mouse.px, 1.0 - mouse.py,
        0, 0
      ]));

      const encoder = device.createCommandEncoder();

      // Compute pass
      const computeBindGroup = device.createBindGroup({
        layout: computeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: stateA.createView() },
          { binding: 2, resource: stateB.createView() }
        ]
      });

      const computePass = encoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(Math.ceil(simWidth / 8), Math.ceil(simHeight / 8));
      computePass.end();

      // Render pass
      const renderBindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: stateB.createView() },
          { binding: 2, resource: sampler }
        ]
      });

      const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: [0, 0, 0, 1],
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, renderBindGroup);
      renderPass.draw(3);
      renderPass.end();

      device.queue.submit([encoder.finish()]);

      // Swap textures
      [stateA, stateB] = [stateB, stateA];

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Display-only Pipeline (no compute, just fragment shader)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Execute the display/render pipeline which draws to the swap chain or canvas.
   * It encodes render passes, sets pipelines and bind groups, and submits.
   * @returns {Promise<void>} Resolves after the frame has been submitted.
   */
  async function runDisplayPipeline() {
    let width, height;

    // Configure context FIRST with initial canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    width = Math.floor(rect.width * dpr);
    height = Math.floor(rect.height * dpr);
    canvas.width = width;
    canvas.height = height;
    context.configure({ device, format, alphaMode: 'premultiplied' });

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = Math.floor(rect.width * dpr);
      height = Math.floor(rect.height * dpr);
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', resize);

    // Create uniform buffers
    const timeBuffer = device.createBuffer({ size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const resBuffer = device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const mouseBuffer = device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const mouseDownBuffer = device.createBuffer({ size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    const shaderModule = device.createShaderModule({
      code: `
        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) uv: vec2f
        }
        
        @vertex fn vs(@builtin(vertex_index) i: u32) -> VertexOutput {
          var pos = array<vec2f, 3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
          var output: VertexOutput;
          output.position = vec4f(pos[i], 0.0, 1.0);
          output.uv = pos[i] * 0.5 + 0.5;
          return output;
        }
        
        @group(0) @binding(0) var<uniform> time: f32;
        @group(0) @binding(1) var<uniform> resolution: vec2f;
        @group(0) @binding(2) var<uniform> mouse: vec2f;
        @group(0) @binding(3) var<uniform> mouseDown: f32;
        
        ${displayCode}
      `
    });

    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vs' },
      fragment: { module: shaderModule, entryPoint: 'main', targets: [{ format }] },
      primitive: { topology: 'triangle-list' }
    });

    const startTime = performance.now();

    const loop = () => {
      if (!running) return;

      const time = (performance.now() - startTime) * 0.001;

      device.queue.writeBuffer(timeBuffer, 0, new Float32Array([time]));
      device.queue.writeBuffer(resBuffer, 0, new Float32Array([width, height]));
      // Flip mouse Y to match GL-style coordinate (0 = bottom)
      device.queue.writeBuffer(mouseBuffer, 0, new Float32Array([mouse.x, 1.0 - mouse.y]));
      device.queue.writeBuffer(mouseDownBuffer, 0, new Float32Array([mouse.down ? 1 : 0]));

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: [0, 0, 0, 1],
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: timeBuffer } },
          { binding: 1, resource: { buffer: resBuffer } },
          // Flip mouse Y so fragment shaders receive Y with origin at bottom
          { binding: 2, resource: { buffer: mouseBuffer } },
          { binding: 3, resource: { buffer: mouseDownBuffer } }
        ]
      }));
      pass.draw(3);
      pass.end();

      device.queue.submit([encoder.finish()]);
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  return builder;
}

// ─────────────────────────────────────────────────────────────────────────────
// gpu() — Simplified Compute + Render Pattern
// 
// Usage:
//   gpu(computeCode, renderCode, { canvas, scale })
// 
// The compute shader should define: fn compute(C: vec2<i32>, uv: vec2<f32>)
// The render shader should define: fn render(data: vec4<f32>, uv: vec2<f32>) -> vec4<f32>
// 
// Available uniforms in shaders via u.* struct:
//   u.time, u.width, u.height, u.mouseX, u.mouseY, u.mouseDown, u.prevMouseX, u.prevMouseY
// 
// Helper functions available in compute shader:
//   sample(C) - load from source texture at pixel coordinates
//   sampleOffset(C, offset) - load with offset
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simplified GPU helper — run a compute + render pipeline on a fullscreen canvas.
 * @param {string|null} computeCode - WGSL compute shader code (or null for render-only).
 * @param {string} renderCode - WGSL fragment shader code (required).
 * @param {Object} [options]
 * @param {HTMLCanvasElement} [options.canvas] - Optional canvas to attach.
 * @param {number} [options.scale=0.5] - Simulation scale for ping-pong textures.
 * @returns {Promise<{stop:function():void, canvas: HTMLCanvasElement, device: GPUDevice}|null>}
 */
export async function gpu(computeCode, renderCode, options = {}) {
  const {
    canvas = createFullscreenCanvas(),
    scale = 0.5
  } = options;

  if (!renderCode) {
    showGPUError('No render shader provided');
    return null;
  }

  if (!navigator.gpu) {
    showGPUError();
    return null;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    showGPUError('No GPU adapter found');
    return null;
  }

  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();

  let width, height;
  let stateA, stateB;
  let computePipeline = null;
  let computeBindGroupLayout = null;

  const createStateTexture = (w, h) => device.createTexture({
    size: [w, h],
    format: 'rgba16float',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
  });

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    width = Math.floor(rect.width * dpr * scale);
    height = Math.floor(rect.height * dpr * scale);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    context.configure({ device, format, alphaMode: 'premultiplied' });

    // Recreate state textures on resize if compute shader is present
    if (computeCode) {
      stateA = createStateTexture(width, height);
      stateB = createStateTexture(width, height);
    }
  };

  resize();
  window.addEventListener('resize', resize);

  // Mouse tracking (consistent with yoGPU)
  const mouse = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, down: false };

  const updateMouse = (x, y) => {
    const rect = canvas.getBoundingClientRect();
    mouse.px = mouse.x;
    mouse.py = mouse.y;
    mouse.x = (x - rect.left) / rect.width;
    mouse.y = (y - rect.top) / rect.height;
  };

  canvas.addEventListener('mousemove', e => updateMouse(e.clientX, e.clientY));
  canvas.addEventListener('mousedown', () => mouse.down = true);
  canvas.addEventListener('mouseup', () => mouse.down = false);
  canvas.addEventListener('mouseleave', () => mouse.down = false);

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length > 0) {
      updateMouse(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  canvas.addEventListener('touchstart', e => {
    mouse.down = true;
    if (e.touches.length > 0) {
      updateMouse(e.touches[0].clientX, e.touches[0].clientY);
    }
  });
  canvas.addEventListener('touchend', () => mouse.down = false);

  // Uniform buffer (matches yoGPU layout - 48 bytes, 16-byte aligned)
  // Layout: time(4) + pad(4) + width(4) + height(4) + mouseX(4) + mouseY(4) + mouseDown(4) + pad(4) + prevMouseX(4) + prevMouseY(4) + pad(8)
  const uniformBuffer = device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  // Compute pipeline - only if compute code provided
  if (computeCode) {
    const computeModule = device.createShaderModule({
      code: /* wgsl */`
        struct Uniforms {
          time: f32,
          _pad0: f32,
          width: f32,
          height: f32,
          mouseX: f32,
          mouseY: f32,
          mouseDown: f32,
          _pad1: f32,
          prevMouseX: f32,
          prevMouseY: f32,
        }
        
        @group(0) @binding(0) var<uniform> u: Uniforms;
        @group(0) @binding(1) var src: texture_storage_2d<rgba16float, read>;
        @group(0) @binding(2) var dst: texture_storage_2d<rgba16float, write>;

        // Sample helper for storage texture
        fn sample(C: vec2<i32>) -> vec4<f32> {
          let dims = vec2<i32>(textureDimensions(src));
          let p = clamp(C, vec2<i32>(0), dims - vec2<i32>(1));
          return textureLoad(src, p);
        }
        
        // Sample with offset helper
        fn sampleOffset(C: vec2<i32>, offset: vec2<i32>) -> vec4<f32> {
          let dims = vec2<i32>(textureDimensions(src));
          let p = clamp(C + offset, vec2<i32>(0), dims - vec2<i32>(1));
          return textureLoad(src, p);
        }

        ${computeCode}

        @compute @workgroup_size(8, 8)
        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
          let C = vec2<i32>(id.xy);
          let dims = textureDimensions(src);
          if (u32(C.x) >= dims.x || u32(C.y) >= dims.y) { return; }
          let uv = vec2<f32>(C) / vec2<f32>(dims);
          compute(C, uv);
        }
      `
    });

    computeBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'read-only', format: 'rgba16float' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } }
      ]
    });

    computePipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
      compute: { module: computeModule, entryPoint: 'main' }
    });
  }

  // Create dummy texture for render binding if no compute shader
  let dummyTexture = null;
  if (!computeCode) {
    // Textures cannot be mapped at creation. Create a small 1x1 texture
    // and upload a single white pixel via the queue.
    dummyTexture = device.createTexture({
      size: [1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    const pixel = new Uint8Array([255, 255, 255, 255]);
    device.queue.writeTexture(
      { texture: dummyTexture },
      pixel,
      { bytesPerRow: 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );
  }

  // Render pipeline
  const renderModule = device.createShaderModule({
    code: /* wgsl */`
      struct Uniforms {
        time: f32,
        _pad0: f32,
        width: f32,
        height: f32,
        mouseX: f32,
        mouseY: f32,
        mouseDown: f32,
        _pad1: f32,
        prevMouseX: f32,
        prevMouseY: f32,
      }
      
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
      }

      @vertex
      fn vs(@builtin(vertex_index) i: u32) -> VertexOutput {
        var pos = array<vec2<f32>, 3>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>(3.0, -1.0),
          vec2<f32>(-1.0, 3.0)
        );
        var output: VertexOutput;
        output.position = vec4<f32>(pos[i], 0.0, 1.0);
        var tmp = pos[i] * 0.5 + 0.5;
        output.uv = vec2<f32>(tmp.x, 1.0 - tmp.y);
        return output;
      }

      @group(0) @binding(0) var<uniform> u: Uniforms;
      @group(0) @binding(1) var tex: texture_2d<f32>;
      @group(0) @binding(2) var samp: sampler;

      ${renderCode}

      @fragment
      fn fs(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        // UV were flipped in the vertex shader so user code receives Y-origin at bottom
        let data = textureSample(tex, samp, uv);
        return render(data, uv);
      }
    `
  });

  const renderBindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
    ]
  });

  const renderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
    vertex: { module: renderModule, entryPoint: 'vs' },
    fragment: { module: renderModule, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });

  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

  let running = true;
  const startTime = performance.now();
  let canvasWidth, canvasHeight;

  const loop = () => {
    if (!running) return;

    const time = (performance.now() - startTime) * 0.001;

    // Get canvas dimensions
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvasWidth = Math.floor(rect.width * dpr);
    canvasHeight = Math.floor(rect.height * dpr);

    // Uniform buffer layout:
    // time(4) + pad(4) + width(4) + height(4) + mouseX(4) + mouseY(4) + mouseDown(4) + pad(4) + prevMouseX(4) + prevMouseY(4) + pad(8)
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([
      time, 0,
      canvasWidth, canvasHeight,
      mouse.x, 1.0 - mouse.y,
      mouse.down ? 1 : 0, 0,
      mouse.px, 1.0 - mouse.py,
      0, 0
    ]));

    const encoder = device.createCommandEncoder();

    // Compute pass (only if compute shader provided)
    if (computePipeline && stateA && stateB) {
      const computePass = encoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, device.createBindGroup({
        layout: computeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: stateA.createView() },
          { binding: 2, resource: stateB.createView() }
        ]
      }));
      computePass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
      computePass.end();
    }

    // Render pass
    const texToRender = computeCode ? stateB : dummyTexture;
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: [0, 0, 0, 1],
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, device.createBindGroup({
      layout: renderBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: texToRender.createView() },
        { binding: 2, resource: sampler }
      ]
    }));
    renderPass.draw(3);
    renderPass.end();

    device.queue.submit([encoder.finish()]);

    // Swap textures if compute shader present
    if (computePipeline && stateA && stateB) {
      [stateA, stateB] = [stateB, stateA];
    }

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);

  return {
    stop: () => { running = false; },
    canvas,
    device
  };
}

/**
 * Create and return a canvas element sized to cover the full window.
 * Used when no canvas selector is provided to `gpuFlow()`.
 * @returns {HTMLCanvasElement} The created canvas element.
 */
function createFullscreenCanvas() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
  document.body.appendChild(canvas);
  return canvas;
}

/**
 * Show a simple DOM-level alert instructing the user that WebGPU isn't available.
 * @param {string} [message] Message to display in the created notice element.
 */
function showGPUError(message = 'WebGPU is not supported in this browser. Try Chrome 113+ or Edge 113+.') {
  document.body.innerHTML = `
    <div style="color:#fff;font-family:system-ui;padding:40px;text-align:center;background:#111;position:fixed;inset:0;display:flex;align-items:center;justify-content:center">
      <div>
        <h1 style="color:#f66">WebGPU Not Supported</h1>
        <p style="color:#888">${message}</p>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WGSL Shader Snippets
// ─────────────────────────────────────────────────────────────────────────────

export const wgsl = {
  // Hash functions
  hash: /* wgsl */`
    fn hash(p: vec2<f32>) -> f32 {
      return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
    }
    
    fn hash2(p: vec2<f32>) -> vec2<f32> {
      let q = vec2<f32>(dot(p, vec2<f32>(127.1, 311.7)), dot(p, vec2<f32>(269.5, 183.3)));
      return fract(sin(q) * 43758.5453);
    }
  `,

  // Noise functions
  noise: /* wgsl */`
    fn noise(p: vec2<f32>) -> f32 {
      let i = floor(p);
      let f = fract(p);
      let u = f * f * (3.0 - 2.0 * f);
      
      let a = hash(i);
      let b = hash(i + vec2<f32>(1.0, 0.0));
      let c = hash(i + vec2<f32>(0.0, 1.0));
      let d = hash(i + vec2<f32>(1.0, 1.0));
      
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
  `,

  // FBM
  fbm: /* wgsl */`
    fn fbm(p: vec2<f32>) -> f32 {
      var pos = p;
      var f = 0.0;
      var amp = 0.5;
      for (var i = 0; i < 6; i++) {
        f += amp * noise(pos);
        pos *= 2.0;
        amp *= 0.5;
      }
      return f;
    }
  `
};

// ─────────────────────────────────────────────────────────────────────────────
// Legacy alias for backwards compatibility
// ─────────────────────────────────────────────────────────────────────────────
export const yoGPU = gpuFlow;

// ─────────────────────────────────────────────────────────────────────────────
// Default export
// ─────────────────────────────────────────────────────────────────────────────
export default gpuFlow;

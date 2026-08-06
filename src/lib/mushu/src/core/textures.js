/**
 * mushu/core/textures — Texture loading and management for WebGL2.
 *
 * Provides plugins for loading images, video, data textures and render targets.
 * These plugins are intended to be used with the `flow()` runtime.
 * @module mushu/core/textures
 */
// ═══════════════════════════════════════════════════════════════════════════
// mushu/core/textures — Texture Loading and Management
// 
// Usage:
//   mushu(canvas).flow()
//     .use(texture('./diffuse.jpg', { name: 'diffuse', unit: 0 }))
//     .use(texture('./normal.png', { name: 'normalMap', unit: 1 }))
//     .use(shader(myShader))
//     .go()
//
// Or create textures programmatically:
//   import { texture, dataTexture, cubeMap, renderTarget } from 'mushu/core';
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Texture Loader Plugin
// 
// Loads image textures from URLs with automatic format detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create or load a 2D texture for WebGL from various sources.
 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|string|ArrayBufferView} source
 *   Source for the texture. May be an element, URL string, or raw data.
 * @param {object} [options]
 * @returns {object} Texture handle usable by the runtime.
 */
export function texture(source, options = {}) {
  const {
    name = 'texture0',           // Uniform name
    unit = 0,                    // Texture unit (0-15)
    wrapS = 'REPEAT',            // REPEAT, CLAMP_TO_EDGE, MIRRORED_REPEAT
    wrapT = 'REPEAT',
    minFilter = 'LINEAR_MIPMAP_LINEAR',
    magFilter = 'LINEAR',
    flipY = true,                // Flip Y for image textures (typical for photos)
    generateMipmaps = true,
    anisotropy = 4,              // Anisotropic filtering level
  } = options;

  let tex = null;

  return {
    name: `texture:${name}`,

    init(ctx) {
      const gl = ctx.gl;
      tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);

      // Set placeholder (1x1 pink pixel for debugging)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([255, 0, 255, 255]));

      // Load actual texture
      if (typeof source === 'string') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl[wrapS]);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl[wrapT]);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[minFilter]);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[magFilter]);

          if (generateMipmaps && isPowerOfTwo(img.width) && isPowerOfTwo(img.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
          } else if (generateMipmaps) {
            // NPOT textures need different settings
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          }

          // Anisotropic filtering
          const ext = gl.getExtension('EXT_texture_filter_anisotropic');
          if (ext && anisotropy > 1) {
            const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
            gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(anisotropy, max));
          }

          // Texture loaded successfully
          ctx.state[`tex_${name}`] = { texture: tex, unit, width: img.width, height: img.height };
        };
        img.onerror = () => {
          console.error(`Failed to load texture: ${source}`);
        };
        img.src = source;
      } else if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement || source instanceof HTMLVideoElement) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl[wrapS]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl[wrapT]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[minFilter]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[magFilter]);
        if (generateMipmaps) gl.generateMipmap(gl.TEXTURE_2D);
        // Texture loaded from element
        ctx.state[`tex_${name}`] = { texture: tex, unit, width: source.width, height: source.height };
      }
    },

    render(ctx) {
      if (!ctx.program) return;
      const gl = ctx.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const loc = gl.getUniformLocation(ctx.program, name);
      if (loc) gl.uniform1i(loc, unit);
    },

    // Update texture with new data
    update(source, ctx) {
      const gl = ctx.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      if (options.generateMipmaps !== false) gl.generateMipmap(gl.TEXTURE_2D);
    },

    destroy(ctx) {
      if (tex) ctx.gl.deleteTexture(tex);
    }
  };
}

/**
 * Image texture plugin for WebGL2 flow.
 * @param {(string|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement)} source
 * @param {Object} [options]
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext), update:function(*, FlowContext), destroy:function(FlowContext)}}
 */

// ─────────────────────────────────────────────────────────────────────────────
// Data Texture — Create textures from raw data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a data-backed texture (RGBA float/byte) from an options object.
 * @param {object} [options]
 * @returns {object} Texture handle for pixel data uploads.
 */
export function dataTexture(options = {}) {
  const {
    name = 'dataTexture',
    unit = 0,
    width = 256,
    height = 256,
    data = null,                 // Float32Array, Uint8Array, etc.
    format = 'RGBA',             // RGBA, RGB, RG, RED
    internalFormat = null,       // RGBA32F, RGBA16F, etc. (auto-detected)
    type = 'FLOAT',              // FLOAT, UNSIGNED_BYTE, HALF_FLOAT
    wrapS = 'CLAMP_TO_EDGE',
    wrapT = 'CLAMP_TO_EDGE',
    minFilter = 'NEAREST',
    magFilter = 'NEAREST',
  } = options;

  let tex = null;

  return {
    name: `dataTexture:${name}`,

    init(ctx) {
      const gl = ctx.gl;
      gl.getExtension('EXT_color_buffer_float');
      gl.getExtension('OES_texture_float_linear');

      tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);

      const glFormat = gl[format];
      const glType = gl[type];
      let glInternalFormat;

      // Auto-detect internal format
      if (internalFormat) {
        glInternalFormat = gl[internalFormat];
      } else if (type === 'FLOAT') {
        glInternalFormat = format === 'RGBA' ? gl.RGBA32F :
          format === 'RGB' ? gl.RGB32F :
            format === 'RG' ? gl.RG32F : gl.R32F;
      } else if (type === 'HALF_FLOAT') {
        glInternalFormat = format === 'RGBA' ? gl.RGBA16F :
          format === 'RGB' ? gl.RGB16F :
            format === 'RG' ? gl.RG16F : gl.R16F;
      } else {
        glInternalFormat = format === 'RGBA' ? gl.RGBA8 :
          format === 'RGB' ? gl.RGB8 :
            format === 'RG' ? gl.RG8 : gl.R8;
      }

      gl.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, width, height, 0, glFormat, glType, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl[wrapS]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl[wrapT]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[minFilter]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[magFilter]);

      ctx.state[`tex_${name}`] = { texture: tex, unit, width, height };
    },

    render(ctx) {
      if (!ctx.program) return;
      const gl = ctx.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const loc = gl.getUniformLocation(ctx.program, name);
      if (loc) gl.uniform1i(loc, unit);
    },

    // Update texture data
    update(newData, ctx, newWidth = width, newHeight = height) {
      const gl = ctx.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, newWidth, newHeight, gl[format], gl[type], newData);
    },

    destroy(ctx) {
      if (tex) ctx.gl.deleteTexture(tex);
    }
  };
}

/**
 * Create a data texture plugin that uploads raw pixel/float data to a GL texture.
 * @param {Object} [options]
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext), update:function(*, FlowContext), destroy:function(FlowContext)}}
 */

// ─────────────────────────────────────────────────────────────────────────────
// Video Texture — Continuously update from video element
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a live-updating texture sourced from a video element or URL.
 * @param {HTMLVideoElement|string} videoElementOrUrl Video element or URL to load.
 * @param {object} [options]
 * @returns {object} Texture handle which updates each frame.
 */
export function videoTexture(videoElementOrUrl, options = {}) {
  const {
    name = 'video',
    unit = 0,
    loop = true,
    muted = true,
    autoplay = true,
  } = options;

  let tex = null;
  let video = null;

  return {
    name: `videoTexture:${name}`,

    init(ctx) {
      const gl = ctx.gl;

      if (typeof videoElementOrUrl === 'string') {
        video = document.createElement('video');
        video.src = videoElementOrUrl;
        video.crossOrigin = 'anonymous';
        video.loop = loop;
        video.muted = muted;
        video.playsInline = true;
        if (autoplay) video.play();
      } else {
        video = videoElementOrUrl;
      }

      tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 255]));

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      ctx.state[`video_${name}`] = video;
      ctx.state[`tex_${name}`] = { texture: tex, unit };
    },

    render(ctx) {
      const gl = ctx.gl;

      if (video && video.readyState >= video.HAVE_CURRENT_DATA) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      }

      if (ctx.program) {
        const loc = gl.getUniformLocation(ctx.program, name);
        if (loc) gl.uniform1i(loc, unit);
      }
    },

    play() { if (video) video.play(); },
    pause() { if (video) video.pause(); },

    destroy(ctx) {
      if (tex) ctx.gl.deleteTexture(tex);
      if (video && typeof videoElementOrUrl === 'string') {
        video.pause();
        video.src = '';
      }
    }
  };
}

/**
 * Video texture plugin for playing and binding a video element as a GL texture.
 * @param {(string|HTMLVideoElement)} videoElementOrUrl
 * @param {Object} [options]
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext), destroy:function(FlowContext)}}
 */

// ─────────────────────────────────────────────────────────────────────────────
// Webcam Texture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a texture that streams from the user's webcam (getUserMedia).
 * @param {object} [options]
 * @returns {Promise<object>} Resolves to a texture handle once stream is active.
 */
export function webcamTexture(options = {}) {
  const {
    name = 'webcam',
    unit = 0,
    facingMode = 'user',         // 'user' (front) or 'environment' (back)
    width = 640,
    height = 480,
  } = options;

  let tex = null;
  let video = null;
  let stream = null;

  return {
    name: `webcamTexture:${name}`,

    async init(ctx) {
      const gl = ctx.gl;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: width }, height: { ideal: height } }
        });

        video = document.createElement('video');
        video.srcObject = stream;
        video.playsInline = true;
        await video.play();
      } catch (err) {
        console.error('Webcam access denied:', err);
        return;
      }

      tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 255]));

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      ctx.state[`video_${name}`] = video;
      ctx.state[`tex_${name}`] = { texture: tex, unit };
    },

    render(ctx) {
      const gl = ctx.gl;

      if (video && video.readyState >= video.HAVE_CURRENT_DATA) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      }

      if (ctx.program) {
        const loc = gl.getUniformLocation(ctx.program, name);
        if (loc) gl.uniform1i(loc, unit);
      }
    },

    destroy(ctx) {
      if (tex) ctx.gl.deleteTexture(tex);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };
}

/**
 * Webcam texture plugin — binds a webcam stream as a texture.
 * @param {Object} [options]
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext), destroy:function(FlowContext)}}
 */

// ─────────────────────────────────────────────────────────────────────────────
// Cube Map Texture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load or create a cubemap texture from 6 image sources.
 * @param {Array<string|HTMLImageElement>} sources Array of 6 sources ordered +X, -X, +Y, -Y, +Z, -Z.
 * @param {object} [options]
 * @returns {object} Cubemap texture handle.
 */
export function cubeMap(sources, options = {}) {
  // sources: { px, nx, py, ny, pz, nz } or array [px, nx, py, ny, pz, nz]
  const {
    name = 'cubeMap',
    unit = 0,
  } = options;

  let tex = null;
  const faces = [
    'TEXTURE_CUBE_MAP_POSITIVE_X',
    'TEXTURE_CUBE_MAP_NEGATIVE_X',
    'TEXTURE_CUBE_MAP_POSITIVE_Y',
    'TEXTURE_CUBE_MAP_NEGATIVE_Y',
    'TEXTURE_CUBE_MAP_POSITIVE_Z',
    'TEXTURE_CUBE_MAP_NEGATIVE_Z',
  ];

  const urls = Array.isArray(sources)
    ? sources
    : [sources.px, sources.nx, sources.py, sources.ny, sources.pz, sources.nz];

  return {
    name: `cubeMap:${name}`,

    init(ctx) {
      const gl = ctx.gl;
      tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);

      // Placeholder
      faces.forEach((face, _i) => {
        gl.texImage2D(gl[face], 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
          new Uint8Array([128, 128, 128, 255]));
      });

      // Load images
      let loadedCount = 0;
      urls.forEach((url, i) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
          gl.texImage2D(gl[faces[i]], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          loadedCount++;

          if (loadedCount === 6) {
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
          }
        };
        img.src = url;
      });

      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      ctx.state[`tex_${name}`] = { texture: tex, unit, isCube: true };
    },

    render(ctx) {
      if (!ctx.program) return;
      const gl = ctx.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
      const loc = gl.getUniformLocation(ctx.program, name);
      if (loc) gl.uniform1i(loc, unit);
    },

    destroy(ctx) {
      if (tex) ctx.gl.deleteTexture(tex);
    }
  };
}

/**
 * Create a cubemap texture plugin from 6 image sources.
 * @param {Array<string|HTMLImageElement>} sources
 * @param {Object} [options]
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext), destroy:function(FlowContext)}}
 */

// ─────────────────────────────────────────────────────────────────────────────
// Render Target (FBO) — Render to texture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a framebuffer/render-target texture pair used as an offscreen render target.
 * @param {object} [options]
 * @returns {object} Object containing the texture and framebuffer.
 */
export function renderTarget(options = {}) {
  const {
    name = 'renderTarget',
    unit = 0,
    width = null,                // null = canvas size
    height = null,
    scale = 1.0,                 // Scale relative to canvas
    format = 'RGBA16F',          // RGBA16F, RGBA32F, RGBA8
    depth = true,                // Include depth buffer
    stencil = false,
  } = options;

  let fbo = null;
  let colorTex = null;
  let depthRbo = null;
  let currentWidth = 0;
  let currentHeight = 0;

  const createFBO = (gl, w, h) => {
    colorTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, colorTex);

    const internalFormat = gl[format] || gl.RGBA16F;
    const dataFormat = gl.RGBA;
    const dataType = format.includes('32F') ? gl.FLOAT :
      format.includes('16F') ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, dataFormat, dataType, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0);

    if (depth || stencil) {
      depthRbo = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthRbo);
      const rboFormat = stencil ? gl.DEPTH24_STENCIL8 : gl.DEPTH_COMPONENT24;
      const attachment = stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
      gl.renderbufferStorage(gl.RENDERBUFFER, rboFormat, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, depthRbo);
    }

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer incomplete:', status);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    currentWidth = w;
    currentHeight = h;
  };

  return {
    name: `renderTarget:${name}`,

    init(ctx) {
      const gl = ctx.gl;
      gl.getExtension('EXT_color_buffer_float');

      const w = width || Math.floor(ctx.width * scale);
      const h = height || Math.floor(ctx.height * scale);
      createFBO(gl, w, h);

      ctx.state[`fbo_${name}`] = { fbo, texture: colorTex, unit, width: w, height: h };
      ctx.state[`tex_${name}`] = { texture: colorTex, unit, width: w, height: h };
    },

    resize(ctx) {
      if (width && height) return; // Fixed size, don't resize

      const gl = ctx.gl;
      const newW = Math.floor(ctx.width * scale);
      const newH = Math.floor(ctx.height * scale);

      if (newW !== currentWidth || newH !== currentHeight) {
        // Cleanup old resources
        if (colorTex) gl.deleteTexture(colorTex);
        if (fbo) gl.deleteFramebuffer(fbo);
        if (depthRbo) gl.deleteRenderbuffer(depthRbo);

        createFBO(gl, newW, newH);
        ctx.state[`fbo_${name}`] = { fbo, texture: colorTex, unit, width: newW, height: newH };
        ctx.state[`tex_${name}`] = { texture: colorTex, unit, width: newW, height: newH };
      }
    },

    // Bind this render target for drawing
    bind(ctx) {
      const gl = ctx.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, currentWidth, currentHeight);
    },

    // Unbind (return to default framebuffer)
    unbind(ctx) {
      const gl = ctx.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, ctx.width, ctx.height);
    },

    // Use as texture
    render(ctx) {
      if (!ctx.program) return;
      const gl = ctx.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, colorTex);
      const loc = gl.getUniformLocation(ctx.program, name);
      if (loc) gl.uniform1i(loc, unit);
    },

    destroy(ctx) {
      const gl = ctx.gl;
      if (colorTex) gl.deleteTexture(colorTex);
      if (fbo) gl.deleteFramebuffer(fbo);
      if (depthRbo) gl.deleteRenderbuffer(depthRbo);
    }
  };
}

/**
 * Create an offscreen render target texture (FBO) plugin.
 * @param {Object} [options]
 * @returns {{name:string, init:function(FlowContext), getTexture:function(): WebGLTexture, destroy:function(FlowContext)}}
 */

// ─────────────────────────────────────────────────────────────────────────────
// Noise Textures (procedurally generated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a procedural noise texture (perlin/simplex) for use as input maps.
 * @param {object} [options]
 * @returns {object} Noise texture handle.
 */
export function noiseTexture(options = {}) {
  const {
    name = 'noise',
    unit = 0,
    size = 256,
    type = 'white',              // 'white', 'perlin', 'simplex', 'worley'
    scale = 1.0,
    octaves = 4,
  } = options;

  const generateNoise = () => {
    const data = new Float32Array(size * size * 4);

    if (type === 'white') {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.random();
        data[i + 1] = Math.random();
        data[i + 2] = Math.random();
        data[i + 3] = 1;
      }
    } else if (type === 'perlin' || type === 'simplex') {
      // Simple value noise (approximation)
      const hash = (x, y) => {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return n - Math.floor(n);
      };

      const smoothNoise = (x, y) => {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const fx = x - x0;
        const fy = y - y0;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);

        return hash(x0, y0) * (1 - sx) * (1 - sy) +
          hash(x0 + 1, y0) * sx * (1 - sy) +
          hash(x0, y0 + 1) * (1 - sx) * sy +
          hash(x0 + 1, y0 + 1) * sx * sy;
      };

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let value = 0;
          let amp = 0.5;
          let freq = scale;

          for (let o = 0; o < octaves; o++) {
            value += amp * smoothNoise(x * freq / size, y * freq / size);
            freq *= 2;
            amp *= 0.5;
          }

          const idx = (y * size + x) * 4;
          data[idx] = value;
          data[idx + 1] = value;
          data[idx + 2] = value;
          data[idx + 3] = 1;
        }
      }
    }

    return data;
  };

  return dataTexture({
    name,
    unit,
    width: size,
    height: size,
    data: generateNoise(),
    format: 'RGBA',
    type: 'FLOAT',
    wrapS: 'REPEAT',
    wrapT: 'REPEAT',
    minFilter: 'LINEAR',
    magFilter: 'LINEAR',
  });
}

/**
 * Generate a procedural noise data texture plugin.
 * @param {Object} [options]
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext), destroy:function(FlowContext)}}
 */

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function isPowerOfTwo(value) {
  return (value & (value - 1)) === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────────────────────

export default {
  texture,
  dataTexture,
  videoTexture,
  webcamTexture,
  cubeMap,
  renderTarget,
  noiseTexture,
};

/**
 * mushu/gpu/textures — WebGPU texture loading and helpers.
 *
 * Utilities for creating GPU textures from images, ImageBitmap, and raw data
 * and helpers to generate mipmaps. Returns `{ texture, sampler, width, height }`.
 * @module mushu/gpu/textures
 */
// ═══════════════════════════════════════════════════════════════════════════
// mushu/gpu/textures — WebGPU Texture Loading and Management
// 
// Usage:
//   import { gpuTexture, gpuDataTexture, gpuCubeMap } from 'mushu/gpu';
//
// Features:
//   • Image texture loading
//   • Data textures (Float32, etc.)
//   • Video textures
//   • Cubemaps
//   • Render targets
//   • Mipmap generation
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// GPU Texture — Load image textures
// ─────────────────────────────────────────────────────────────────────────────

export async function gpuTexture(device, source, options = {}) {
  const {
    flipY = true,
    generateMipmaps = true,
    addressModeU = 'repeat',
    addressModeV = 'repeat',
    magFilter = 'linear',
    minFilter = 'linear',
    mipmapFilter = 'linear',
  } = options;

  let imageBitmap;

  if (typeof source === 'string') {
    const response = await fetch(source);
    const blob = await response.blob();
    imageBitmap = await createImageBitmap(blob, { imageOrientation: flipY ? 'flipY' : 'none' });
  } else if (source instanceof HTMLImageElement) {
    await source.decode?.();
    imageBitmap = await createImageBitmap(source, { imageOrientation: flipY ? 'flipY' : 'none' });
  } else if (source instanceof ImageBitmap) {
    imageBitmap = source;
  } else {
    throw new Error('Unsupported texture source type');
  }

  const mipLevelCount = generateMipmaps
    ? Math.floor(Math.log2(Math.max(imageBitmap.width, imageBitmap.height))) + 1
    : 1;

  const texture = device.createTexture({
    size: [imageBitmap.width, imageBitmap.height],
    mipLevelCount,
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT
  });

  device.queue.copyExternalImageToTexture(
    { source: imageBitmap },
    { texture },
    [imageBitmap.width, imageBitmap.height]
  );

  // Generate mipmaps using compute or render
  if (generateMipmaps && mipLevelCount > 1) {
    await generateMips(device, texture, imageBitmap.width, imageBitmap.height, mipLevelCount);
  }

  const sampler = device.createSampler({
    addressModeU,
    addressModeV,
    magFilter,
    minFilter,
    mipmapFilter,
  });

  return {
    texture,
    sampler,
    width: imageBitmap.width,
    height: imageBitmap.height,
    mipLevelCount,

    destroy() {
      texture.destroy();
    }
  };
}

/**
 * Create a GPU texture from an image/video/source and return `{ texture, sampler, width, height }`.
 * @param {GPUDevice} device
 * @param {(string|HTMLImageElement|ImageBitmap)} source
 * @param {Object} [options]
 * @returns {Promise<{texture:GPUTexture, sampler:GPUSampler, width:number, height:number, mipLevelCount:number, destroy:function()}>} 
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mipmap Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate mipmaps for a GPU texture using render passes and blits where available.
 * @param {GPUDevice} device The GPU device.
 * @param {GPUTexture} texture The texture to generate mips for.
 * @param {number} width Base-level width.
 * @param {number} height Base-level height.
 * @param {number} mipLevelCount Number of mip levels to generate.
 * @returns {Promise<void>} Resolves when mip generation commands have been submitted.
 */
async function generateMips(device, texture, width, height, mipLevelCount) {
  const mipmapShader = device.createShaderModule({
    code: /* wgsl */`
      @group(0) @binding(0) var src: texture_2d<f32>;
      @group(0) @binding(1) var dst: texture_storage_2d<rgba8unorm, write>;

      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        let dstSize = textureDimensions(dst);
        if (id.x >= dstSize.x || id.y >= dstSize.y) { return; }
        
        let srcCoord = vec2<i32>(id.xy) * 2;
        let p00 = textureLoad(src, srcCoord, 0);
        let p10 = textureLoad(src, srcCoord + vec2<i32>(1, 0), 0);
        let p01 = textureLoad(src, srcCoord + vec2<i32>(0, 1), 0);
        let p11 = textureLoad(src, srcCoord + vec2<i32>(1, 1), 0);
        
        textureStore(dst, vec2<i32>(id.xy), (p00 + p10 + p01 + p11) * 0.25);
      }
    `
  });

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: mipmapShader, entryPoint: 'main' }
  });

  let currentWidth = width;
  let currentHeight = height;

  for (let level = 1; level < mipLevelCount; level++) {
    const nextWidth = Math.max(1, currentWidth >> 1);
    const nextHeight = Math.max(1, currentHeight >> 1);

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1 }) },
        { binding: 1, resource: texture.createView({ baseMipLevel: level, mipLevelCount: 1 }) }
      ]
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(nextWidth / 8), Math.ceil(nextHeight / 8));
    pass.end();
    device.queue.submit([encoder.finish()]);

    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Texture — Create textures from raw data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a GPU-side data texture (wgpu) for buffer-backed data uploads.
 * @param {GPUDevice} device The WebGPU device.
 * @param {object} [options]
 * @returns {object} GPU texture wrapper with update helpers.
 */
export function gpuDataTexture(device, options = {}) {
  const {
    width = 256,
    height = 256,
    data = null,                 // Float32Array, Uint8Array, etc.
    format = 'rgba32float',      // rgba8unorm, rgba16float, rgba32float, r32float, etc.
    usage = 'sampled',           // 'sampled', 'storage', 'both'
    addressModeU = 'clamp-to-edge',
    addressModeV = 'clamp-to-edge',
    magFilter = 'nearest',
    minFilter = 'nearest',
  } = options;

  // Determine usage flags
  let usageFlags = GPUTextureUsage.COPY_DST;
  if (usage === 'sampled' || usage === 'both') {
    usageFlags |= GPUTextureUsage.TEXTURE_BINDING;
  }
  if (usage === 'storage' || usage === 'both') {
    usageFlags |= GPUTextureUsage.STORAGE_BINDING;
  }

  const texture = device.createTexture({
    size: [width, height],
    format,
    usage: usageFlags
  });

  if (data) {
    const bytesPerPixel = getBytesPerPixel(format);
    const bytesPerRow = Math.ceil(width * bytesPerPixel / 256) * 256;  // Must be 256-aligned

    device.queue.writeTexture(
      { texture },
      data,
      { bytesPerRow, rowsPerImage: height },
      [width, height]
    );
  }

  const sampler = device.createSampler({
    addressModeU,
    addressModeV,
    magFilter,
    minFilter,
  });

  return {
    texture,
    sampler,
    width,
    height,
    format,

    update(newData) {
      const bytesPerPixel = getBytesPerPixel(format);
      const bytesPerRow = Math.ceil(width * bytesPerPixel / 256) * 256;
      device.queue.writeTexture(
        { texture },
        newData,
        { bytesPerRow, rowsPerImage: height },
        [width, height]
      );
    },

    destroy() {
      texture.destroy();
    }
  };
}

/**
 * Create a GPU data texture and optionally upload raw pixel data.
 * @param {GPUDevice} device
 * @param {Object} [options]
 * @returns {{texture:GPUTexture, sampler:GPUSampler, width:number, height:number, format:string, update:function(Uint8Array|Float32Array)}}
 */

/**
 * Return the byte size per pixel for a given texture format.
 * @param {string} format The texture format string (e.g., 'rgba8unorm').
 * @returns {number} Bytes per pixel for the format.
 */
function getBytesPerPixel(format) {
  const sizes = {
    'r8unorm': 1,
    'rg8unorm': 2,
    'rgba8unorm': 4,
    'r16float': 2,
    'rg16float': 4,
    'rgba16float': 8,
    'r32float': 4,
    'rg32float': 8,
    'rgba32float': 16,
  };
  return sizes[format] || 4;
}

// ─────────────────────────────────────────────────────────────────────────────
// Video Texture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a GPU texture which is periodically updated from a video source.
 * @param {GPUDevice} device The WebGPU device.
 * @param {HTMLVideoElement|string} videoSource Video element or URL.
 * @param {object} [options]
 * @returns {object} GPU texture wrapper that updates from the video.
 */
export function gpuVideoTexture(device, videoSource, options = {}) {
  const {
    autoplay = true,
    loop = true,
    muted = true,
  } = options;

  let video;
  if (typeof videoSource === 'string') {
    video = document.createElement('video');
    video.src = videoSource;
    video.crossOrigin = 'anonymous';
    video.loop = loop;
    video.muted = muted;
    video.playsInline = true;
    if (autoplay) video.play();
  } else {
    video = videoSource;
  }

  // For video, we use external texture
  let externalTexture = null;

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  return {
    video,
    sampler,

    get width() { return video.videoWidth; },
    get height() { return video.videoHeight; },

    // Call this each frame to get updated texture
    getExternalTexture() {
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        externalTexture = device.importExternalTexture({ source: video });
      }
      return externalTexture;
    },

    play() { video.play(); },
    pause() { video.pause(); },

    destroy() {
      if (typeof videoSource === 'string') {
        video.pause();
        video.src = '';
      }
    }
  };
}

/**
 * Create a GPU-backed texture for a video element or URL.
 * @param {GPUDevice} device
 * @param {(string|HTMLVideoElement)} videoSource
 * @param {Object} [options]
 * @returns {Promise<{texture:GPUTexture, sampler:GPUSampler, width:number, height:number, destroy:function}>}
 */

// ─────────────────────────────────────────────────────────────────────────────
// Cubemap Texture
// ─────────────────────────────────────────────────────────────────────────────

export async function gpuCubeMap(device, sources, options = {}) {
  // sources: array of 6 URLs or image elements [+x, -x, +y, -y, +z, -z]
  const {
    flipY = false,
    generateMipmaps = true,
  } = options;

  // Load all face images
  const imageBitmaps = await Promise.all(
    sources.map(async (src) => {
      if (typeof src === 'string') {
        const response = await fetch(src);
        const blob = await response.blob();
        return createImageBitmap(blob, { imageOrientation: flipY ? 'flipY' : 'none' });
      }
      return createImageBitmap(src, { imageOrientation: flipY ? 'flipY' : 'none' });
    })
  );

  const size = imageBitmaps[0].width;
  const mipLevelCount = generateMipmaps
    ? Math.floor(Math.log2(size)) + 1
    : 1;

  const texture = device.createTexture({
    size: [size, size, 6],
    dimension: '2d',
    mipLevelCount,
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT
  });

  // Copy each face
  for (let i = 0; i < 6; i++) {
    device.queue.copyExternalImageToTexture(
      { source: imageBitmaps[i] },
      { texture, origin: [0, 0, i] },
      [size, size]
    );
  }

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: generateMipmaps ? 'linear' : 'nearest',
  });

  return {
    texture,
    sampler,
    size,
    mipLevelCount,

    createView() {
      return texture.createView({ dimension: 'cube' });
    },

    destroy() {
      texture.destroy();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Render Target
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create GPU-side render target textures / views for offscreen rendering.
 * @param {GPUDevice} device The WebGPU device.
 * @param {object} [options]
 * @returns {object} Render target containing texture, view, and sample count.
 */
export function gpuRenderTarget(device, options = {}) {
  const {
    width = 512,
    height = 512,
    format = 'rgba16float',
    samples = 1,                 // MSAA samples (1, 4)
    depth = true,
    depthFormat = 'depth24plus',
  } = options;

  const colorTexture = device.createTexture({
    size: [width, height],
    sampleCount: samples,
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  });

  // For MSAA, we need a resolve target
  let resolveTexture = null;
  if (samples > 1) {
    resolveTexture = device.createTexture({
      size: [width, height],
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
  }

  let depthTexture = null;
  if (depth) {
    depthTexture = device.createTexture({
      size: [width, height],
      sampleCount: samples,
      format: depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  return {
    colorTexture,
    resolveTexture,
    depthTexture,
    sampler,
    width,
    height,
    format,
    samples,

    // Get the texture to sample from (resolve texture if MSAA, otherwise color)
    get texture() {
      return samples > 1 ? resolveTexture : colorTexture;
    },

    // Create color attachment for render pass
    colorAttachment(loadOp = 'clear', clearValue = [0, 0, 0, 1]) {
      const attachment = {
        view: colorTexture.createView(),
        loadOp,
        storeOp: 'store',
      };

      if (loadOp === 'clear') {
        attachment.clearValue = clearValue;
      }

      if (samples > 1) {
        attachment.resolveTarget = resolveTexture.createView();
      }

      return attachment;
    },

    // Create depth attachment for render pass
    depthAttachment(depthLoadOp = 'clear', depthClearValue = 1.0) {
      if (!depthTexture) return null;

      return {
        view: depthTexture.createView(),
        depthLoadOp,
        depthStoreOp: 'store',
        depthClearValue,
      };
    },

    resize(newWidth, newHeight) {
      // Recreate textures with new size
      colorTexture.destroy();
      if (resolveTexture) resolveTexture.destroy();
      if (depthTexture) depthTexture.destroy();

      const newTarget = gpuRenderTarget(device, {
        width: newWidth,
        height: newHeight,
        format,
        samples,
        depth,
        depthFormat
      });

      Object.assign(this, newTarget);
    },

    destroy() {
      colorTexture.destroy();
      if (resolveTexture) resolveTexture.destroy();
      if (depthTexture) depthTexture.destroy();
    }
  };
}

/**
 * Create an offscreen GPU render target texture helper.
 * @param {GPUDevice} device
 * @param {Object} [options]
 * @returns {{texture:GPUTexture, view:GPUTextureView, destroy:function()}}
 */

// ─────────────────────────────────────────────────────────────────────────────
// Noise Texture (procedurally generated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a GPU-side noise texture uploaded to the device.
 * @param {GPUDevice} device The WebGPU device.
 * @param {object} [options]
 * @returns {object} Noise texture wrapper for GPU sampling.
 */
export function gpuNoiseTexture(device, options = {}) {
  const {
    size = 256,
    type = 'white',              // 'white', 'perlin'
    format = 'rgba8unorm',
  } = options;

  let data;
  if (format === 'rgba8unorm') {
    data = new Uint8Array(size * size * 4);
    if (type === 'white') {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.random() * 255;
        data[i + 1] = Math.random() * 255;
        data[i + 2] = Math.random() * 255;
        data[i + 3] = 255;
      }
    }
  } else {
    data = new Float32Array(size * size * 4);
    if (type === 'white') {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.random();
        data[i + 1] = Math.random();
        data[i + 2] = Math.random();
        data[i + 3] = 1;
      }
    }
  }

  return gpuDataTexture(device, {
    width: size,
    height: size,
    data,
    format,
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
    minFilter: 'linear',
  });
}

/**
 * Create a procedural noise texture on the GPU (returns {texture, sampler}).
 * @param {GPUDevice} device
 * @param {Object} [options]
 * @returns {{texture:GPUTexture, sampler:GPUSampler, width:number, height:number}}
 */

// ─────────────────────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────────────────────

export default {
  gpuTexture,
  gpuDataTexture,
  gpuVideoTexture,
  gpuCubeMap,
  gpuRenderTarget,
  gpuNoiseTexture,
};

/**
 * mushu/gpu — WebGPU module index and exports.
 * Re-exports GPU runtime, geometry, texture and shader helpers suitable for
 * building WebGPU-based demos and pipelines.
 * @module mushu/gpu
 */
// ═══════════════════════════════════════════════════════════════════════════
// mushu/gpu — WebGPU Module Exports
// ═══════════════════════════════════════════════════════════════════════════

// Core WebGPU runtime
export { gpuFlow, yoGPU, hasWebGPU, gpu, wgsl } from './gpuFlow.js';

// 3D Geometry and Mesh
export {
  gpuMesh,
  gpuCubeGeometry,
  gpuSphereGeometry,
  gpuPlaneGeometry,
  gpuTorusGeometry,
  parseOBJ,
  gpuInstancedMesh,
} from './gpuGeometry.js';

// Textures
export {
  gpuTexture,
  gpuDataTexture,
  gpuVideoTexture,
  gpuCubeMap,
  gpuRenderTarget,
  gpuNoiseTexture,
} from './gpuTextures.js';

// 3D Shaders
export {
  wgslStructs,
  wgslStandardVertex,
  wgslBlinnPhongFragment,
  wgslPBRFragment,
  wgslUnlitFragment,
  wgslNormalFragment,
  wgslInstancedVertex,
  wgslMath,
  wgslNoise,
  gpu3dPipeline,
  createCameraBuffer,
  createModelBuffer,
  createLightBuffer,
  createMaterialBuffer,
} from './gpuShader3d.js';

export { default } from './gpuFlow.js';

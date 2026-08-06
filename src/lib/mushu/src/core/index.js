/**
 * mushu/core — Core WebGL2 runtime and utility exports.
 * Re-exports runtime builders and plugins for convenient top-level imports.
 * @module mushu/core
 */
// ═══════════════════════════════════════════════════════════════════════════
// mushu/core — WebGL2 Core Module Exports
// ═══════════════════════════════════════════════════════════════════════════

// Flow runtime and plugins
export {
  flow,
  yo,  // Legacy alias
  clear,
  quad,
  shader,
  uniform,
  fps,
  simulation,
  glsl
} from './flow.js';

export { Loader } from './loader.js';

// 3D Model Loading System
export {
  loadModel,
  loadMTL,
  ModelLoader,
  ModelFormatLoader,
  registerModelFormat,
  createMaterialFromMTL,
} from './model.js';

// 3D Geometry and VAO utilities
export {
  vao,
  mesh,
  plane,
  cube,
  sphere,
  cylinder,
  cone,
  crystal,
  torus,
  fullscreenQuad,
  loadOBJ,
  obj,
  custom,
  lines,
  lineSegments,
  points,
} from './geometry.js';

// Texture loading and management
export {
  texture,
  dataTexture,
  videoTexture,
  webcamTexture,
  cubeMap,
  renderTarget,
  noiseTexture,
} from './textures.js';

// 3D Math utilities
export {
  vec3,
  vec4,
  mat4,
  quat,
  camera,
  orbitControls,
  deg2rad,
  rad2deg,
  clamp,
  lerp,
  smoothstep,
} from './transforms.js';

// 3D Shaders
export {
  shader3d,
  pbrShader,
  unlitShader,
  normalShader,
  uvShader,
  depthShader,
  defaultVertex,
  defaultFragment,
  pbrVertex,
  pbrFragment,
  unlitVertex,
  unlitFragment,
  wireframeVertex,
  wireframeFragment,
} from './shader3d.js';

// Material System
export {
  Material,
  BuiltInMaterial,
  PBRMaterial,
  PhysicalMaterial,
  ShaderMaterial,
  material,
  materials,
} from './material.js';

// Scene Graph
export {
  Scene,
  mushuScene,
  yoScene,
  SceneObject,
  object,
} from './scene.js';

export { default } from './flow.js';

/**
 * mushu/glsl — Module index for GLSL snippets and presets.
 * Re-exports common shader snippet symbols from `shaders.js`.
 * @module mushu/glsl
 */
// ═══════════════════════════════════════════════════════════════════════════
// mushu/glsl — GLSL Module Exports
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Hash functions
  hash1, hash2, hash3, hash2to2, hash,

  // Noise
  noise2D, noise3D, noise,
  simplex2D,

  // FBM
  fbm2D, fbm3D, fbm,

  // Voronoi
  voronoi,

  // Domain warping
  warp,

  // 3D Lighting
  lighting,
  pbr,

  // 3D Math
  math3d,
  normalMapping,

  // SDF
  sdf,

  // Colors
  color,

  // Post-processing
  tonemapping,

  // Raymarching
  raymarching,

  all,
  GLSL,
} from './shaders.js';

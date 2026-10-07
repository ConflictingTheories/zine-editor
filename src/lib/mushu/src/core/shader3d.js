/**
 * mushu/core/shader3d — 3D shader utilities and preset materials.
 *
 * Exposes default vertex/fragment strings and helper shader snippets for PBR,
 * unlit materials, and normal mapping. These are GLSL snippets intended for
 * use with the WebGL2 `flow()` runtime.
 * @module mushu/core/shader3d
 */
// ═══════════════════════════════════════════════════════════════════════════
// mushu/core/shader3d — 3D Shader Support
// 
// Usage:
//   mushu(canvas).flow()
//     .use(camera({ position: [0, 0, 5] }))
//     .use(shader3d(vertexCode, fragmentCode))
//     .use(cube())
//     .go()
//
// Supports:
//   • Custom vertex and fragment shaders
//   • Automatic uniform binding (matrices, camera, lights)
//   • Material support
//   • Multiple render passes
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Default Shaders
// ─────────────────────────────────────────────────────────────────────────────

export const defaultVertex = /* glsl */`#version 300 es
precision highp float;

// Attributes
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec2 uv;
layout(location = 3) in vec4 color;

// Uniforms
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewProjectionMatrix;
uniform mat4 normalMatrix;

// Varyings (outputs to fragment shader)
out vec3 vPosition;
out vec3 vNormal;
out vec2 vUv;
out vec4 vColor;
out vec3 vWorldPosition;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vPosition = position;
  vNormal = mat3(normalMatrix) * normal;
  vUv = uv;
  vColor = color;
  
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}`;

export const defaultFragment = /* glsl */`#version 300 es
precision highp float;

// Varyings from vertex shader
in vec3 vPosition;
in vec3 vNormal;
in vec2 vUv;
in vec4 vColor;
in vec3 vWorldPosition;

// Uniforms
uniform float time;
uniform vec3 cameraPosition;
uniform vec3 lightPosition;
uniform vec3 lightColor;
uniform vec3 ambientColor;
uniform vec3 diffuseColor;
uniform vec3 specularColor;
uniform float shininess;

out vec4 fragColor;

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(lightPosition - vWorldPosition);
  vec3 V = normalize(cameraPosition - vWorldPosition);
  vec3 H = normalize(L + V);
  
  // Ambient
  vec3 ambient = ambientColor * diffuseColor;
  
  // Diffuse
  float diff = max(dot(N, L), 0.0);
  vec3 diffuse = diff * lightColor * diffuseColor;
  
  // Specular (Blinn-Phong)
  float spec = pow(max(dot(N, H), 0.0), shininess);
  vec3 specular = spec * lightColor * specularColor;
  
  vec3 color = ambient + diffuse + specular;
  fragColor = vec4(color, 1.0);
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Shader3D Plugin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a 3D shader program helper from vertex and fragment GLSL sources.
 * @param {string} [vertSource] Vertex GLSL source.
 * @param {string} [fragSource] Fragment GLSL source.
 * @param {object} [options]
 * @returns {object} Compiled shader program helper with `use()` and uniform setters.
 */
export function shader3d(vertSource = defaultVertex, fragSource = defaultFragment, options = {}) {
  const {
    uniforms = {},              // Custom uniforms
    defines = {},               // Shader defines (#define NAME value)
    transparent = false,        // Enable alpha blending
    depthTest = true,           // Enable depth testing
    depthWrite = true,          // Write to depth buffer
    cullFace = 'BACK',          // BACK, FRONT, NONE
    blendSrc = 'SRC_ALPHA',     // Blend source factor
    blendDst = 'ONE_MINUS_SRC_ALPHA', // Blend dest factor
  } = options;

  let program = null;
  let uniformLocations = {};
  let modelMatrix = new Float32Array(16);
  let normalMatrix = new Float32Array(16);

  // Default material
  const material = {
    ambientColor: [0.1, 0.1, 0.1],
    diffuseColor: [0.8, 0.8, 0.8],
    specularColor: [1.0, 1.0, 1.0],
    shininess: 32.0,
    ...options.material
  };

  // Default light
  const light = {
    position: [5, 5, 5],
    color: [1.0, 1.0, 1.0],
    ...options.light
  };

  // Identity matrix helper
  const identity = (out) => {
    out.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  };

  // Compile shader program
  const compile = (gl) => {
    // Add defines
    let defineStr = '';
    for (const [name, value] of Object.entries(defines)) {
      defineStr += `#define ${name} ${value}\n`;
    }

    const vs = gl.createShader(gl.VERTEX_SHADER);
    const vsSource = vertSource.includes('#version') ? vertSource :
      `#version 300 es\n${defineStr}${vertSource}`;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vs));
      return null;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    const fsSource = fragSource.includes('#version') ? fragSource :
      `#version 300 es\nprecision highp float;\n${defineStr}${fragSource}`;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fs));
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

  // Cache uniform locations
  const cacheUniforms = (gl) => {
    const uniforms = [
      'modelMatrix', 'viewMatrix', 'projectionMatrix', 'viewProjectionMatrix', 'normalMatrix',
      'time', 'delta', 'resolution', 'cameraPosition',
      'lightPosition', 'lightColor',
      'ambientColor', 'diffuseColor', 'specularColor', 'shininess'
    ];

    for (const name of uniforms) {
      uniformLocations[name] = gl.getUniformLocation(program, name);
    }
  };

  // Calculate normal matrix from model matrix
  const computeNormalMatrix = (model) => {
    // For uniform scaling, normal matrix is just transpose of inverse of upper-left 3x3
    // Simplified version: just copy the rotation part
    normalMatrix[0] = model[0]; normalMatrix[1] = model[1]; normalMatrix[2] = model[2]; normalMatrix[3] = 0;
    normalMatrix[4] = model[4]; normalMatrix[5] = model[5]; normalMatrix[6] = model[6]; normalMatrix[7] = 0;
    normalMatrix[8] = model[8]; normalMatrix[9] = model[9]; normalMatrix[10] = model[10]; normalMatrix[11] = 0;
    normalMatrix[12] = 0; normalMatrix[13] = 0; normalMatrix[14] = 0; normalMatrix[15] = 1;
  };

  return {
    name: 'shader3d',

    init(ctx) {
      const gl = ctx.gl;
      program = compile(gl);
      if (!program) return;

      cacheUniforms(gl);
      identity(modelMatrix);
      identity(normalMatrix);

      ctx.program = program;
      ctx.state.shader3d = this;
    },

    render(ctx) {
      if (!program) return;
      const gl = ctx.gl;

      // Set render state
      if (depthTest) {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
      } else {
        gl.disable(gl.DEPTH_TEST);
      }

      gl.depthMask(depthWrite);

      if (cullFace === 'NONE') {
        gl.disable(gl.CULL_FACE);
      } else {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl[cullFace]);
      }

      if (transparent) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl[blendSrc], gl[blendDst]);
      } else {
        gl.disable(gl.BLEND);
      }

      gl.useProgram(program);
      ctx.program = program;

      // Set built-in uniforms
      const locs = uniformLocations;

      if (locs.time) gl.uniform1f(locs.time, ctx.time);
      if (locs.delta) gl.uniform1f(locs.delta, ctx.delta);
      if (locs.resolution) gl.uniform2f(locs.resolution, ctx.width, ctx.height);

      // Model matrix (identity by default, can be set by mesh)
      if (locs.modelMatrix) gl.uniformMatrix4fv(locs.modelMatrix, false, modelMatrix);
      if (locs.normalMatrix) {
        computeNormalMatrix(modelMatrix);
        gl.uniformMatrix4fv(locs.normalMatrix, false, normalMatrix);
      }

      // Camera matrices (set by camera plugin)
      if (ctx.state.camera) {
        const cam = ctx.state.camera;
        if (locs.viewMatrix) gl.uniformMatrix4fv(locs.viewMatrix, false, cam.view);
        if (locs.projectionMatrix) gl.uniformMatrix4fv(locs.projectionMatrix, false, cam.projection);
        if (locs.viewProjectionMatrix) gl.uniformMatrix4fv(locs.viewProjectionMatrix, false, cam.viewProjection);
        if (locs.cameraPosition) gl.uniform3fv(locs.cameraPosition, cam.position);
      }

      // Light
      if (locs.lightPosition) gl.uniform3fv(locs.lightPosition, light.position);
      if (locs.lightColor) gl.uniform3fv(locs.lightColor, light.color);

      // Material
      if (locs.ambientColor) gl.uniform3fv(locs.ambientColor, material.ambientColor);
      if (locs.diffuseColor) gl.uniform3fv(locs.diffuseColor, material.diffuseColor);
      if (locs.specularColor) gl.uniform3fv(locs.specularColor, material.specularColor);
      if (locs.shininess) gl.uniform1f(locs.shininess, material.shininess);

      // Custom uniforms
      for (const [name, valueFn] of Object.entries(uniforms)) {
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
        } else if (value.length === 9) {
          gl.uniformMatrix3fv(loc, false, value);
        } else if (value.length === 16) {
          gl.uniformMatrix4fv(loc, false, value);
        }
      }
    },

    // API for runtime changes
    setModelMatrix(m) {
      modelMatrix = m;
    },

    setMaterial(props) {
      Object.assign(material, props);
    },

    setLight(props) {
      Object.assign(light, props);
    },

    setUniform(name, value, ctx) {
      if (!ctx || !program) return;
      const gl = ctx.gl;
      gl.useProgram(program);
      const loc = gl.getUniformLocation(program, name);
      if (!loc) return;
      if (typeof value === 'number') {
        gl.uniform1f(loc, value);
      } else if (value.length === 2) {
        gl.uniform2fv(loc, value);
      } else if (value.length === 3) {
        gl.uniform3fv(loc, value);
      } else if (value.length === 4) {
        gl.uniform4fv(loc, value);
      } else if (value.length === 16) {
        gl.uniformMatrix4fv(loc, false, value);
      }
    },

    destroy(ctx) {
      if (program) ctx.gl.deleteProgram(program);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PBR (Physically Based Rendering) Shader
// ─────────────────────────────────────────────────────────────────────────────

export const pbrVertex = defaultVertex;

export const pbrFragment = /* glsl */`#version 300 es
precision highp float;

in vec3 vPosition;
in vec3 vNormal;
in vec2 vUv;
in vec3 vWorldPosition;

uniform float time;
uniform vec3 cameraPosition;
uniform vec3 lightPosition;
uniform vec3 lightColor;

// PBR Material
uniform vec3 albedo;
uniform float metallic;
uniform float roughness;
uniform float ao;

out vec4 fragColor;

const float PI = 3.14159265359;

// GGX/Trowbridge-Reitz normal distribution
float DistributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  return a2 / (PI * denom * denom);
}

// Schlick-GGX geometry function
float GeometrySchlickGGX(float NdotV, float roughness) {
  float r = (roughness + 1.0);
  float k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  return GeometrySchlickGGX(NdotV, roughness) * GeometrySchlickGGX(NdotL, roughness);
}

// Fresnel-Schlick
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPosition);
  vec3 L = normalize(lightPosition - vWorldPosition);
  vec3 H = normalize(V + L);
  
  // Surface reflection at zero incidence (F0)
  vec3 F0 = vec3(0.04);
  F0 = mix(F0, albedo, metallic);
  
  // Cook-Torrance BRDF
  float NDF = DistributionGGX(N, H, roughness);
  float G = GeometrySmith(N, V, L, roughness);
  vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
  
  vec3 numerator = NDF * G * F;
  float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
  vec3 specular = numerator / denominator;
  
  vec3 kS = F;
  vec3 kD = vec3(1.0) - kS;
  kD *= 1.0 - metallic;
  
  float NdotL = max(dot(N, L), 0.0);
  vec3 Lo = (kD * albedo / PI + specular) * lightColor * NdotL;
  
  // Ambient
  vec3 ambient = vec3(0.03) * albedo * ao;
  vec3 color = ambient + Lo;
  
  // HDR tonemapping
  color = color / (color + vec3(1.0));
  // Gamma correction
  color = pow(color, vec3(1.0 / 2.2));
  
  fragColor = vec4(color, 1.0);
}`;

/**
 * Create a PBR-ready shader preset (GGX/metalness-roughness).
 * @param {object} [options]
 * @returns {object} Shader helper implementing PBR shading.
 */
export function pbrShader(options = {}) {
  return shader3d(pbrVertex, pbrFragment, {
    uniforms: {
      albedo: options.albedo || [0.8, 0.8, 0.8],
      metallic: options.metallic || 0.0,
      roughness: options.roughness || 0.5,
      ao: options.ao || 1.0,
      ...options.uniforms
    },
    ...options
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Unlit Shader (simple color/texture without lighting)
// ─────────────────────────────────────────────────────────────────────────────

export const unlitVertex = /* glsl */`#version 300 es
precision highp float;

layout(location = 0) in vec3 position;
layout(location = 2) in vec2 uv;
layout(location = 3) in vec4 color;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

out vec2 vUv;
out vec4 vColor;

void main() {
  vUv = uv;
  vColor = color;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;

export const unlitFragment = /* glsl */`#version 300 es
precision highp float;

in vec2 vUv;
in vec4 vColor;

uniform vec3 color;
uniform sampler2D diffuseMap;
uniform bool useTexture;

out vec4 fragColor;

void main() {
  if (useTexture) {
    fragColor = texture(diffuseMap, vUv) * vec4(color, 1.0);
  } else {
    fragColor = vec4(color, 1.0) * vColor;
  }
}`;

/**
 * Create an unlit shader preset (simple textured/color output).
 * @param {object} [options]
 * @returns {object} Shader helper for unlit rendering.
 */
export function unlitShader(options = {}) {
  return shader3d(unlitVertex, unlitFragment, {
    uniforms: {
      color: options.color || [1, 1, 1],
      useTexture: options.useTexture || false,
      ...options.uniforms
    },
    ...options
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Normal Visualization Shader (for debugging)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a shader that outputs normals as color for debugging.
 * @param {object} [options]
 * @returns {object} Shader helper that visualizes normals.
 */
export function normalShader(options = {}) {
  const frag = /* glsl */`#version 300 es
precision highp float;

in vec3 vNormal;
out vec4 fragColor;

void main() {
  vec3 N = normalize(vNormal);
  fragColor = vec4(N * 0.5 + 0.5, 1.0);
}`;

  return shader3d(defaultVertex, frag, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// UV Visualization Shader (for debugging)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a shader that outputs UV coordinates as color for debugging.
 * @param {object} [options]
 * @returns {object} Shader helper that visualizes UVs.
 */
export function uvShader(options = {}) {
  const frag = /* glsl */`#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

void main() {
  fragColor = vec4(vUv, 0.0, 1.0);
}`;

  return shader3d(defaultVertex, frag, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wireframe Shader
// ─────────────────────────────────────────────────────────────────────────────

export const wireframeVertex = /* glsl */`#version 300 es
precision highp float;

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 barycentric;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

out vec3 vBarycentric;

void main() {
  vBarycentric = barycentric;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;

export const wireframeFragment = /* glsl */`#version 300 es
precision highp float;

in vec3 vBarycentric;

uniform vec3 lineColor;
uniform vec3 fillColor;
uniform float lineWidth;

out vec4 fragColor;

float edgeFactor() {
  vec3 d = fwidth(vBarycentric);
  vec3 a3 = smoothstep(vec3(0.0), d * lineWidth, vBarycentric);
  return min(min(a3.x, a3.y), a3.z);
}

void main() {
  float edge = edgeFactor();
  fragColor = vec4(mix(lineColor, fillColor, edge), 1.0);
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Depth Shader (for shadow mapping etc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a shader that renders linear depth for shadowing/debugging.
 * @param {object} [options]
 * @returns {object} Shader helper that outputs depth.
 */
export function depthShader(options = {}) {
  const frag = /* glsl */`#version 300 es
precision highp float;

uniform float near;
uniform float far;

out vec4 fragColor;

float linearizeDepth(float depth) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - z * (far - near));
}

void main() {
  float depth = linearizeDepth(gl_FragCoord.z) / far;
  fragColor = vec4(vec3(depth), 1.0);
}`;

  return shader3d(defaultVertex, frag, {
    uniforms: {
      near: options.near || 0.1,
      far: options.far || 100.0,
      ...options.uniforms
    },
    ...options
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────────────────────

export default {
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
};

/**
 * mushu/gpu/shader3d — WebGPU 3D shader utilities and WGSL snippets.
 *
 * Exposes common WGSL struct definitions and prebuilt shader snippets for
 * 3D rendering and PBR materials.
 * @module mushu/gpu/shader3d
 */
// ═══════════════════════════════════════════════════════════════════════════
// mushu/gpu/shader3d — WebGPU 3D Shader Support
// 
// Usage:
//   import { gpu3dPipeline, wgslVertex, wgslFragment } from 'mushu/gpu';
//
// Features:
//   • Pre-built vertex/fragment shaders for 3D
//   • PBR materials
//   • Common shader utilities
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// WGSL Shader Library — Common Structures
// ─────────────────────────────────────────────────────────────────────────────

export const wgslStructs = /* wgsl */`
// Camera uniform buffer
struct Camera {
  viewMatrix: mat4x4<f32>,
  projectionMatrix: mat4x4<f32>,
  viewProjectionMatrix: mat4x4<f32>,
  position: vec3<f32>,
  _pad: f32,
}

// Per-object uniforms
struct Model {
  modelMatrix: mat4x4<f32>,
  normalMatrix: mat4x4<f32>,
}

// Scene uniforms
struct Scene {
  time: f32,
  deltaTime: f32,
  frame: u32,
  _pad: u32,
}

// Light structure
struct Light {
  position: vec3<f32>,
  _pad0: f32,
  color: vec3<f32>,
  intensity: f32,
  direction: vec3<f32>,
  _pad1: f32,
}

// PBR Material
struct PBRMaterial {
  albedo: vec3<f32>,
  metallic: f32,
  roughness: f32,
  ao: f32,
  _pad: vec2<f32>,
}

// Standard material
struct Material {
  ambient: vec3<f32>,
  _pad0: f32,
  diffuse: vec3<f32>,
  _pad1: f32,
  specular: vec3<f32>,
  shininess: f32,
}

// Vertex input
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec4<f32>,
}

// Vertex output / Fragment input
struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) worldPosition: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec4<f32>,
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Standard Vertex Shader
// ─────────────────────────────────────────────────────────────────────────────

export const wgslStandardVertex = /* wgsl */`
${wgslStructs}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<uniform> model: Model;

@vertex
fn main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  
  let worldPos = model.modelMatrix * vec4<f32>(in.position, 1.0);
  out.worldPosition = worldPos.xyz;
  out.clipPosition = camera.viewProjectionMatrix * worldPos;
  out.normal = (model.normalMatrix * vec4<f32>(in.normal, 0.0)).xyz;
  out.uv = in.uv;
  out.color = in.color;
  
  return out;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Blinn-Phong Fragment Shader
// ─────────────────────────────────────────────────────────────────────────────

export const wgslBlinnPhongFragment = /* wgsl */`
${wgslStructs}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(2) @binding(0) var<uniform> material: Material;
@group(2) @binding(1) var<uniform> light: Light;

@fragment
fn main(in: VertexOutput) -> @location(0) vec4<f32> {
  let N = normalize(in.normal);
  let L = normalize(light.position - in.worldPosition);
  let V = normalize(camera.position - in.worldPosition);
  let H = normalize(L + V);
  
  // Ambient
  let ambient = material.ambient * material.diffuse;
  
  // Diffuse
  let diff = max(dot(N, L), 0.0);
  let diffuse = diff * light.color * material.diffuse * light.intensity;
  
  // Specular
  let spec = pow(max(dot(N, H), 0.0), material.shininess);
  let specular = spec * light.color * material.specular * light.intensity;
  
  let color = ambient + diffuse + specular;
  return vec4<f32>(color, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// PBR Fragment Shader
// ─────────────────────────────────────────────────────────────────────────────

export const wgslPBRFragment = /* wgsl */`
${wgslStructs}

const PI = 3.14159265359;

@group(0) @binding(0) var<uniform> camera: Camera;
@group(2) @binding(0) var<uniform> material: PBRMaterial;
@group(2) @binding(1) var<uniform> light: Light;

// GGX Normal Distribution Function
fn DistributionGGX(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let NdotH = max(dot(N, H), 0.0);
  let NdotH2 = NdotH * NdotH;
  let denom = NdotH2 * (a2 - 1.0) + 1.0;
  return a2 / (PI * denom * denom);
}

// Geometry function (Schlick-GGX)
fn GeometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

fn GeometrySmith(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
  let NdotV = max(dot(N, V), 0.0);
  let NdotL = max(dot(N, L), 0.0);
  return GeometrySchlickGGX(NdotV, roughness) * GeometrySchlickGGX(NdotL, roughness);
}

// Fresnel (Schlick approximation)
fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

@fragment
fn main(in: VertexOutput) -> @location(0) vec4<f32> {
  let N = normalize(in.normal);
  let V = normalize(camera.position - in.worldPosition);
  let L = normalize(light.position - in.worldPosition);
  let H = normalize(V + L);
  
  // F0 for dielectrics and metals
  var F0 = vec3<f32>(0.04);
  F0 = mix(F0, material.albedo, material.metallic);
  
  // Cook-Torrance BRDF
  let NDF = DistributionGGX(N, H, material.roughness);
  let G = GeometrySmith(N, V, L, material.roughness);
  let F = fresnelSchlick(max(dot(H, V), 0.0), F0);
  
  let numerator = NDF * G * F;
  let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
  let specular = numerator / denominator;
  
  let kS = F;
  var kD = vec3<f32>(1.0) - kS;
  kD = kD * (1.0 - material.metallic);
  
  let NdotL = max(dot(N, L), 0.0);
  let Lo = (kD * material.albedo / PI + specular) * light.color * light.intensity * NdotL;
  
  // Ambient
  let ambient = vec3<f32>(0.03) * material.albedo * material.ao;
  var color = ambient + Lo;
  
  // HDR tonemapping
  color = color / (color + vec3<f32>(1.0));
  // Gamma correction
  color = pow(color, vec3<f32>(1.0 / 2.2));
  
  return vec4<f32>(color, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Unlit Fragment Shader
// ─────────────────────────────────────────────────────────────────────────────

export const wgslUnlitFragment = /* wgsl */`
${wgslStructs}

@group(2) @binding(0) var<uniform> color: vec4<f32>;
@group(2) @binding(1) var albedoTex: texture_2d<f32>;
@group(2) @binding(2) var albedoSampler: sampler;

@fragment
fn main(in: VertexOutput) -> @location(0) vec4<f32> {
  let texColor = textureSample(albedoTex, albedoSampler, in.uv);
  return texColor * color * in.color;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Normal Visualization (Debug)
// ─────────────────────────────────────────────────────────────────────────────

export const wgslNormalFragment = /* wgsl */`
@fragment
fn main(@location(1) normal: vec3<f32>) -> @location(0) vec4<f32> {
  let N = normalize(normal);
  return vec4<f32>(N * 0.5 + 0.5, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Instanced Vertex Shader
// ─────────────────────────────────────────────────────────────────────────────

export const wgslInstancedVertex = /* wgsl */`
${wgslStructs}

struct InstanceInput {
  @location(4) modelCol0: vec4<f32>,
  @location(5) modelCol1: vec4<f32>,
  @location(6) modelCol2: vec4<f32>,
  @location(7) modelCol3: vec4<f32>,
  @location(8) instanceColor: vec4<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;

@vertex
fn main(in: VertexInput, instance: InstanceInput) -> VertexOutput {
  var out: VertexOutput;
  
  let modelMatrix = mat4x4<f32>(
    instance.modelCol0,
    instance.modelCol1,
    instance.modelCol2,
    instance.modelCol3
  );
  
  let worldPos = modelMatrix * vec4<f32>(in.position, 1.0);
  out.worldPosition = worldPos.xyz;
  out.clipPosition = camera.viewProjectionMatrix * worldPos;
  out.normal = (modelMatrix * vec4<f32>(in.normal, 0.0)).xyz;
  out.uv = in.uv;
  out.color = in.color * instance.instanceColor;
  
  return out;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// WGSL Math Utilities
// ─────────────────────────────────────────────────────────────────────────────

export const wgslMath = /* wgsl */`
// Rotate a vector around an axis by an angle
fn rotateAroundAxis(v: vec3<f32>, axis: vec3<f32>, angle: f32) -> vec3<f32> {
  let c = cos(angle);
  let s = sin(angle);
  let t = 1.0 - c;
  let a = normalize(axis);
  
  let m = mat3x3<f32>(
    vec3<f32>(t * a.x * a.x + c,      t * a.x * a.y - s * a.z, t * a.x * a.z + s * a.y),
    vec3<f32>(t * a.x * a.y + s * a.z, t * a.y * a.y + c,      t * a.y * a.z - s * a.x),
    vec3<f32>(t * a.x * a.z - s * a.y, t * a.y * a.z + s * a.x, t * a.z * a.z + c)
  );
  
  return m * v;
}

// Create a look-at matrix
fn lookAt(eye: vec3<f32>, target: vec3<f32>, up: vec3<f32>) -> mat4x4<f32> {
  let zAxis = normalize(eye - target);
  let xAxis = normalize(cross(up, zAxis));
  let yAxis = cross(zAxis, xAxis);
  
  return mat4x4<f32>(
    vec4<f32>(xAxis.x, yAxis.x, zAxis.x, 0.0),
    vec4<f32>(xAxis.y, yAxis.y, zAxis.y, 0.0),
    vec4<f32>(xAxis.z, yAxis.z, zAxis.z, 0.0),
    vec4<f32>(-dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1.0)
  );
}

// Perspective projection matrix
fn perspective(fovY: f32, aspect: f32, near: f32, far: f32) -> mat4x4<f32> {
  let f = 1.0 / tan(fovY * 0.5);
  let nf = 1.0 / (near - far);
  
  return mat4x4<f32>(
    vec4<f32>(f / aspect, 0.0, 0.0, 0.0),
    vec4<f32>(0.0, f, 0.0, 0.0),
    vec4<f32>(0.0, 0.0, (far + near) * nf, -1.0),
    vec4<f32>(0.0, 0.0, 2.0 * far * near * nf, 0.0)
  );
}

// Map value from one range to another
fn remap(value: f32, fromMin: f32, fromMax: f32, toMin: f32, toMax: f32) -> f32 {
  return toMin + (value - fromMin) * (toMax - toMin) / (fromMax - fromMin);
}

// Smoothstep with configurable edges
fn smootherstep(edge0: f32, edge1: f32, x: f32) -> f32 {
  let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// WGSL Noise Functions
// ─────────────────────────────────────────────────────────────────────────────

export const wgslNoise = /* wgsl */`
// Hash function
fn hash(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

fn hash3(p: vec3<f32>) -> f32 {
  let q = fract(p * 0.3183099 + 0.1);
  let q2 = q * 17.0;
  return fract(q2.x * q2.y * q2.z * (q2.x + q2.y + q2.z));
}

// 2D Value Noise
fn noise2D(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  
  let a = hash(i);
  let b = hash(i + vec2<f32>(1.0, 0.0));
  let c = hash(i + vec2<f32>(0.0, 1.0));
  let d = hash(i + vec2<f32>(1.0, 1.0));
  
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 3D Value Noise
fn noise3D(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  
  return mix(
    mix(
      mix(hash3(i), hash3(i + vec3<f32>(1.0, 0.0, 0.0)), u.x),
      mix(hash3(i + vec3<f32>(0.0, 1.0, 0.0)), hash3(i + vec3<f32>(1.0, 1.0, 0.0)), u.x),
      u.y
    ),
    mix(
      mix(hash3(i + vec3<f32>(0.0, 0.0, 1.0)), hash3(i + vec3<f32>(1.0, 0.0, 1.0)), u.x),
      mix(hash3(i + vec3<f32>(0.0, 1.0, 1.0)), hash3(i + vec3<f32>(1.0, 1.0, 1.0)), u.x),
      u.y
    ),
    u.z
  );
}

// FBM (Fractal Brownian Motion)
fn fbm2D(p: vec2<f32>, octaves: i32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  var pos = p;
  
  for (var i = 0; i < octaves; i = i + 1) {
    value = value + amplitude * noise2D(pos * frequency);
    frequency = frequency * 2.0;
    amplitude = amplitude * 0.5;
  }
  
  return value;
}

fn fbm3D(p: vec3<f32>, octaves: i32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  var pos = p;
  
  for (var i = 0; i < octaves; i = i + 1) {
    value = value + amplitude * noise3D(pos * frequency);
    frequency = frequency * 2.0;
    amplitude = amplitude * 0.5;
  }
  
  return value;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// GPU 3D Pipeline Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a GPU pipeline configured for 3D rendering with standard bindings.
 * @param {GPUDevice} device The WebGPU device.
 * @param {object} [options]
 * @returns {GPURenderPipeline} The configured pipeline.
 */
export function gpu3dPipeline(device, options = {}) {
  const {
    vertexShader = wgslStandardVertex,
    fragmentShader = wgslBlinnPhongFragment,
    format = 'bgra8unorm',
    depthFormat = 'depth24plus',
    cullMode = 'back',           // 'none', 'front', 'back'
    frontFace = 'ccw',           // 'ccw', 'cw'
    topology = 'triangle-list',
    blend = null,                // Alpha blending config or null for opaque
    depthWrite = true,
    depthCompare = 'less',
    multisample = 1,
  } = options;

  // Create shader module
  const shaderModule = device.createShaderModule({
    code: vertexShader + '\n' + fragmentShader
  });

  // Vertex buffer layout (matches gpuMesh interleaved format)
  const vertexBufferLayout = {
    arrayStride: 48, // 12 floats * 4 bytes
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x3' },   // position
      { shaderLocation: 1, offset: 12, format: 'float32x3' },  // normal
      { shaderLocation: 2, offset: 24, format: 'float32x2' },  // uv
      { shaderLocation: 3, offset: 32, format: 'float32x4' },  // color
    ]
  };

  // Fragment targets
  const targets = [{
    format,
    ...(blend ? { blend } : {})
  }];

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'main',
      buffers: [vertexBufferLayout]
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'main',
      targets
    },
    primitive: {
      topology,
      cullMode,
      frontFace
    },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: depthWrite,
      depthCompare
    },
    multisample: {
      count: multisample
    }
  });

  return {
    pipeline,
    shaderModule,

    getBindGroupLayout(index) {
      return pipeline.getBindGroupLayout(index);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Uniform Buffer Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a uniform buffer for camera matrices (view/projection) on the GPU.
 * @param {GPUDevice} device The WebGPU device.
 * @returns {GPUBuffer} GPU buffer for camera data.
 */
export function createCameraBuffer(device) {
  // Camera: viewMatrix(64) + projMatrix(64) + vpMatrix(64) + position(12) + pad(4) = 208 bytes
  const buffer = device.createBuffer({
    size: 208,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  return {
    buffer,

    update(viewMatrix, projMatrix, vpMatrix, position) {
      const data = new Float32Array(52);
      data.set(viewMatrix, 0);
      data.set(projMatrix, 16);
      data.set(vpMatrix, 32);
      data.set(position, 48);
      device.queue.writeBuffer(buffer, 0, data);
    }
  };
}

/**
 * Create a uniform buffer for model matrix / transform data.
 * @param {GPUDevice} device The WebGPU device.
 * @returns {GPUBuffer} GPU buffer for model transform.
 */
export function createModelBuffer(device) {
  // Model: modelMatrix(64) + normalMatrix(64) = 128 bytes
  const buffer = device.createBuffer({
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  return {
    buffer,

    update(modelMatrix, normalMatrix) {
      const data = new Float32Array(32);
      data.set(modelMatrix, 0);
      data.set(normalMatrix || modelMatrix, 16);
      device.queue.writeBuffer(buffer, 0, data);
    }
  };
}

/**
 * Create a uniform buffer for light parameters.
 * @param {GPUDevice} device The WebGPU device.
 * @returns {GPUBuffer} GPU buffer for lights.
 */
export function createLightBuffer(device) {
  // Light: position(12) + pad(4) + color(12) + intensity(4) + direction(12) + pad(4) = 48 bytes
  const buffer = device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  return {
    buffer,

    update(light) {
      const data = new Float32Array(12);
      data.set(light.position || [0, 5, 5], 0);
      data.set(light.color || [1, 1, 1], 4);
      data[7] = light.intensity || 1.0;
      data.set(light.direction || [0, -1, 0], 8);
      device.queue.writeBuffer(buffer, 0, data);
    }
  };
}

/**
 * Create a material uniform buffer; layout changes if PBR is enabled.
 * @param {GPUDevice} device The WebGPU device.
 * @param {boolean} [isPBR=false] Whether to allocate PBR material layout.
 * @returns {GPUBuffer} GPU buffer for material data.
 */
export function createMaterialBuffer(device, isPBR = false) {
  // Standard: ambient(12) + pad + diffuse(12) + pad + specular(12) + shininess(4) = 48 bytes
  // PBR: albedo(12) + metallic(4) + roughness(4) + ao(4) + pad(8) = 32 bytes
  const size = isPBR ? 32 : 48;
  const buffer = device.createBuffer({
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  return {
    buffer,

    update(material) {
      if (isPBR) {
        const data = new Float32Array(8);
        data.set(material.albedo || [0.8, 0.8, 0.8], 0);
        data[3] = material.metallic || 0.0;
        data[4] = material.roughness || 0.5;
        data[5] = material.ao || 1.0;
        device.queue.writeBuffer(buffer, 0, data);
      } else {
        const data = new Float32Array(12);
        data.set(material.ambient || [0.1, 0.1, 0.1], 0);
        data.set(material.diffuse || [0.8, 0.8, 0.8], 4);
        data.set(material.specular || [1, 1, 1], 8);
        data[11] = material.shininess || 32.0;
        device.queue.writeBuffer(buffer, 0, data);
      }
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────────────────────

export default {
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
};

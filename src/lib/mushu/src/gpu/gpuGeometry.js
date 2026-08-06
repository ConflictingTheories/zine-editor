/**
 * mushu/gpu/geometry — WebGPU 3D geometry helpers and vertex buffer utilities.
 *
 * Contains helpers to build interleaved vertex/index buffers for WebGPU and
 * convenience primitive generators (cube, sphere, torus) for GPU pipelines.
 * @module mushu/gpu/geometry
 */
// ═══════════════════════════════════════════════════════════════════════════
// mushu/gpu/geometry — WebGPU 3D Geometry and VAO Support
// 
// Usage:
//   import { gpuMesh, gpuCube, gpuSphere } from 'mushu/gpu';
//
// Features:
//   • WebGPU vertex buffer management
//   • 3D primitive generation (cube, sphere, etc.)
//   • OBJ loading
//   • Instanced rendering
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// GPU Mesh — WebGPU Vertex/Index Buffer Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build GPU buffers for a mesh and return helper descriptors for pipeline use.
 * @param {GPUDevice} device
 * @param {Object} geometry - { positions, normals, uvs, colors, indices }
 * @returns {{vertexBuffer: GPUBuffer, indexBuffer: GPUBuffer|null, vertexCount:number, indexCount:number, indexFormat:string, strideBytes:number, bufferLayout:Object, draw:function(passEncoder:GPURenderPassEncoder)}}
 */
/**
 * Create GPU-side buffers for a geometry and return a draw-ready mesh wrapper.
 * @param {GPUDevice} device The WebGPU device.
 * @param {object} geometry Geometry with positions, normals, uvs and indices.
 * @returns {object} GPU mesh wrapper containing buffers and draw metadata.
 */
export function gpuMesh(device, geometry) {
  const {
    positions,           // Float32Array or array
    normals = null,      // Float32Array or array (optional)
    uvs = null,          // Float32Array or array (optional)
    colors = null,       // Float32Array or array (optional)
    indices = null,      // Uint16Array/Uint32Array or array (optional)
  } = geometry;

  // Convert to typed arrays
  const posData = positions instanceof Float32Array ? positions : new Float32Array(positions);
  const normData = normals ? (normals instanceof Float32Array ? normals : new Float32Array(normals)) : null;
  const uvData = uvs ? (uvs instanceof Float32Array ? uvs : new Float32Array(uvs)) : null;
  const colorData = colors ? (colors instanceof Float32Array ? colors : new Float32Array(colors)) : null;

  // Create interleaved vertex buffer for better cache coherency
  // Layout: position(3) + normal(3) + uv(2) + color(4) = 12 floats per vertex
  const vertexCount = posData.length / 3;
  const strideFloats = 12;  // 3+3+2+4 floats
  const strideBytes = strideFloats * 4;

  const interleavedData = new Float32Array(vertexCount * strideFloats);

  for (let i = 0; i < vertexCount; i++) {
    const baseIdx = i * strideFloats;
    const posIdx = i * 3;
    const uvIdx = i * 2;
    const colorIdx = i * 4;

    // Position
    interleavedData[baseIdx + 0] = posData[posIdx];
    interleavedData[baseIdx + 1] = posData[posIdx + 1];
    interleavedData[baseIdx + 2] = posData[posIdx + 2];

    // Normal
    interleavedData[baseIdx + 3] = normData ? normData[posIdx] : 0;
    interleavedData[baseIdx + 4] = normData ? normData[posIdx + 1] : 1;
    interleavedData[baseIdx + 5] = normData ? normData[posIdx + 2] : 0;

    // UV
    interleavedData[baseIdx + 6] = uvData ? uvData[uvIdx] : 0;
    interleavedData[baseIdx + 7] = uvData ? uvData[uvIdx + 1] : 0;

    // Color
    interleavedData[baseIdx + 8] = colorData ? colorData[colorIdx] : 1;
    interleavedData[baseIdx + 9] = colorData ? colorData[colorIdx + 1] : 1;
    interleavedData[baseIdx + 10] = colorData ? colorData[colorIdx + 2] : 1;
    interleavedData[baseIdx + 11] = colorData ? colorData[colorIdx + 3] : 1;
  }

  // Create vertex buffer
  const vertexBuffer = device.createBuffer({
    size: interleavedData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(interleavedData);
  vertexBuffer.unmap();

  // Create index buffer if provided
  let indexBuffer = null;
  let indexCount = 0;
  let indexFormat = 'uint16';

  if (indices) {
    const is32Bit = indices.some ? indices.some(i => i > 65535) : false;
    const indexData = indices instanceof Uint16Array || indices instanceof Uint32Array
      ? indices
      : (is32Bit ? new Uint32Array(indices) : new Uint16Array(indices));

    indexFormat = is32Bit || indexData instanceof Uint32Array ? 'uint32' : 'uint16';
    indexCount = indexData.length;

    indexBuffer = device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new (indexFormat === 'uint32' ? Uint32Array : Uint16Array)(indexBuffer.getMappedRange()).set(indexData);
    indexBuffer.unmap();
  }

  return {
    vertexBuffer,
    indexBuffer,
    vertexCount,
    indexCount,
    indexFormat,
    strideBytes,

    // Vertex buffer layout for pipeline creation
    bufferLayout: {
      arrayStride: strideBytes,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },   // position
        { shaderLocation: 1, offset: 12, format: 'float32x3' },  // normal
        { shaderLocation: 2, offset: 24, format: 'float32x2' },  // uv
        { shaderLocation: 3, offset: 32, format: 'float32x4' },  // color
      ]
    },

    draw(passEncoder) {
      passEncoder.setVertexBuffer(0, vertexBuffer);
      if (indexBuffer) {
        passEncoder.setIndexBuffer(indexBuffer, indexFormat);
        passEncoder.drawIndexed(indexCount);
      } else {
        passEncoder.draw(vertexCount);
      }
    },

    destroy() {
      vertexBuffer.destroy();
      if (indexBuffer) indexBuffer.destroy();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive Generators (return geometry objects for gpuMesh)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper to create a cube geometry suitable for GPU buffer upload.
 * @param {number} [size=1]
 * @returns {object} Geometry object.
 */
export function gpuCubeGeometry(size = 1) {
  const s = size / 2;

  // prettier-ignore
  const positions = [
    // Front
    -s, -s,  s,   s, -s,  s,   s,  s,  s,  -s,  s,  s,
    // Back
     s, -s, -s,  -s, -s, -s,  -s,  s, -s,   s,  s, -s,
    // Top
    -s,  s,  s,   s,  s,  s,   s,  s, -s,  -s,  s, -s,
    // Bottom
    -s, -s, -s,   s, -s, -s,   s, -s,  s,  -s, -s,  s,
    // Right
     s, -s,  s,   s, -s, -s,   s,  s, -s,   s,  s,  s,
    // Left
    -s, -s, -s,  -s, -s,  s,  -s,  s,  s,  -s,  s, -s,
  ];

  // prettier-ignore
  const normals = [
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ];

  // prettier-ignore
  const uvs = [
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
  ];

  // prettier-ignore
  const indices = [
     0,  1,  2,   0,  2,  3,
     4,  5,  6,   4,  6,  7,
     8,  9, 10,   8, 10, 11,
    12, 13, 14,  12, 14, 15,
    16, 17, 18,  16, 18, 19,
    20, 21, 22,  20, 22, 23,
  ];

  return { positions, normals, uvs, indices };
}

/**
 * Helper to create a sphere geometry suitable for GPU buffer upload.
 * @param {number} [radius=0.5]
 * @param {number} [widthSegments=32]
 * @param {number} [heightSegments=16]
 * @returns {object} Geometry object.
 */
export function gpuSphereGeometry(radius = 0.5, widthSegments = 32, heightSegments = 16) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let iy = 0; iy <= heightSegments; iy++) {
    const v = iy / heightSegments;
    const phi = v * Math.PI;

    for (let ix = 0; ix <= widthSegments; ix++) {
      const u = ix / widthSegments;
      const theta = u * Math.PI * 2;

      const x = -Math.cos(theta) * Math.sin(phi);
      const y = Math.cos(phi);
      const z = Math.sin(theta) * Math.sin(phi);

      positions.push(x * radius, y * radius, z * radius);
      normals.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ix = 0; ix < widthSegments; ix++) {
      const a = ix + (widthSegments + 1) * iy;
      const b = ix + (widthSegments + 1) * (iy + 1);
      const c = (ix + 1) + (widthSegments + 1) * (iy + 1);
      const d = (ix + 1) + (widthSegments + 1) * iy;

      if (iy !== 0) indices.push(a, b, d);
      if (iy !== heightSegments - 1) indices.push(b, c, d);
    }
  }

  return { positions, normals, uvs, indices };
}

/**
 * Helper to create a plane geometry for GPU buffers.
 * @param {number} [width=1]
 * @param {number} [height=1]
 * @param {number} [widthSegments=1]
 * @param {number} [heightSegments=1]
 * @returns {object} Geometry object.
 */
export function gpuPlaneGeometry(width = 1, height = 1, widthSegments = 1, heightSegments = 1) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let iy = 0; iy <= heightSegments; iy++) {
    const y = (iy / heightSegments - 0.5) * height;
    const v = iy / heightSegments;

    for (let ix = 0; ix <= widthSegments; ix++) {
      const x = (ix / widthSegments - 0.5) * width;
      const u = ix / widthSegments;

      positions.push(x, y, 0);
      normals.push(0, 0, 1);
      uvs.push(u, v);
    }
  }

  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ix = 0; ix < widthSegments; ix++) {
      const a = ix + (widthSegments + 1) * iy;
      const b = ix + (widthSegments + 1) * (iy + 1);
      const c = (ix + 1) + (widthSegments + 1) * (iy + 1);
      const d = (ix + 1) + (widthSegments + 1) * iy;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  return { positions, normals, uvs, indices };
}

/**
 * Helper to create a torus geometry for GPU buffers.
 * @param {number} [radius=0.5]
 * @param {number} [tube=0.2]
 * @param {number} [radialSegments=32]
 * @param {number} [tubularSegments=24]
 * @returns {object} Geometry object.
 */
export function gpuTorusGeometry(radius = 0.5, tube = 0.2, radialSegments = 32, tubularSegments = 24) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let j = 0; j <= radialSegments; j++) {
    for (let i = 0; i <= tubularSegments; i++) {
      const u = i / tubularSegments * Math.PI * 2;
      const v = j / radialSegments * Math.PI * 2;

      const x = (radius + tube * Math.cos(v)) * Math.cos(u);
      const y = (radius + tube * Math.cos(v)) * Math.sin(u);
      const z = tube * Math.sin(v);

      positions.push(x, y, z);

      const cx = radius * Math.cos(u);
      const cy = radius * Math.sin(u);
      normals.push(x - cx, y - cy, z);

      uvs.push(i / tubularSegments, j / radialSegments);
    }
  }

  for (let j = 1; j <= radialSegments; j++) {
    for (let i = 1; i <= tubularSegments; i++) {
      const a = (tubularSegments + 1) * j + i - 1;
      const b = (tubularSegments + 1) * (j - 1) + i - 1;
      const c = (tubularSegments + 1) * (j - 1) + i;
      const d = (tubularSegments + 1) * j + i;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  return { positions, normals, uvs, indices };
}

// ─────────────────────────────────────────────────────────────────────────────
// OBJ Loader for WebGPU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an OBJ string into a geometry object (GPU-friendly format).
 * @param {string} objString OBJ file contents.
 * @returns {object} Parsed geometry with attributes and indices.
 */
export function parseOBJ(objString) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const tempPositions = [];
  const tempNormals = [];
  const tempUvs = [];
  const vertexMap = new Map();
  let vertexIndex = 0;

  const lines = objString.split('\n');

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const type = parts[0];

    if (type === 'v') {
      tempPositions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
    } else if (type === 'vn') {
      tempNormals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
    } else if (type === 'vt') {
      tempUvs.push(parseFloat(parts[1]), parseFloat(parts[2]));
    } else if (type === 'f') {
      const faceVertices = parts.slice(1);

      for (let i = 1; i < faceVertices.length - 1; i++) {
        const tri = [faceVertices[0], faceVertices[i], faceVertices[i + 1]];

        for (const vert of tri) {
          if (vertexMap.has(vert)) {
            indices.push(vertexMap.get(vert));
          } else {
            const [vIdx, vtIdx, vnIdx] = vert.split('/').map(v => v ? parseInt(v) - 1 : -1);

            if (vIdx >= 0) {
              positions.push(
                tempPositions[vIdx * 3],
                tempPositions[vIdx * 3 + 1],
                tempPositions[vIdx * 3 + 2]
              );
            }

            if (vtIdx >= 0 && tempUvs.length > 0) {
              uvs.push(tempUvs[vtIdx * 2], tempUvs[vtIdx * 2 + 1]);
            } else {
              uvs.push(0, 0);
            }

            if (vnIdx >= 0 && tempNormals.length > 0) {
              normals.push(
                tempNormals[vnIdx * 3],
                tempNormals[vnIdx * 3 + 1],
                tempNormals[vnIdx * 3 + 2]
              );
            } else {
              normals.push(0, 1, 0);
            }

            vertexMap.set(vert, vertexIndex);
            indices.push(vertexIndex);
            vertexIndex++;
          }
        }
      }
    }
  }

  return { positions, normals, uvs, indices };
}

// ─────────────────────────────────────────────────────────────────────────────
// Instanced Mesh for WebGPU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an instanced mesh wrapper that includes instance buffers and count.
 * @param {GPUDevice} device The WebGPU device.
 * @param {object} geometry Geometry object.
 * @param {number} instanceCount Number of instances to allocate.
 * @param {ArrayBuffer|TypedArray|null} [instanceData] Optional initial instance data.
 * @returns {object} Instanced mesh wrapper with draw methods.
 */
export function gpuInstancedMesh(device, geometry, instanceCount, instanceData = null) {
  const mesh = gpuMesh(device, geometry);

  // Create instance buffer
  // Default layout: mat4 transform (16 floats) + vec4 color (4 floats) = 20 floats
  const instanceStride = 20 * 4; // bytes

  let instanceBuffer;
  if (instanceData) {
    const data = instanceData instanceof Float32Array ? instanceData : new Float32Array(instanceData);
    instanceBuffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(instanceBuffer.getMappedRange()).set(data);
    instanceBuffer.unmap();
  } else {
    // Create default identity instances
    const data = new Float32Array(instanceCount * 20);
    for (let i = 0; i < instanceCount; i++) {
      const offset = i * 20;
      // Identity matrix
      data[offset + 0] = 1; data[offset + 5] = 1; data[offset + 10] = 1; data[offset + 15] = 1;
      // White color
      data[offset + 16] = 1; data[offset + 17] = 1; data[offset + 18] = 1; data[offset + 19] = 1;
    }
    instanceBuffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(instanceBuffer.getMappedRange()).set(data);
    instanceBuffer.unmap();
  }

  return {
    ...mesh,
    instanceBuffer,
    instanceCount,

    // Extended buffer layout including instance attributes
    instanceBufferLayout: {
      arrayStride: instanceStride,
      stepMode: 'instance',
      attributes: [
        // Transform matrix (4 vec4s)
        { shaderLocation: 4, offset: 0, format: 'float32x4' },
        { shaderLocation: 5, offset: 16, format: 'float32x4' },
        { shaderLocation: 6, offset: 32, format: 'float32x4' },
        { shaderLocation: 7, offset: 48, format: 'float32x4' },
        // Instance color
        { shaderLocation: 8, offset: 64, format: 'float32x4' },
      ]
    },

    drawInstanced(passEncoder) {
      passEncoder.setVertexBuffer(0, mesh.vertexBuffer);
      passEncoder.setVertexBuffer(1, instanceBuffer);
      if (mesh.indexBuffer) {
        passEncoder.setIndexBuffer(mesh.indexBuffer, mesh.indexFormat);
        passEncoder.drawIndexed(mesh.indexCount, instanceCount);
      } else {
        passEncoder.draw(mesh.vertexCount, instanceCount);
      }
    },

    updateInstances(data) {
      const typedData = data instanceof Float32Array ? data : new Float32Array(data);
      device.queue.writeBuffer(instanceBuffer, 0, typedData);
    },

    destroy() {
      mesh.destroy();
      instanceBuffer.destroy();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────────────────────

export default {
  gpuMesh,
  gpuCubeGeometry,
  gpuSphereGeometry,
  gpuPlaneGeometry,
  gpuTorusGeometry,
  parseOBJ,
  gpuInstancedMesh,
};

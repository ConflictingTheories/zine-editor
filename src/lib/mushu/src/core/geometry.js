/**
 * mushu/core/geometry — 3D Geometry, VAO, and Mesh Utilities
 *
 * Provides VAO builders, mesh helpers, primitive generators (cube, sphere, torus),
 * and an OBJ loader. Designed to work as plugins for the `flow()` runtime.
 * @module mushu/core/geometry
 */
// ═══════════════════════════════════════════════════════════════════════════
// mushu/core/geometry — 3D Geometry, VAO, and Mesh Utilities
// 
// Usage:
//   mushu(canvas).flow()
//     .use(cube({ size: 1.0 }))
//     .use(shader(vertexShader, fragShader))
//     .go()
//
// Or import primitives:
//   import { cube, sphere, plane, mesh, vao } from 'mushu/core';
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// VAO (Vertex Array Object) Builder
// 
// Create custom VAOs with flexible attribute layouts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a VAO plugin for the WebGL `flow()` runtime.
 * @param {Object} [options]
 * @param {Float32Array|Array<number>} [options.positions]
 * @param {Float32Array|Array<number>} [options.normals]
 * @param {Float32Array|Array<number>} [options.uvs]
 * @param {Float32Array|Array<number>} [options.colors]
 * @param {Uint16Array|Uint32Array|Array<number>} [options.indices]
 * @param {Object} [options.attributes] - custom attributes map
 * @param {string} [options.drawMode='TRIANGLES']
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext), update:function(string, Float32Array, FlowContext), destroy:function(FlowContext)}}
 */
/**
 * Create a VAO wrapper object describing attribute buffers and counts.
 * @param {object} [options]
 * @returns {object} VAO description with buffers and draw-count.
 */
export function vao(options = {}) {
  const {
    positions = null,      // Float32Array or array of positions
    normals = null,        // Float32Array or array of normals
    uvs = null,            // Float32Array or array of UVs
    colors = null,         // Float32Array or array of colors
    indices = null,        // Uint16Array or Uint32Array for indexed drawing
    attributes = {},       // Custom attributes: { name: { data, size, type } }
    drawMode = 'TRIANGLES',
    instanced = null,      // { count, attributes: { name: { data, size, divisor } } }
  } = options;

  let vaoHandle = null;
  let buffers = [];
  let indexBuffer = null;
  let vertexCount = 0;
  let indexCount = 0;
  let instanceCount = 1;
  let glDrawMode;

  return {
    name: 'vao',

    init(ctx) {
      const gl = ctx.gl;
      vaoHandle = gl.createVertexArray();
      gl.bindVertexArray(vaoHandle);

      let attribIndex = 0;

      // Helper to create and bind buffer
      const createBuffer = (data, target = gl.ARRAY_BUFFER) => {
        /**
         * Create a GPU buffer for vertex or index data.
         * @param {Array|TypedArray} data The buffer data.
         * @param {number} [target] GL buffer target (ARRAY_BUFFER or ELEMENT_ARRAY_BUFFER).
         * @returns {{buffer: WebGLBuffer, typedData: TypedArray}}
         */
        const buffer = gl.createBuffer();
        gl.bindBuffer(target, buffer);
        const typedData = data instanceof Float32Array ? data :
          target === gl.ELEMENT_ARRAY_BUFFER ?
            (data.some(i => i > 65535) ? new Uint32Array(data) : new Uint16Array(data)) :
            new Float32Array(data);
        gl.bufferData(target, typedData, gl.STATIC_DRAW);
        buffers.push(buffer);
        return { buffer, typedData };
      };

      // Helper to set up attribute
      const setupAttribute = (data, size, name = null, divisor = 0) => {
        if (!data) return;
        const { buffer, typedData } = createBuffer(Array.isArray(data) ? data : Array.from(data));
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(attribIndex);
        gl.vertexAttribPointer(attribIndex, size, gl.FLOAT, false, 0, 0);
        if (divisor > 0) {
          gl.vertexAttribDivisor(attribIndex, divisor);
        }
        if (name) {
          // Store for later uniform/attribute mapping
          ctx.state[`attrib_${name}`] = attribIndex;
        }
        attribIndex++;
        return typedData.length / size;
      };

      // Built-in attributes (standard layout)
      // Location 0: position (vec3)
      // Location 1: normal (vec3)
      // Location 2: uv (vec2)
      // Location 3: color (vec4)

      if (positions) {
        vertexCount = setupAttribute(positions, 3, 'position');
      }
      if (normals) {
        setupAttribute(normals, 3, 'normal');
      }
      if (uvs) {
        setupAttribute(uvs, 2, 'uv');
      }
      if (colors) {
        setupAttribute(colors, 4, 'color');
      }

      // Custom attributes
      for (const [name, attr] of Object.entries(attributes)) {
        const size = attr.size || 3;
        setupAttribute(attr.data, size, name, attr.divisor || 0);
      }

      // Instanced attributes
      if (instanced) {
        instanceCount = instanced.count || 1;
        for (const [name, attr] of Object.entries(instanced.attributes || {})) {
          const size = attr.size || 3;
          const divisor = attr.divisor || 1;
          setupAttribute(attr.data, size, name, divisor);
        }
      }

      // Index buffer
      if (indices) {
        const { buffer, typedData } = createBuffer(indices, gl.ELEMENT_ARRAY_BUFFER);
        indexBuffer = buffer;
        indexCount = typedData.length;
        ctx.state.indexType = typedData instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      }

      // Draw mode
      glDrawMode = gl[drawMode] || gl.TRIANGLES;

      // Store in context
      ctx.state.vao = vaoHandle;
      ctx.state.vertexCount = vertexCount;
      ctx.state.indexCount = indexCount;
      ctx.state.instanceCount = instanceCount;
      ctx.state.drawMode = glDrawMode;

      gl.bindVertexArray(null);
    },

    render(ctx) {
      const gl = ctx.gl;
      gl.bindVertexArray(vaoHandle);

      if (indexBuffer) {
        if (instanceCount > 1) {
          gl.drawElementsInstanced(glDrawMode, indexCount, ctx.state.indexType, 0, instanceCount);
        } else {
          gl.drawElements(glDrawMode, indexCount, ctx.state.indexType, 0);
        }
      } else {
        if (instanceCount > 1) {
          gl.drawArraysInstanced(glDrawMode, 0, vertexCount, instanceCount);
        } else {
          gl.drawArrays(glDrawMode, 0, vertexCount);
        }
      }
    },

    // Update buffer data dynamically
    update(name, data, ctx) {
      const gl = ctx.gl;
      const attribIdx = ctx.state[`attrib_${name}`];
      if (attribIdx !== undefined && buffers[attribIdx]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers[attribIdx]);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data instanceof Float32Array ? data : new Float32Array(data));
      }
    },

    destroy(ctx) {
      const gl = ctx.gl;
      if (vaoHandle) gl.deleteVertexArray(vaoHandle);
      for (const buffer of buffers) {
        gl.deleteBuffer(buffer);
      }
      if (indexBuffer) gl.deleteBuffer(indexBuffer);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mesh — Higher-level mesh with material support
// ─────────────────────────────────────────────────────────────────────────────

/**
 * High-level mesh plugin that wraps a `vao` and manages model matrix and material uniforms.
 * @param {Object} geometry - Geometry descriptor suitable for `vao()`.
 * @param {Object} [options]
 * @param {Object} [options.transform]
 * @param {Object} [options.material]
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext), setTransform:function(Object), destroy:function(FlowContext)}}
 */
/**
 * Wraps a geometry object into a renderable mesh, applying transforms and material data.
 * @param {object} geometry Geometry returned from primitive generators or OBJ loader.
 * @param {object} [options]
 * @returns {object} Mesh object suitable for the runtime's draw calls.
 */
export function mesh(geometry, options = {}) {
  const {
    transform = null,      // { position, rotation, scale }
    material = null,       // Material properties
  } = options;

  let vaoPlugin = null;
  let modelMatrix = new Float32Array(16);

  // Initialize identity matrix
  const identity = () => {
    modelMatrix.set([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  };

  return {
    name: 'mesh',

    init(ctx) {
      identity();
      vaoPlugin = vao(geometry);
      vaoPlugin.init(ctx);

      // Apply initial transform
      if (transform) {
        updateTransform(transform);
      }
    },

    render(ctx) {
      // Set model matrix uniform if program exists
      if (ctx.program) {
        const loc = ctx.gl.getUniformLocation(ctx.program, 'modelMatrix');
        if (loc) {
          ctx.gl.uniformMatrix4fv(loc, false, modelMatrix);
        }
      }

      // Set material uniforms
      if (material && ctx.program) {
        const gl = ctx.gl;
        for (const [name, value] of Object.entries(material)) {
          const loc = gl.getUniformLocation(ctx.program, name);
          if (!loc) continue;
          if (typeof value === 'number') {
            gl.uniform1f(loc, value);
          } else if (value.length === 3) {
            gl.uniform3fv(loc, value);
          } else if (value.length === 4) {
            gl.uniform4fv(loc, value);
          }
        }
      }

      vaoPlugin.render(ctx);
    },

    // Update transform
    setTransform(t) {
      updateTransform(t);
      return this;
    },

    destroy(ctx) {
      if (vaoPlugin) vaoPlugin.destroy(ctx);
    }
  };

  /**
   * Update model transform object `t` by recalculating derived matrices.
   * This function is called when a mesh's transform parameters change.
   * @param {object} t Transform object containing position/rotation/scale and matrices.
   */
  function updateTransform(t) {
    identity();
    const { position = [0, 0, 0], scale = [1, 1, 1] } = t;

    // Translation
    modelMatrix[12] = position[0];
    modelMatrix[13] = position[1];
    modelMatrix[14] = position[2];

    // Scale (simple, ignores rotation order for now)
    modelMatrix[0] *= scale[0];
    modelMatrix[5] *= scale[1];
    modelMatrix[10] *= scale[2];

    // Note: For proper rotation, use the mat4 utilities from transforms.js
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive Generators
// ─────────────────────────────────────────────────────────────────────────────

// Fullscreen quad (for post-processing)
/**
 * Convenience: fullscreen quad VAO plugin.
 * @returns {Object} plugin returned by `vao()` for a fullscreen triangle.
 */
/**
 * Return a fullscreen triangle/quad geometry for postprocessing passes.
 * @returns {object} Geometry object for a fullscreen draw.
 */
export function fullscreenQuad() {
  return vao({
    positions: [
      -1, -1, 0,
      3, -1, 0,
      -1, 3, 0,
    ],
    uvs: [
      0, 0,
      2, 0,
      0, 2,
    ],
    drawMode: 'TRIANGLES',
  });
}

// Plane (XY plane centered at origin)
/**
 * Generate a plane geometry and return a VAO plugin.
 * @param {Object} [options] width,height,widthSegments,heightSegments
 * @returns {Object} plugin from `vao()`
 */
/**
 * Generate a subdivided plane geometry.
 * @param {object} [options]
 * @returns {object} Plane geometry with positions, uvs, normals and indices.
 */
export function plane(options = {}) {
  const {
    width = 1,
    height = 1,
    widthSegments = 1,
    heightSegments = 1,
  } = options;

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

  return vao({ positions, normals, uvs, indices });
}

// Cube
/**
 * Create a cube mesh VAO plugin.
 * @param {Object} [options]
 * @param {number} [options.size=1]
 * @returns {Object} plugin from `vao()`
 */
/**
 * Generate a unit cube geometry.
 * @param {object} [options]
 * @returns {object} Cube geometry with positions, uvs, normals and indices.
 */
export function cube(options = {}) {
  const { size = 1 } = options;
  const s = size / 2;

  // prettier-ignore
  const positions = [
    // Front
    -s, -s, s, s, -s, s, s, s, s, -s, s, s,
    // Back
    s, -s, -s, -s, -s, -s, -s, s, -s, s, s, -s,
    // Top
    -s, s, s, s, s, s, s, s, -s, -s, s, -s,
    // Bottom
    -s, -s, -s, s, -s, -s, s, -s, s, -s, -s, s,
    // Right
    s, -s, s, s, -s, -s, s, s, -s, s, s, s,
    // Left
    -s, -s, -s, -s, -s, s, -s, s, s, -s, s, -s,
  ];

  // prettier-ignore
  const normals = [
    // Front
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    // Back
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    // Top
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    // Bottom
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    // Right
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    // Left
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ];

  // prettier-ignore
  const uvs = [
    // Front
    0, 0, 1, 0, 1, 1, 0, 1,
    // Back
    0, 0, 1, 0, 1, 1, 0, 1,
    // Top
    0, 0, 1, 0, 1, 1, 0, 1,
    // Bottom
    0, 0, 1, 0, 1, 1, 0, 1,
    // Right
    0, 0, 1, 0, 1, 1, 0, 1,
    // Left
    0, 0, 1, 0, 1, 1, 0, 1,
  ];

  // prettier-ignore
  const indices = [
    0, 1, 2, 0, 2, 3,  // Front
    4, 5, 6, 4, 6, 7,  // Back
    8, 9, 10, 8, 10, 11,  // Top
    12, 13, 14, 12, 14, 15,  // Bottom
    16, 17, 18, 16, 18, 19,  // Right
    20, 21, 22, 20, 22, 23,  // Left
  ];

  return vao({ positions, normals, uvs, indices });
}

// Sphere (UV sphere)
/**
 * Create a UV sphere geometry VAO plugin.
 * @param {Object} [options]
 * @param {number} [options.radius=0.5]
 * @param {number} [options.widthSegments=32]
 * @param {number} [options.heightSegments=16]
 * @returns {Object} plugin from `vao()`
 */
/**
 * Create a UV sphere geometry.
 * @param {object} [options]
 * @returns {object} Sphere geometry with positions, uvs, normals and indices.
 */
export function sphere(options = {}) {
  const {
    radius = 0.5,
    widthSegments = 32,
    heightSegments = 16,
  } = options;

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

  return vao({ positions, normals, uvs, indices });
}

// Cylinder
/**
 * Create a cylinder mesh VAO plugin.
 * @param {Object} [options]
 * @returns {Object} plugin from `vao()`
 */
/**
 * Create a cylinder geometry.
 * @param {object} [options]
 * @returns {object} Cylinder geometry with positions, uvs, normals and indices.
 */
export function cylinder(options = {}) {
  const {
    radiusTop = 0.5,
    radiusBottom = 0.5,
    height = 1,
    radialSegments = 32,
    heightSegments = 1,
    openEnded = false,
  } = options;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const halfHeight = height / 2;

  // Generate body
  for (let iy = 0; iy <= heightSegments; iy++) {
    const v = iy / heightSegments;
    const y = v * height - halfHeight;
    const radius = v * (radiusTop - radiusBottom) + radiusBottom;

    for (let ix = 0; ix <= radialSegments; ix++) {
      const u = ix / radialSegments;
      const theta = u * Math.PI * 2;

      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      const x = radius * sinTheta;
      const z = radius * cosTheta;

      positions.push(x, y, z);

      // Normal (simplified, doesn't account for slope)
      normals.push(sinTheta, 0, cosTheta);
      uvs.push(u, v);
    }
  }

  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ix = 0; ix < radialSegments; ix++) {
      const a = ix + (radialSegments + 1) * iy;
      const b = ix + (radialSegments + 1) * (iy + 1);
      const c = (ix + 1) + (radialSegments + 1) * (iy + 1);
      const d = (ix + 1) + (radialSegments + 1) * iy;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Generate caps if not open ended
  if (!openEnded) {
    // Top cap
    if (radiusTop > 0) {
      const topCenterIndex = positions.length / 3;
      positions.push(0, halfHeight, 0);
      normals.push(0, 1, 0);
      uvs.push(0.5, 0.5);

      for (let ix = 0; ix <= radialSegments; ix++) {
        const u = ix / radialSegments;
        const theta = u * Math.PI * 2;
        const x = radiusTop * Math.sin(theta);
        const z = radiusTop * Math.cos(theta);

        positions.push(x, halfHeight, z);
        normals.push(0, 1, 0);
        uvs.push(Math.sin(theta) * 0.5 + 0.5, Math.cos(theta) * 0.5 + 0.5);
      }

      for (let ix = 0; ix < radialSegments; ix++) {
        indices.push(topCenterIndex, topCenterIndex + ix + 1, topCenterIndex + ix + 2);
      }
    }

    // Bottom cap
    if (radiusBottom > 0) {
      const bottomCenterIndex = positions.length / 3;
      positions.push(0, -halfHeight, 0);
      normals.push(0, -1, 0);
      uvs.push(0.5, 0.5);

      for (let ix = 0; ix <= radialSegments; ix++) {
        const u = ix / radialSegments;
        const theta = u * Math.PI * 2;
        const x = radiusBottom * Math.sin(theta);
        const z = radiusBottom * Math.cos(theta);

        positions.push(x, -halfHeight, z);
        normals.push(0, -1, 0);
        uvs.push(Math.sin(theta) * 0.5 + 0.5, Math.cos(theta) * 0.5 + 0.5);
      }

      for (let ix = 0; ix < radialSegments; ix++) {
        indices.push(bottomCenterIndex, bottomCenterIndex + ix + 2, bottomCenterIndex + ix + 1);
      }
    }
  }

  return vao({ positions, normals, uvs, indices });
}

// Torus
/**
 * Create a torus geometry VAO plugin.
 * @param {Object} [options]
 * @returns {Object} plugin from `vao()`
 */
/**
 * Create a torus geometry.
 * @param {object} [options]
 * @returns {object} Torus geometry with positions, uvs, normals and indices.
 */
export function torus(options = {}) {
  const {
    radius = 0.5,
    tube = 0.2,
    radialSegments = 32,
    tubularSegments = 24,
  } = options;

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

  return vao({ positions, normals, uvs, indices });
}

// Cone (special case of cylinder)
/**
 * Create a cone mesh (special-case of cylinder).
 * @param {Object} [options]
 * @returns {Object} plugin from `cylinder()`
 */
/**
 * Create a cone geometry.
 * @param {object} [options]
 * @returns {object} Cone geometry with positions, uvs, normals and indices.
 */
export function cone(options = {}) {
  return cylinder({
    radiusTop: 0,
    radiusBottom: options.radius || 0.5,
    height: options.height || 1,
    radialSegments: options.radialSegments || 32,
    heightSegments: options.heightSegments || 1,
    openEnded: options.openEnded || false,
  });
}

/**
 * Generate a stylized crystal geometry (pointed, faceted prism).
 * @param {Object} [options]
 * @param {number} [options.radius=0.2]
 * @param {number} [options.height=1.0]
 * @param {number} [options.sides=6]
 * @param {number} [options.taperTop=0.0] - how much the top point is offset
 * @param {number} [options.taperBottom=0.0] - how much the bottom point is offset
 * @param {number} [options.midRatio=0.5] - where the widest point is along the height
 * @returns {Object} vao plugin
 */
export function crystal(options = {}) {
  const {
    radius = 0.25,
    height = 1.0,
    sides = 6,
    taperTop = 0.0,
    taperBottom = 0.0,
    midRatio = 0.5,
  } = options;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const addTriangle = (v0, v1, v2, u0, u1, u2) => {
    const start = positions.length / 3;
    positions.push(...v0, ...v1, ...v2);
    const d1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const d2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
    const n = [
      d1[1] * d2[2] - d1[2] * d2[1],
      d1[2] * d2[0] - d1[0] * d2[2],
      d1[0] * d2[1] - d1[1] * d2[0]
    ];
    const l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
    const norm = [n[0] / l, n[1] / l, n[2] / l];
    normals.push(...norm, ...norm, ...norm);
    uvs.push(...u0, ...u1, ...u2);
    indices.push(start, start + 1, start + 2);
  };

  const midY = height * midRatio;
  const top = [taperTop, height, taperTop]; // Apply taper to top point
  const bot = [taperBottom, 0, taperBottom]; // Apply taper to bottom point

  for (let i = 0; i < sides; i++) {
    const a1 = (i / sides) * Math.PI * 2;
    const a2 = ((i + 1) / sides) * Math.PI * 2;

    const m1 = [Math.cos(a1) * radius, midY, Math.sin(a1) * radius];
    const m2 = [Math.cos(a2) * radius, midY, Math.sin(a2) * radius];

    // Top cone
    addTriangle(m1, m2, top, [0, 0.5], [1, 0.5], [0.5, 1]);
    // Bottom cone
    addTriangle(bot, m2, m1, [0.5, 0], [1, 0.5], [0, 0.5]);
  }

  return vao({ positions, normals, uvs, indices });
}

// ─────────────────────────────────────────────────────────────────────────────
// OBJ Loader (simple parser)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an OBJ format string into position, normal, uv and index arrays.
 * @param {string} objString - Contents of an .obj file
 * @returns {{positions:number[], normals:number[], uvs:number[], indices:number[]}}
 */
/**
 * Parse an OBJ file string into a geometry object.
 * @param {string} objString The contents of an OBJ file.
 * @returns {object} Geometry with positions, uvs, normals and indices.
 */
export function loadOBJ(objString) {
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

      // Triangulate if more than 3 vertices
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

import { Loader } from './loader.js';

// OBJ loader plugin (loads from URL)
/**
 * OBJ loader plugin — fetches an OBJ file and creates a VAO plugin from it.
 * @param {string} url - URL to the OBJ file.
 * @param {Object} [options] - Passed to `vao()`.
 * @returns {{name:string, init:function(FlowContext), render:function(FlowContext), destroy:function(FlowContext)}}
 */
/**
 * Load an OBJ file from a URL and parse it into geometry.
 * @param {string} url URL of the OBJ file.
 * @param {object} [options]
 * @returns {Promise<object>} Promise resolving to parsed geometry.
 */
export function obj(url, options = {}) {
  let vaoPlugin = null;

  return {
    name: 'obj',

    async init(ctx) {
      const geometry = await Loader.obj(url);
      vaoPlugin = vao({ ...geometry, ...options });
      vaoPlugin.init(ctx);
    },

    render(ctx) {
      if (vaoPlugin) vaoPlugin.render(ctx);
    },

    destroy(ctx) {
      if (vaoPlugin) vaoPlugin.destroy(ctx);
    }
  };
}

/**
 * Custom geometry helper — creates a VAO plugin from raw geometry data.
 * @param {Object} data - { positions, normals, uvs, indices, ... }
 * @param {Object} [options] - Additional vao options
 * @returns {Object} vao plugin
 */
export function custom(data, options = {}) {
  return vao({ ...data, ...options });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lines and Points
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a line strip/loop VAO plugin from a flat array of points.
 * @param {Array<number>|Float32Array} points
 * @param {Object} [options]
 * @param {boolean} [options.loop=false]
 * @param {Array|Float32Array} [options.colors]
 * @returns {Object}
 */
/**
 * Create a line-strip geometry from ordered points.
 * @param {Array<number>} points Flat array of point coordinates.
 * @param {object} [options]
 * @returns {object} Line geometry.
 */
export function lines(points, options = {}) {
  const { loop = false, colors = null } = options;

  return vao({
    positions: points,
    colors,
    drawMode: loop ? 'LINE_LOOP' : 'LINE_STRIP',
  });
}

/**
 * Create a line segments VAO plugin.
 * @param {Array<number>|Float32Array} points
 * @param {Object} [options]
 * @returns {Object}
 */
/**
 * Create line-segment geometry from pairs of points.
 * @param {Array<number>} points Flat array of point coordinates (pairs form segments).
 * @param {object} [options]
 * @returns {object} Line segments geometry.
 */
export function lineSegments(points, options = {}) {
  return vao({
    positions: points,
    colors: options.colors,
    drawMode: 'LINES',
  });
}

/**
 * Create a points VAO plugin.
 * @param {Array<number>|Float32Array} positions
 * @param {Object} [options]
 * @returns {Object}
 */
/**
 * Create a points cloud geometry from positions.
 * @param {Array<number>} positions Flat array of vertex positions.
 * @param {object} [options]
 * @returns {object} Points geometry.
 */
export function points(positions, options = {}) {
  return vao({
    positions,
    colors: options.colors,
    drawMode: 'POINTS',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export
// ─────────────────────────────────────────────────────────────────────────────

export default {
  vao,
  mesh,
  plane,
  cube,
  sphere,
  cylinder,
  cone,
  torus,
  fullscreenQuad,
  loadOBJ,
  obj,
  lines,
  lineSegments,
  points,
};

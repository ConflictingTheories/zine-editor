/**
 * mushu/core/transforms — 3D Math Utilities (vec3, mat4, camera helpers)
 *
 * Small, dependency-free vector/matrix helpers intended for use with the
 * 3D geometry and shader helpers in `mushu/core`.
 * @module mushu/core/transforms
 */
// ═══════════════════════════════════════════════════════════════════════════
// mushu/core/transforms — 3D Math Utilities
// 
// Matrix and vector utilities for 3D graphics:
//   import { mat4, vec3, camera } from 'mushu/core';
//
// Usage:
//   const proj = mat4.perspective(45, aspect, 0.1, 100);
//   const view = mat4.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Vec3 — 3D Vector Operations
// ─────────────────────────────────────────────────────────────────────────────

export const vec3 = {
  create: (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]),

  clone: (v) => new Float32Array([v[0], v[1], v[2]]),

  set: (out, x, y, z) => {
    out[0] = x; out[1] = y; out[2] = z;
    return out;
  },

  add: (out, a, b) => {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
  },

  subtract: (out, a, b) => {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
  },

  scale: (out, v, s) => {
    out[0] = v[0] * s;
    out[1] = v[1] * s;
    out[2] = v[2] * s;
    return out;
  },

  multiply: (out, a, b) => {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    out[2] = a[2] * b[2];
    return out;
  },

  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],

  cross: (out, a, b) => {
    const ax = a[0], ay = a[1], az = a[2];
    const bx = b[0], by = b[1], bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
  },

  length: (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),

  lengthSquared: (v) => v[0] * v[0] + v[1] * v[1] + v[2] * v[2],

  normalize: (out, v) => {
    const len = vec3.length(v);
    if (len > 0) {
      const invLen = 1 / len;
      out[0] = v[0] * invLen;
      out[1] = v[1] * invLen;
      out[2] = v[2] * invLen;
    }
    return out;
  },

  negate: (out, v) => {
    out[0] = -v[0];
    out[1] = -v[1];
    out[2] = -v[2];
    return out;
  },

  lerp: (out, a, b, t) => {
    out[0] = a[0] + t * (b[0] - a[0]);
    out[1] = a[1] + t * (b[1] - a[1]);
    out[2] = a[2] + t * (b[2] - a[2]);
    return out;
  },

  distance: (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },

  transformMat4: (out, v, m) => {
    const x = v[0], y = v[1], z = v[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
  },

  // Rotate around X axis
  rotateX: (out, v, angle) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const y = v[1], z = v[2];
    out[0] = v[0];
    out[1] = y * c - z * s;
    out[2] = y * s + z * c;
    return out;
  },

  // Rotate around Y axis
  rotateY: (out, v, angle) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const x = v[0], z = v[2];
    out[0] = x * c + z * s;
    out[1] = v[1];
    out[2] = -x * s + z * c;
    return out;
  },

  // Rotate around Z axis
  rotateZ: (out, v, angle) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const x = v[0], y = v[1];
    out[0] = x * c - y * s;
    out[1] = x * s + y * c;
    out[2] = v[2];
    return out;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Vec4 — 4D Vector Operations
// ─────────────────────────────────────────────────────────────────────────────

export const vec4 = {
  create: (x = 0, y = 0, z = 0, w = 1) => new Float32Array([x, y, z, w]),

  clone: (v) => new Float32Array([v[0], v[1], v[2], v[3]]),

  set: (out, x, y, z, w) => {
    out[0] = x; out[1] = y; out[2] = z; out[3] = w;
    return out;
  },

  length: (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3]),

  transformMat4: (out, v, m) => {
    const x = v[0], y = v[1], z = v[2], w = v[3];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Mat4 — 4x4 Matrix Operations (Column-Major)
// ─────────────────────────────────────────────────────────────────────────────

export const mat4 = {
  create: () => new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]),

  identity: (out) => {
    out.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return out;
  },

  clone: (m) => new Float32Array(m),

  copy: (out, m) => {
    out.set(m);
    return out;
  },

  // Multiply two matrices: out = a * b
  multiply: (out, a, b) => {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    return out;
  },

  // Transpose matrix
  transpose: (out, m) => {
    if (out === m) {
      const a01 = m[1], a02 = m[2], a03 = m[3];
      const a12 = m[6], a13 = m[7];
      const a23 = m[11];
      out[1] = m[4]; out[2] = m[8]; out[3] = m[12];
      out[4] = a01; out[6] = m[9]; out[7] = m[13];
      out[8] = a02; out[9] = a12; out[11] = m[14];
      out[12] = a03; out[13] = a13; out[14] = a23;
    } else {
      out[0] = m[0]; out[1] = m[4]; out[2] = m[8]; out[3] = m[12];
      out[4] = m[1]; out[5] = m[5]; out[6] = m[9]; out[7] = m[13];
      out[8] = m[2]; out[9] = m[6]; out[10] = m[10]; out[11] = m[14];
      out[12] = m[3]; out[13] = m[7]; out[14] = m[11]; out[15] = m[15];
    }
    return out;
  },

  // Invert matrix
  invert: (out, m) => {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return out;
  },

  // Translation matrix
  translate: (out, v) => {
    mat4.identity(out);
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    return out;
  },

  // Scale matrix
  scale: (out, v) => {
    mat4.identity(out);
    out[0] = v[0];
    out[5] = v[1];
    out[10] = v[2];
    return out;
  },

  // Rotation around X axis
  rotateX: (out, angle) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    mat4.identity(out);
    out[5] = c; out[6] = s;
    out[9] = -s; out[10] = c;
    return out;
  },

  // Rotation around Y axis
  rotateY: (out, angle) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    mat4.identity(out);
    out[0] = c; out[2] = -s;
    out[8] = s; out[10] = c;
    return out;
  },

  // Rotation around Z axis
  rotateZ: (out, angle) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    mat4.identity(out);
    out[0] = c; out[1] = s;
    out[4] = -s; out[5] = c;
    return out;
  },

  // Rotation from Euler angles (ZYX order)
  fromEuler: (out, x, y, z) => {
    const cx = Math.cos(x), sx = Math.sin(x);
    const cy = Math.cos(y), sy = Math.sin(y);
    const cz = Math.cos(z), sz = Math.sin(z);

    out[0] = cy * cz;
    out[1] = cy * sz;
    out[2] = -sy;
    out[3] = 0;
    out[4] = sx * sy * cz - cx * sz;
    out[5] = sx * sy * sz + cx * cz;
    out[6] = sx * cy;
    out[7] = 0;
    out[8] = cx * sy * cz + sx * sz;
    out[9] = cx * sy * sz - sx * cz;
    out[10] = cx * cy;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;

    return out;
  },

  // Rotation from axis-angle
  fromAxisAngle: (out, axis, angle) => {
    let x = axis[0], y = axis[1], z = axis[2];
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len < 0.00001) return mat4.identity(out);
    x /= len; y /= len; z /= len;

    const c = Math.cos(angle), s = Math.sin(angle);
    const t = 1 - c;

    out[0] = t * x * x + c;
    out[1] = t * x * y + s * z;
    out[2] = t * x * z - s * y;
    out[3] = 0;
    out[4] = t * x * y - s * z;
    out[5] = t * y * y + c;
    out[6] = t * y * z + s * x;
    out[7] = 0;
    out[8] = t * x * z + s * y;
    out[9] = t * y * z - s * x;
    out[10] = t * z * z + c;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;

    return out;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Projection Matrices
  // ─────────────────────────────────────────────────────────────────────────

  // Perspective projection
  perspective: (fovY, aspect, near, far, out = mat4.create()) => {
    const f = 1.0 / Math.tan(fovY * Math.PI / 360);
    const nf = 1 / (near - far);

    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = 2 * far * near * nf;
    out[15] = 0;

    return out;
  },

  // Orthographic projection
  ortho: (left, right, bottom, top, near, far, out = mat4.create()) => {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 2 * nf;
    out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;

    return out;
  },

  // Look-at view matrix
  lookAt: (eye, center, up, out = mat4.create()) => {

    const zx = eye[0] - center[0];
    const zy = eye[1] - center[1];
    const zz = eye[2] - center[2];
    let len = Math.sqrt(zx * zx + zy * zy + zz * zz);
    const z = [zx / len, zy / len, zz / len];

    const xx = up[1] * z[2] - up[2] * z[1];
    const xy = up[2] * z[0] - up[0] * z[2];
    const xz = up[0] * z[1] - up[1] * z[0];
    len = Math.sqrt(xx * xx + xy * xy + xz * xz);
    const x = len ? [xx / len, xy / len, xz / len] : [0, 0, 0];

    const y = [
      z[1] * x[2] - z[2] * x[1],
      z[2] * x[0] - z[0] * x[2],
      z[0] * x[1] - z[1] * x[0]
    ];

    out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
    out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
    out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
    out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
    out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
    out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
    out[15] = 1;

    return out;
  },

  // Model matrix from position, rotation (euler), and scale
  fromTRS: (position, rotation, scale) => {
    const out = mat4.create();

    // Rotation (from euler angles in radians)
    mat4.fromEuler(out, rotation[0], rotation[1], rotation[2]);

    // Scale
    out[0] *= scale[0]; out[1] *= scale[0]; out[2] *= scale[0];
    out[4] *= scale[1]; out[5] *= scale[1]; out[6] *= scale[1];
    out[8] *= scale[2]; out[9] *= scale[2]; out[10] *= scale[2];

    // Translation
    out[12] = position[0];
    out[13] = position[1];
    out[14] = position[2];

    return out;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Quat — Quaternion Operations
// ─────────────────────────────────────────────────────────────────────────────

export const quat = {
  create: () => new Float32Array([0, 0, 0, 1]),

  identity: (out) => {
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1;
    return out;
  },

  clone: (q) => new Float32Array([q[0], q[1], q[2], q[3]]),

  fromEuler: (out, x, y, z) => {
    const hx = x * 0.5, hy = y * 0.5, hz = z * 0.5;
    const cx = Math.cos(hx), sx = Math.sin(hx);
    const cy = Math.cos(hy), sy = Math.sin(hy);
    const cz = Math.cos(hz), sz = Math.sin(hz);

    out[0] = sx * cy * cz - cx * sy * sz;
    out[1] = cx * sy * cz + sx * cy * sz;
    out[2] = cx * cy * sz - sx * sy * cz;
    out[3] = cx * cy * cz + sx * sy * sz;
    return out;
  },

  fromAxisAngle: (out, axis, angle) => {
    const ha = angle * 0.5;
    const s = Math.sin(ha);
    out[0] = axis[0] * s;
    out[1] = axis[1] * s;
    out[2] = axis[2] * s;
    out[3] = Math.cos(ha);
    return out;
  },

  multiply: (out, a, b) => {
    const ax = a[0], ay = a[1], az = a[2], aw = a[3];
    const bx = b[0], by = b[1], bz = b[2], bw = b[3];

    out[0] = ax * bw + aw * bx + ay * bz - az * by;
    out[1] = ay * bw + aw * by + az * bx - ax * bz;
    out[2] = az * bw + aw * bz + ax * by - ay * bx;
    out[3] = aw * bw - ax * bx - ay * by - az * bz;
    return out;
  },

  normalize: (out, q) => {
    const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    if (len > 0) {
      const inv = 1 / len;
      out[0] = q[0] * inv;
      out[1] = q[1] * inv;
      out[2] = q[2] * inv;
      out[3] = q[3] * inv;
    }
    return out;
  },

  slerp: (out, a, b, t) => {
    let ax = a[0], ay = a[1], az = a[2], aw = a[3];
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];

    let cosOmega = ax * bx + ay * by + az * bz + aw * bw;

    if (cosOmega < 0) {
      cosOmega = -cosOmega;
      bx = -bx; by = -by; bz = -bz; bw = -bw;
    }

    let k0, k1;
    if (cosOmega > 0.9999) {
      k0 = 1 - t;
      k1 = t;
    } else {
      const sinOmega = Math.sqrt(1 - cosOmega * cosOmega);
      const omega = Math.atan2(sinOmega, cosOmega);
      const oneOverSin = 1 / sinOmega;
      k0 = Math.sin((1 - t) * omega) * oneOverSin;
      k1 = Math.sin(t * omega) * oneOverSin;
    }

    out[0] = k0 * ax + k1 * bx;
    out[1] = k0 * ay + k1 * by;
    out[2] = k0 * az + k1 * bz;
    out[3] = k0 * aw + k1 * bw;
    return out;
  },

  toMat4: (out, q) => {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;
    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;
    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;

    return out;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Camera Plugin — Easy camera setup for 3D scenes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a camera object containing projection and view matrices and helpers.
 * @param {object} [options]
 * @returns {object} Camera with matrices and update methods.
 */
export function camera(options = {}) {
  const {
    fov = 60,
    near = 0.1,
    far = 1000,
    position = [0, 0, 5],
    target = [0, 0, 0],
    up = [0, 1, 0],
    type = 'perspective',        // 'perspective' or 'ortho'
    orthoSize = 5,               // For ortho: half-height of the view
  } = options;

  let projectionMatrix = mat4.create();
  let viewMatrix = mat4.create();
  let viewProjectionMatrix = mat4.create();

  const pos = vec3.clone(position);
  const tgt = vec3.clone(target);
  const upVec = vec3.clone(up);

  const updateProjection = (aspect) => {
    if (type === 'ortho') {
      const hw = orthoSize * aspect;
      mat4.ortho(-hw, hw, -orthoSize, orthoSize, near, far, projectionMatrix);
    } else {
      mat4.perspective(fov, aspect, near, far, projectionMatrix);
    }
  };

  const updateView = () => {
    mat4.lookAt(pos, tgt, upVec, viewMatrix);
  };

  const updateViewProjection = () => {
    mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);
  };

  return {
    name: 'camera',

    init(ctx) {
      updateProjection(ctx.aspect);
      updateView();
      updateViewProjection();

      ctx.state.camera = {
        position: pos,
        target: tgt,
        projection: projectionMatrix,
        view: viewMatrix,
        viewProjection: viewProjectionMatrix,
      };
    },

    resize(ctx) {
      updateProjection(ctx.aspect);
      updateViewProjection();
    },

    render(ctx) {
      if (!ctx.program) return;
      const gl = ctx.gl;

      // Set camera uniforms
      const projLoc = gl.getUniformLocation(ctx.program, 'projectionMatrix');
      const viewLoc = gl.getUniformLocation(ctx.program, 'viewMatrix');
      const vpLoc = gl.getUniformLocation(ctx.program, 'viewProjectionMatrix');
      const camPosLoc = gl.getUniformLocation(ctx.program, 'cameraPosition');

      if (projLoc) gl.uniformMatrix4fv(projLoc, false, projectionMatrix);
      if (viewLoc) gl.uniformMatrix4fv(viewLoc, false, viewMatrix);
      if (vpLoc) gl.uniformMatrix4fv(vpLoc, false, viewProjectionMatrix);
      if (camPosLoc) gl.uniform3fv(camPosLoc, pos);
    },

    // API for runtime updates
    setPosition(x, y, z) {
      pos[0] = x; pos[1] = y; pos[2] = z;
      updateView();
      updateViewProjection();
      return this;
    },

    setTarget(x, y, z) {
      tgt[0] = x; tgt[1] = y; tgt[2] = z;
      updateView();
      updateViewProjection();
      return this;
    },

    get position() { return pos; },
    get target() { return tgt; },
    get projection() { return projectionMatrix; },
    get view() { return viewMatrix; },
    get viewProjection() { return viewProjectionMatrix; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orbit Controls Plugin — Mouse/touch orbit camera
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attach simple orbit controls to a camera object, updating the camera on input.
 * @param {object} cam Camera created via `camera()`.
 * @param {object} [options]
 * @returns {object} Controls handle with `update()` and `dispose()`.
 */
export function orbitControls(cam, options = {}) {
  const {
    rotateSpeed = 0.005,
    zoomSpeed = 0.001,
    minDistance = 1,
    maxDistance = 100,
    minPolarAngle = 0.1,
    maxPolarAngle = Math.PI - 0.1,
  } = options;

  let theta = 0;       // Horizontal angle
  let phi = Math.PI / 4;  // Vertical angle
  let radius = 5;

  // Calculate initial angles from camera position
  const initFromCamera = () => {
    const dx = cam.position[0] - cam.target[0];
    const dy = cam.position[1] - cam.target[1];
    const dz = cam.position[2] - cam.target[2];
    radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
    theta = Math.atan2(dx, dz);
    phi = Math.acos(Math.max(-1, Math.min(1, dy / radius)));
  };

  const updateCameraPosition = () => {
    const x = radius * Math.sin(phi) * Math.sin(theta) + cam.target[0];
    const y = radius * Math.cos(phi) + cam.target[1];
    const z = radius * Math.sin(phi) * Math.cos(theta) + cam.target[2];
    cam.setPosition(x, y, z);
  };

  let lastMouse = [0, 0];
  let isDragging = false;

  return {
    name: 'orbitControls',

    init(ctx) {
      initFromCamera();

      ctx.canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMouse = [e.clientX, e.clientY];
      });

      ctx.canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastMouse[0];
        const dy = e.clientY - lastMouse[1];
        lastMouse = [e.clientX, e.clientY];

        theta -= dx * rotateSpeed;
        phi += dy * rotateSpeed;
        phi = Math.max(minPolarAngle, Math.min(maxPolarAngle, phi));

        updateCameraPosition();
      });

      ctx.canvas.addEventListener('mouseup', () => { isDragging = false; });
      ctx.canvas.addEventListener('mouseleave', () => { isDragging = false; });

      ctx.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = Math.exp(e.deltaY * zoomSpeed * 2.0);
        radius *= factor;
        radius = Math.max(minDistance, Math.min(maxDistance, radius));
        updateCameraPosition();
      }, { passive: false });

      // Touch support
      let lastTouch = [0, 0];
      let lastTouchDist = 0;

      ctx.canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          isDragging = true;
          lastTouch = [e.touches[0].clientX, e.touches[0].clientY];
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastTouchDist = Math.sqrt(dx * dx + dy * dy);
        }
      }, { passive: true });

      ctx.canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
          const dx = e.touches[0].clientX - lastTouch[0];
          const dy = e.touches[0].clientY - lastTouch[1];
          lastTouch = [e.touches[0].clientX, e.touches[0].clientY];

          theta -= dx * rotateSpeed;
          phi += dy * rotateSpeed;
          phi = Math.max(minPolarAngle, Math.min(maxPolarAngle, phi));

          updateCameraPosition();
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          radius += (lastTouchDist - dist) * zoomSpeed * 10;
          radius = Math.max(minDistance, Math.min(maxDistance, radius));

          lastTouchDist = dist;
          updateCameraPosition();
        }
      }, { passive: false });

      ctx.canvas.addEventListener('touchend', () => { isDragging = false; });
    },

    update(ctx) {
      if (!isDragging && options.autoRotate) {
        theta += (options.autoRotateSpeed || 0.1) * ctx.delta;
        updateCameraPosition();
      }
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

export const deg2rad = (deg) => deg * Math.PI / 180;
export const rad2deg = (rad) => rad * 180 / Math.PI;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const lerp = (a, b, t) => a + t * (b - a);

export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

// ─────────────────────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────────────────────

export default {
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
};

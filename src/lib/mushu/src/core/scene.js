/**
 * mushu/core/scene — Scene Graph for Multi-Object 3D Scenes
 * 
 * A scene graph system for organizing and rendering multiple objects:
 * - Hierarchical transforms (parent/child relationships)
 * - Object registry with unique IDs
 * - Automatic world matrix calculation
 * - Bounding box management
 * - Easy object composition
 * 
 * Usage:
 *   import { mushuScene, SceneObject } from 'mushu/core';
 *   
 *   const myScene = mushuScene('#canvas')
 *     .add('cube', { material: metal, position: [0,0,0] })
 *     .add('sphere', { material: glass, parent: 'cube' })
 *     .go()
 * 
 * @module mushu/core/scene
 */

import { mat4 } from './transforms.js';
import { Loader } from './loader.js';

// ═══════════════════════════════════════════════════════════════════════════
// mushu/core/scene — Scene Graph System
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// SceneObject — Individual Object in the Scene Graph
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SceneObject represents an individual renderable object in the scene.
 * Supports hierarchical transforms, materials, and custom data.
 */
export class SceneObject {
    /**
     * Create a new scene object.
     * @param {Object} options
     * @param {string} options.id - Unique identifier
     * @param {string|SceneObject} options.parent - Parent object or ID
     * @param {Material} options.material - Material to use
     * @param {Object|Function} options.geometry - Geometry data or generator
     * @param {Array<number>} options.position - Local position [x, y, z]
     * @param {Array<number>} options.rotation - Local rotation (Euler) [x, y, z] in radians
     * @param {Array<number>} options.scale - Local scale [x, y, z]
     * @param {boolean} options.visible - Visibility flag
     * @param {boolean} options.castShadow - Cast shadow
     * @param {boolean} options.receiveShadow - Receive shadow
     * @param {Object} options.userData - Custom user data
     */
    constructor(options = {}) {
        this.id = options.id || `object_${Math.random().toString(36).substr(2, 9)}`;
        this.parent = options.parent || null;
        this.children = [];
        this.material = options.material || null;
        this.geometry = options.geometry || null;

        // Local transform
        this.position = new Float32Array(options.position || [0, 0, 0]);
        this.rotation = new Float32Array(options.rotation || [0, 0, 0]);  // Euler angles
        this.scale = new Float32Array(options.scale || [1, 1, 1]);

        // Matrices
        this.localMatrix = new Float32Array(16);
        this.worldMatrix = new Float32Array(16);
        this.normalMatrix = new Float32Array(16);

        // State
        this.visible = options.visible !== false;
        this.castShadow = options.castShadow !== false;
        this.receiveShadow = options.receiveShadow !== false;
        this.userData = options.userData || {};

        // Geometry state
        this._vao = null;
        this._vertexCount = 0;
        this._indexCount = 0;
        this._indexType = 0;
        this._drawMode = 0;
        this._geometryInitialized = false;

        // Material state
        this._materialInitialized = false;

        // Bounding box (local space)
        this.boundingBox = {
            min: new Float32Array([-Infinity, -Infinity, -Infinity]),
            max: new Float32Array([Infinity, Infinity, Infinity]),
        };

        // World bounding box (computed)
        this.worldBoundingBox = {
            min: new Float32Array(3),
            max: new Float32Array(3),
        };

        this._updateLocalMatrix();
    }

    /**
     * Set position.
     * @param {Array<number>|number} x - X coordinate or [x,y,z] array
     * @param {number} [y] - Y coordinate
     * @param {number} [z] - Z coordinate
     * @returns {this}
     */
    setPosition(x, y, z) {
        if (Array.isArray(x)) {
            this.position[0] = x[0];
            this.position[1] = x[1];
            this.position[2] = x[2];
        } else {
            this.position[0] = x;
            this.position[1] = y;
            this.position[2] = z;
        }
        this._updateLocalMatrix();
        return this;
    }

    /**
     * Set rotation (Euler angles in radians).
     * @param {Array<number>|number} x - X rotation or [x,y,z] array
     * @param {number} [y] - Y rotation
     * @param {number} [z] - Z rotation
     * @returns {this}
     */
    setRotation(x, y, z) {
        if (Array.isArray(x)) {
            this.rotation[0] = x[0];
            this.rotation[1] = x[1];
            this.rotation[2] = x[2];
        } else {
            this.rotation[0] = x;
            this.rotation[1] = y;
            this.rotation[2] = z;
        }
        this._updateLocalMatrix();
        return this;
    }

    /**
     * Set scale.
     * @param {Array<number>|number} x - X scale or [x,y,z] array
     * @param {number} [y] - Y scale
     * @param {number} [z] - Z scale
     * @returns {this}
     */
    setScale(x, y, z) {
        if (Array.isArray(x)) {
            this.scale[0] = x[0];
            this.scale[1] = x[1];
            this.scale[2] = x[2];
        } else {
            this.scale[0] = x;
            this.scale[1] = y !== undefined ? y : x;
            this.scale[2] = z !== undefined ? z : x;
        }
        this._updateLocalMatrix();
        return this;
    }

    /**
     * Translate relative to current position.
     * @param {Array<number>|number} x - X delta or [x,y,z] array
     * @param {number} [y] - Y delta
     * @param {number} [z] - Z delta
     * @returns {this}
     */
    translate(x, y, z) {
        if (Array.isArray(x)) {
            this.position[0] += x[0];
            this.position[1] += x[1];
            this.position[2] += x[2];
        } else {
            this.position[0] += x;
            this.position[1] += y;
            this.position[2] += z;
        }
        this._updateLocalMatrix();
        return this;
    }

    /**
     * Rotate by Euler angles (relative).
     * @param {Array<number>|number} x - X rotation or [x,y,z] array
     * @param {number} [y] - Y rotation
     * @param {number} [z] - Z rotation
     * @returns {this}
     */
    rotate(x, y, z) {
        if (Array.isArray(x)) {
            this.rotation[0] += x[0];
            this.rotation[1] += x[1];
            this.rotation[2] += x[2];
        } else {
            this.rotation[0] += x;
            this.rotation[1] += y;
            this.rotation[2] += z;
        }
        this._updateLocalMatrix();
        return this;
    }

    /**
     * Rotate around X axis.
     * @param {number} angle - Angle in radians
     * @returns {this}
     */
    rotateX(angle) {
        this.rotation[0] += angle;
        this._updateLocalMatrix();
        return this;
    }

    /**
     * Rotate around Y axis.
     * @param {number} angle - Angle in radians
     * @returns {this}
     */
    rotateY(angle) {
        this.rotation[1] += angle;
        this._updateLocalMatrix();
        return this;
    }

    /**
     * Rotate around Z axis.
     * @param {number} angle - Angle in radians
     * @returns {this}
     */
    rotateZ(angle) {
        this.rotation[2] += angle;
        this._updateLocalMatrix();
        return this;
    }

    /**
     * Set material.
     * @param {Material} material - Material to use
     * @returns {this}
     */
    setMaterial(material) {
        this.material = material;
        this._materialInitialized = false;
        return this;
    }

    /**
     * Set geometry.
     * @param {Object} geometry - Geometry data
     * @returns {this}
     */
    setGeometry(geometry) {
        this.geometry = geometry;
        this._geometryInitialized = false;
        return this;
    }

    /**
     * Add a child object.
     * @param {SceneObject} child - Child object
     * @returns {this}
     */
    addChild(child) {
        if (child.parent) {
            child.parent.removeChild(child);
        }
        child.parent = this;
        this.children.push(child);
        return this;
    }

    /**
     * Remove a child object.
     * @param {SceneObject} child - Child object
     * @returns {this}
     */
    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) {
            this.children.splice(idx, 1);
            child.parent = null;
        }
        return this;
    }

    /**
     * Find a child by ID (recursive).
     * @param {string} id - Object ID to find
     * @returns {SceneObject|null}
     */
    findById(id) {
        if (this.id === id) return this;
        for (const child of this.children) {
            const found = child.findById(id);
            if (found) return found;
        }
        return null;
    }

    /**
     * Get all descendants (recursive).
     * @returns {SceneObject[]}
     */
    getDescendants() {
        const result = [];
        for (const child of this.children) {
            result.push(child);
            result.push(...child.getDescendants());
        }
        return result;
    }

    /**
     * Initialize geometry (create VAO).
     * @param {Object} ctx - Flow context
     */
    initGeometry(ctx) {
        if (this._geometryInitialized || !this.geometry) return;

        // If geometry is a function, call it to get the actual geometry
        let geom = this.geometry;
        if (typeof geom === 'function') {
            geom = geom();
            this.geometry = geom; // Cache the result
        }

        // Check if geometry is a Promise (async loading)
        if (geom instanceof Promise) {
            geom.then(data => {
                this.geometry = data;
                this._geometryInitialized = false;
                this.initGeometry(ctx);
            });
            return;
        }

        // Check if geometry is a plugin (has init method)
        if (typeof geom.init === 'function') {
            // Initialize as plugin
            geom.init(ctx);
            this._vao = ctx.state.vao;
            this._vertexCount = ctx.state.vertexCount || 0;
            this._indexCount = ctx.state.indexCount || 0;
            this._indexType = ctx.state.indexType || ctx.gl.UNSIGNED_SHORT;
            this._drawMode = ctx.state.drawMode || ctx.gl.TRIANGLES;
            this._geometryInitialized = true;
            return;
        }

        // Otherwise, treat as data object
        const gl = ctx.gl;

        // Create VAO from geometry data
        this._vao = gl.createVertexArray();
        gl.bindVertexArray(this._vao);

        const createBuffer = (data, target = gl.ARRAY_BUFFER) => {
            const buffer = gl.createBuffer();
            gl.bindBuffer(target, buffer);
            const typedData = data instanceof Float32Array ? data :
                target === gl.ELEMENT_ARRAY_BUFFER ?
                    (data.some(i => i > 65535) ? new Uint32Array(data) : new Uint16Array(data)) :
                    new Float32Array(data);
            gl.bufferData(target, typedData, gl.STATIC_DRAW);
            return { buffer, typedData };
        };

        // Positions
        if (this.geometry.positions) {
            const { buffer } = createBuffer(this.geometry.positions);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            this._vertexCount = this.geometry.positions.length / 3;
        }

        // Normals
        if (this.geometry.normals) {
            const { buffer } = createBuffer(this.geometry.normals);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        }

        // UVs
        if (this.geometry.uvs) {
            const { buffer } = createBuffer(this.geometry.uvs);
            gl.enableVertexAttribArray(2);
            gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
        }

        // Colors
        if (this.geometry.colors) {
            const { buffer } = createBuffer(this.geometry.colors);
            gl.enableVertexAttribArray(3);
            gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
        }

        // Indices
        if (this.geometry.indices) {
            const { buffer, typedData } = createBuffer(this.geometry.indices, gl.ELEMENT_ARRAY_BUFFER);
            this._indexCount = typedData.length;
            this._indexType = typedData instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        }

        this._drawMode = gl[this.geometry.drawMode || 'TRIANGLES'] || gl.TRIANGLES;

        gl.bindVertexArray(null);
        this._geometryInitialized = true;
    }

    /**
     * Initialize material.
     * @param {Object} ctx - Flow context
     */
    initMaterial(ctx) {
        if (this._materialInitialized || !this.material) return;
        if (this.material.init) this.material.init(ctx);
        this._materialInitialized = true;
    }

    /**
     * Render the object and its children.
     * @param {Object} ctx - Flow context
     * @param {Float32Array} parentMatrix - Parent world matrix
     */
    render(ctx, parentMatrix = null) {
        if (!this.visible) return;

        // Calculate world matrix
        this._updateWorldMatrix(parentMatrix);

        // Update bounding box
        this._updateWorldBoundingBox();

        // Bind material
        if (this.material) {
            this.initMaterial(ctx);
            if (this.material.bind) {
                this.material.bind(ctx);
            }
        }

        // Initialize geometry if needed
        this.initGeometry(ctx);

        // Set camera uniforms
        if (ctx.program && ctx.state.camera) {
            const gl = ctx.gl;
            const cam = ctx.state.camera;
            const viewLoc = gl.getUniformLocation(ctx.program, 'viewMatrix');
            if (viewLoc) gl.uniformMatrix4fv(viewLoc, false, cam.view);
            const projLoc = gl.getUniformLocation(ctx.program, 'projectionMatrix');
            if (projLoc) gl.uniformMatrix4fv(projLoc, false, cam.projection);

            const camPosLoc = gl.getUniformLocation(ctx.program, 'cameraPosition');
            if (camPosLoc && cam.position && cam.position.length === 3) {
                gl.uniform3fv(camPosLoc, cam.position);
            }
        }

        // Set model matrix uniform
        if (ctx.program) {
            const modelLoc = ctx.gl.getUniformLocation(ctx.program, 'modelMatrix');
            if (modelLoc) {
                ctx.gl.uniformMatrix4fv(modelLoc, false, this.worldMatrix);
            }
            // Normal matrix
            const normalLoc = ctx.gl.getUniformLocation(ctx.program, 'normalMatrix');
            if (normalLoc) {
                this._computeNormalMatrix();
                ctx.gl.uniformMatrix4fv(normalLoc, false, this.normalMatrix);
            }
        }

        // Draw geometry
        if (this._vao) {
            ctx.gl.bindVertexArray(this._vao);
            if (this._indexCount > 0) {
                ctx.gl.drawElements(this._drawMode, this._indexCount, this._indexType, 0);
            } else {
                ctx.gl.drawArrays(this._drawMode, 0, this._vertexCount);
            }
        }

        // Render children
        for (const child of this.children) {
            child.render(ctx, this.worldMatrix);
        }
    }

    /**
     * Update local matrix from position, rotation, scale.
     */
    _updateLocalMatrix() {
        const [x, y, z] = this.position;
        const [rx, ry, rz] = this.rotation;
        const [sx, sy, sz] = this.scale;

        // Create rotation matrix from Euler angles
        const cx = Math.cos(rx), sx_ = Math.sin(rx);
        const cy = Math.cos(ry), sy_ = Math.sin(ry);
        const cz = Math.cos(rz), sz_ = Math.sin(rz);

        // Combined rotation (ZYX order)
        const r00 = cy * cz, r01 = cy * sz_, r02 = -sy;
        const r10 = sx_ * sy * cz - cx * sz_, r11 = sx_ * sy * sz_ + cx * cz, r12 = sx_ * cy;
        const r20 = cx * sy * cz + sx_ * sz_, r21 = cx * sy * sz_ - sx_ * cz, r22 = cx * cy;

        // Apply scale and rotation, then translation
        // Apply scale and rotation, then translation (Column-Major)
        this.localMatrix.set([
            r00 * sx, r01 * sx, r02 * sx, 0,
            r10 * sy, r11 * sy, r12 * sy, 0,
            r20 * sz, r21 * sz, r22 * sz, 0,
            x, y, z, 1
        ]);
    }

    /**
     * Update world matrix from local and parent matrices.
     * @param {Float32Array} parentMatrix - Parent world matrix
     */
    _updateWorldMatrix(parentMatrix) {
        if (parentMatrix) {
            // Multiply parent * local
            const a = this.localMatrix;
            const b = parentMatrix;
            this.worldMatrix.set([
                b[0] * a[0] + b[4] * a[1] + b[8] * a[2] + b[12] * a[3],
                b[1] * a[0] + b[5] * a[1] + b[9] * a[2] + b[13] * a[3],
                b[2] * a[0] + b[6] * a[1] + b[10] * a[2] + b[14] * a[3],
                b[3] * a[0] + b[7] * a[1] + b[11] * a[2] + b[15] * a[3],

                b[0] * a[4] + b[4] * a[5] + b[8] * a[6] + b[12] * a[7],
                b[1] * a[4] + b[5] * a[5] + b[9] * a[6] + b[13] * a[7],
                b[2] * a[4] + b[6] * a[5] + b[10] * a[6] + b[14] * a[7],
                b[3] * a[4] + b[7] * a[5] + b[11] * a[6] + b[15] * a[7],

                b[0] * a[8] + b[4] * a[9] + b[8] * a[10] + b[12] * a[11],
                b[1] * a[8] + b[5] * a[9] + b[9] * a[10] + b[13] * a[11],
                b[2] * a[8] + b[6] * a[9] + b[10] * a[10] + b[14] * a[11],
                b[3] * a[8] + b[7] * a[9] + b[11] * a[10] + b[15] * a[11],

                b[0] * a[12] + b[4] * a[13] + b[8] * a[14] + b[12] * a[15],
                b[1] * a[12] + b[5] * a[13] + b[9] * a[14] + b[13] * a[15],
                b[2] * a[12] + b[6] * a[13] + b[10] * a[14] + b[14] * a[15],
                b[3] * a[12] + b[7] * a[13] + b[11] * a[14] + b[15] * a[15],
            ]);
        } else {
            this.worldMatrix.set(this.localMatrix);
        }
    }

    /**
     * Compute normal matrix from world matrix.
     */
    /**
     * Compute normal matrix from world matrix.
     */
    _computeNormalMatrix() {
        // Normal Matrix = Transpose(Inverse(WorldMatrix))
        // This handles non-uniform scaling correctly.

        if (!this._tempMat4) {
            this._tempMat4 = new Float32Array(16);
        }

        // Try to invert
        if (mat4.invert(this._tempMat4, this.worldMatrix)) {
            // Transpose the inverse
            mat4.transpose(this.normalMatrix, this._tempMat4);
        } else {
            // Fallback (e.g. scale 0) - just copy rotation part
            this.normalMatrix.set(this.worldMatrix);
            this.normalMatrix[12] = 0;
            this.normalMatrix[13] = 0;
            this.normalMatrix[14] = 0;
        }
    }

    /**
     * Update world bounding box.
     */
    _updateWorldBoundingBox() {
        const min = this.boundingBox.min;
        const max = this.boundingBox.max;
        const wbb = this.worldBoundingBox;
        const m = this.worldMatrix;

        const corners = [
            [min[0], min[1], min[2]],
            [min[0], min[1], max[2]],
            [min[0], max[1], min[2]],
            [min[0], max[1], max[2]],
            [max[0], min[1], min[2]],
            [max[0], min[1], max[2]],
            [max[0], max[1], min[2]],
            [max[0], max[1], max[2]],
        ];

        wbb.min[0] = wbb.min[1] = wbb.min[2] = Infinity;
        wbb.max[0] = wbb.max[1] = wbb.max[2] = -Infinity;

        for (const corner of corners) {
            const x = corner[0], y = corner[1], z = corner[2];
            const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
            const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
            const wz = m[2] * x + m[6] * y + m[10] * z + m[14];

            wbb.min[0] = Math.min(wbb.min[0], wx);
            wbb.min[1] = Math.min(wbb.min[1], wy);
            wbb.min[2] = Math.min(wbb.min[2], wz);
            wbb.max[0] = Math.max(wbb.max[0], wx);
            wbb.max[1] = Math.max(wbb.max[1], wy);
            wbb.max[2] = Math.max(wbb.max[2], wz);
        }
    }

    /**
     * Dispose of GPU resources.
     * @param {Object} ctx - Flow context
     */
    destroy(ctx) {
        if (this._vao) ctx.gl.deleteVertexArray(this._vao);
        if (this.material && this.material.destroy) {
            this.material.destroy(ctx);
        }
        for (const child of this.children) {
            child.destroy(ctx);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene — Main Scene Graph Container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scene manages a collection of SceneObjects and handles the render loop.
 */
export class Scene {
    /**
     * Create a new scene.
     * @param {Object} options
     * @param {HTMLCanvasElement|string} options.canvas - Canvas element or selector
     * @param {Object} options.settings - Scene settings
     */
    constructor(options = {}) {
        this.canvas = null;
        this.gl = null;
        this.ctx = null;

        // Object registry
        this._objects = new Map();
        this.rootObjects = [];

        // Geometry presets
        this._geometryPresets = {};

        // Scene settings
        this.settings = {
            clearColor: [0.1, 0.1, 0.12, 1],
            autoResize: true,
            ...options.settings,
        };

        // Animation state
        this._animationLoop = null;
        this._running = false;

        // Plugins/extensions
        this._plugins = [];

        // User data
        this.userData = {};

        this._initCanvas(options.canvas);
    }

    /**
     * Initialize canvas from various inputs.
     * @param {HTMLCanvasElement|string} canvas - Canvas or selector
     */
    _initCanvas(canvas) {
        if (!canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
            document.body.appendChild(this.canvas);
        } else if (typeof canvas === 'string') {
            this.canvas = document.querySelector(canvas);
            if (!this.canvas) {
                this.canvas = document.createElement('canvas');
                this.canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
                document.body.appendChild(this.canvas);
            }
        } else {
            this.canvas = canvas;
        }

        this.gl = this.canvas.getContext('webgl2');
        if (!this.gl) {
            console.error('WebGL2 not supported');
            return;
        }

        // Initialize context
        this.ctx = {
            gl: this.gl,
            canvas: this.canvas,
            time: 0,
            delta: 0,
            frame: 0,
            width: 0,
            height: 0,
            aspect: 1,
            mouse: [0.5, 0.5],
            mouseNDC: [0, 0],
            mouseDown: false,
            mouseVelocity: [0, 0],
            program: null,
            state: {
                camera: null,
                materials: [],
            },
        };

        this._resize();
        this._setupEventListeners();
    }

    /**
     * Set up event listeners for mouse/touch/resize.
     */
    _setupEventListeners() {
        const onResize = () => this._resize();
        const onMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.ctx.mouse[0] = (e.clientX - rect.left) / rect.width;
            this.ctx.mouse[1] = (e.clientY - rect.top) / rect.height;
            this.ctx.mouseNDC[0] = this.ctx.mouse[0] * 2 - 1;
            this.ctx.mouseNDC[1] = 1 - this.ctx.mouse[1] * 2;
        };
        const onMouseDown = () => { this.ctx.mouseDown = true; };
        const onMouseUp = () => { this.ctx.mouseDown = false; };

        window.addEventListener('resize', onResize);
        this.canvas.addEventListener('mousemove', onMouseMove);
        this.canvas.addEventListener('mousedown', onMouseDown);
        this.canvas.addEventListener('mouseup', onMouseUp);
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const rect = this.canvas.getBoundingClientRect();
                this.ctx.mouse[0] = (e.touches[0].clientX - rect.left) / rect.width;
                this.ctx.mouse[1] = (e.touches[0].clientY - rect.top) / rect.height;
            }
        }, { passive: true });
        this.canvas.addEventListener('touchstart', onMouseDown, { passive: true });
        this.canvas.addEventListener('touchend', onMouseUp);

        this._cleanupListeners = () => {
            window.removeEventListener('resize', onResize);
            this.canvas.removeEventListener('mousemove', onMouseMove);
            this.canvas.removeEventListener('mousedown', onMouseDown);
            this.canvas.removeEventListener('mouseup', onMouseUp);
        };
    }

    /**
     * Handle canvas resize.
     */
    _resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.width = this.canvas.width;
        this.ctx.height = this.canvas.height;
        this.ctx.aspect = this.canvas.width / this.canvas.height;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // Notify plugins of resize
        for (const plugin of this._plugins) {
            if (plugin.resize) {
                plugin.resize(this.ctx);
            }
        }
    }

    /**
     * Add an object to the scene.
     * @param {string} id - Unique identifier
     * @param {Object} options - Object options
     * @returns {SceneObject} The created object
     */
    add(id, options = {}) {
        // Resolve parent
        let parent = options.parent || null;
        if (typeof parent === 'string') {
            parent = this.objects.get(parent) || null;
        }

        const obj = new SceneObject({
            id,
            parent,
            material: options.material || null,
            geometry: options.geometry || null,
            position: options.position,
            rotation: options.rotation,
            scale: options.scale,
            visible: options.visible,
            castShadow: options.castShadow,
            receiveShadow: options.receiveShadow,
            userData: options.userData,
        });

        // Set geometry if provided as string (geometry name)
        if (typeof options.geometry === 'string') {
            const preset = this._getGeometryPreset(options.geometry);
            if (preset) {
                obj.geometry = preset;
            }
        } else if (options.geometry instanceof Promise) {
            obj.geometry = options.geometry;
        }

        this._objects.set(id, obj);

        if (parent) {
            parent.addChild(obj);
        } else {
            this.rootObjects.push(obj);
        }

        return obj;
    }

    /**
     * Get an object by ID.
     * @param {string} id - Object ID
     * @returns {SceneObject|null}
     */
    get(id) {
        return this._objects.get(id) || null;
    }

    /**
     * Remove an object from the scene.
     * @param {string|SceneObject} id - Object ID or object
     * @returns {this}
     */
    remove(id) {
        const obj = typeof id === 'string' ? this.objects.get(id) : id;
        if (!obj) return this;

        // Remove from parent's children
        if (obj.parent) {
            obj.parent.removeChild(obj);
        } else {
            const idx = this.rootObjects.indexOf(obj);
            if (idx >= 0) this.rootObjects.splice(idx, 1);
        }

        // Remove from registry
        this._objects.delete(obj.id);

        // Destroy GPU resources
        obj.destroy(this.ctx);

        return this;
    }

    /**
     * Clear all objects from the scene.
     * @returns {this}
     */
    clear() {
        for (const obj of this._objects.values()) {
            obj.destroy(this.ctx);
        }
        this._objects.clear();
        this.rootObjects = [];
        return this;
    }

    /**
     * Get a geometry preset by name.
     * @param {string} name - Geometry name
     * @returns {Object|null} Geometry data
     */
    _getGeometryPreset(name) {
        if (this._geometryPresets[name]) {
            return this._geometryPresets[name]();
        }
        return null;
    }

    /**
     * Register geometry presets.
     * @param {Object} presets - Object with preset name -> function pairs
     * @returns {this}
     */
    useGeometries(presets) {
        this._geometryPresets = { ...this._geometryPresets, ...presets };
        return this;
    }

    /**
     * Load an asset and register it as a geometry preset.
     * @param {string} id - Asset identifier
     * @param {string} url - Asset URL
     * @param {string} [type] - Asset type ('obj', 'gltf')
     * @returns {this}
     */
    load(id, url, type) {
        let promise;
        const extension = url.split('.').pop().toLowerCase();
        const assetType = type || (extension === 'obj' ? 'obj' : extension === 'gltf' ? 'gltf' : 'text');

        switch (assetType) {
            case 'obj':
                promise = Loader.obj(url);
                break;
            case 'gltf':
                promise = Loader.gltf(url);
                break;
            default:
                promise = fetch(url).then(r => r.text());
        }

        this.useGeometries({
            [id]: () => promise
        });

        return this;
    }

    /**
     * Load a 3D model file and add all its meshes to the scene.
     * Automatically handles OBJ/MTL, glTF, and extensible formats.
     * 
     * Usage:
     *   scene.loadModel('my-model', 'path/to/model.obj', {
     *     texturePath: 'path/to/textures/',
     *     material: customMaterial  // Optional: override default material
     *   })
     *   
     * @param {string} id - Model identifier (group name)
     * @param {string} url - Model file URL
     * @param {Object} options - Load options
     * @param {string} options.texturePath - Base path for texture references
     * @param {Object} options.mtlUrl - MTL file URL (for OBJ)
     * @param {string} options.format - Explicit format (auto-detected by default)
     * @param {Object} options.material - Material to apply to all meshes
     * @param {Array<number>} options.position - Model position
     * @param {Array<number>} options.rotation - Model rotation
     * @param {Array<number>} options.scale - Model scale
     * @returns {Promise<Array<SceneObject>>} Array of created mesh objects
     */
    async loadModel(id, url, options = {}) {
        try {
            const modelData = await Loader.model(url, {
                texturePath: options.texturePath || '',
                ...options,
            });

            const meshObjects = [];
            const parentGroup = new SceneObject({
                id,
                position: options.position,
                rotation: options.rotation,
                scale: options.scale,
            });
            this._objects.set(id, parentGroup);
            this.rootObjects.push(parentGroup);

            // Add each mesh as a child object
            for (let i = 0; i < modelData.meshes.length; i++) {
                const meshData = modelData.meshes[i];
                const meshId = `${id}_mesh_${i}`;

                const meshObj = new SceneObject({
                    id: meshId,
                    parent: parentGroup,
                    material: options.material || null,
                    geometry: meshData.geometry,
                    userData: {
                        meshName: meshData.name,
                        materialName: meshData.material?.name,
                        ...meshData.material,
                    },
                });

                this._objects.set(meshId, meshObj);
                parentGroup.addChild(meshObj);
                meshObjects.push(meshObj);
            }

            return meshObjects;
        } catch (err) {
            console.error('Failed to load model:', err);
            throw err;
        }
    }

    /**
     * Load a model with a specialized loader instance.
     * Useful for managing multiple models with shared caching.
     * 
     * @param {string} id - Model identifier
     * @param {string} url - Model URL
     * @param {ModelLoader} loader - ModelLoader instance
     * @param {Object} options - Additional options
     * @returns {Promise<Array<SceneObject>>} Created mesh objects
     */
    async loadModelWithLoader(id, url, loader, options = {}) {
        try {
            const modelData = await loader.load(url, options);

            const meshObjects = [];
            const parentGroup = new SceneObject({
                id,
                position: options.position,
                rotation: options.rotation,
                scale: options.scale,
            });
            this._objects.set(id, parentGroup);
            this.rootObjects.push(parentGroup);

            // Add each mesh as a child object
            for (let i = 0; i < modelData.meshes.length; i++) {
                const meshData = modelData.meshes[i];
                const meshId = `${id}_mesh_${i}`;

                const meshObj = new SceneObject({
                    id: meshId,
                    parent: parentGroup,
                    material: options.material || null,
                    geometry: meshData.geometry,
                    userData: {
                        meshName: meshData.name,
                        materialName: meshData.material?.name,
                        ...meshData.material,
                    },
                });

                this._objects.set(meshId, meshObj);
                parentGroup.addChild(meshObj);
                meshObjects.push(meshObj);
            }

            return meshObjects;
        } catch (err) {
            console.error('Failed to load model:', err);
            throw err;
        }
    }

    /**
     * Add a plugin to the scene.
     * @param {Object|Function} plugin - Plugin object or function
     * @returns {this}
     */
    use(plugin) {
        this._plugins.push(plugin);
        // If scene is already running, init immediately
        if (this._running && plugin.init) {
            plugin.init(this.ctx);
        }
        return this;
    }

    /**
     * Update scene (called each frame).
     * @param {number} time - Current time
     * @param {number} delta - Time since last frame
     */
    update(time, delta) {
        // Update plugins
        for (const plugin of this._plugins) {
            if (typeof plugin === 'function') {
                plugin(this.ctx);
            } else if (plugin.update) {
                plugin.update(this.ctx);
            }
        }

        // Update all objects
        for (const obj of this._objects.values()) {
            if (obj.userData.update) {
                obj.userData.update(obj, this.ctx);
            }
        }
    }

    /**
     * Render the scene.
     */
    render() {
        const gl = this.gl;

        // Clear
        const c = this.settings.clearColor;
        gl.clearColor(c[0] || 0, c[1] || 0, c[2] || 0, c[3] ?? 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        // Render plugins
        for (const plugin of this._plugins) {
            if (typeof plugin === 'function') {
                plugin(this.ctx);
            } else if (plugin.render) {
                plugin.render(this.ctx);
            }
        }

        // Render root objects
        for (const obj of this.rootObjects) {
            obj.render(this.ctx);
        }
    }

    /**
     * Start the render loop.
     * @returns {this}
     */
    go() {
        // Initialize all current plugins
        for (const plugin of this._plugins) {
            if (plugin.init) plugin.init(this.ctx);
        }

        this._running = true;
        let lastTime = 0;

        const loop = (t) => {
            if (!this._running) return;

            this.ctx.time = t * 0.001;
            this.ctx.delta = Math.min(this.ctx.time - lastTime, 0.1);
            lastTime = this.ctx.time;
            this.ctx.frame++;

            // Update
            this.update(this.ctx.time, this.ctx.delta);

            // Render
            this.render();

            this._animationLoop = requestAnimationFrame(loop);
        };

        this._animationLoop = requestAnimationFrame(loop);
        return this;
    }

    /**
     * Stop the render loop.
     * @returns {this}
     */
    stop() {
        this._running = false;
        if (this._animationLoop) {
            cancelAnimationFrame(this._animationLoop);
            this._animationLoop = null;
        }
        return this;
    }

    /**
     * Destroy the scene and clean up resources.
     */
    destroy() {
        this.stop();
        this.clear();

        if (this._cleanupListeners) {
            this._cleanupListeners();
        }

        // Destroy materials
        for (const mat of this.materials) {
            if (mat.destroy) mat.destroy(this.ctx);
        }
    }

    /**
     * Get all objects (for iteration).
     * @returns {Map}
     */
    get objects() { return this._objects; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new scene attached to a canvas.
 * 
 * @param {HTMLCanvasElement|string} [canvas] - Canvas or selector
 * @param {Object} [settings] - Scene settings
 * @returns {Scene} The created scene
 * 
 * @example
 * // Basic usage
 * const scene = mushuScene('#canvas')
 *   .add('cube', { material: metal, position: [0, 0, 0] })
 *   .add('sphere', { material: glass, position: [2, 0, 0] })
 *   .go()
 */
export function mushuScene(canvas, settings) {
    return new Scene({ canvas, settings });
}

// For backward compatibility
export const yoScene = mushuScene;

// ─────────────────────────────────────────────────────────────────────────────
// Object Builder Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builder function for creating configured objects.
 * @param {string} id - Object ID
 * @param {Object} options - Object options
 * @returns {SceneObject}
 */
export function object(id, options = {}) {
    return new SceneObject({ id, ...options });
}

// Export object as a standalone helper
export { SceneObject as Object };

// ─────────────────────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────────────────────

export default {
    Scene,
    mushuScene,
    yoScene,
    SceneObject,
    object,
};


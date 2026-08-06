/**
 * mushu/core/material — Material System for 3D Rendering
 * 
 * A flexible material system supporting:
 * - Built-in simple materials (colors)
 * - PBR (Physically Based Rendering)
 * - Physical materials (transmission, refraction)
 * - Custom shader materials
 * 
 * Usage:
 *   import { material, materials } from 'mushu/core';
 *   
 *   const metal = material('pbr', { metallic: 1.0, roughness: 0.2 })
 *   const glass = material('physical', { transmission: 0.9 })
 *   const custom = material('shader', { vertex, fragment })
 * 
 * @module mushu/core/material
 */

// ═══════════════════════════════════════════════════════════════════════════
// mushu/core/material — Material System
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Base Material Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base class for all materials.
 * Handles uniform management, render state, and shader compilation.
 */
export class Material {
    /**
     * Create a new material.
     * @param {Object} options
     * @param {string} options.name - Material name for debugging
     * @param {Object} options.uniforms - Uniform values
     * @param {Object} options.renderState - GL render state (blend, cull, depth)
     */
    constructor(options = {}) {
        this.name = options.name || 'material';
        this.uniforms = new Map();
        this.renderState = {
            transparent: options.transparent ?? false,
            depthTest: options.depthTest ?? true,
            depthWrite: options.depthWrite ?? true,
            cullFace: options.cullFace ?? 'BACK',  // 'BACK', 'FRONT', 'NONE'
            blendSrc: options.blendSrc ?? 'SRC_ALPHA',
            blendDst: options.blendDst ?? 'ONE_MINUS_SRC_ALPHA',
        };
        this._uniformTypes = new Map();
        this._textures = new Map();
    }

    /**
     * Set a uniform value.
     * @param {string} name - Uniform name
     * @param {*} value - Value (number, vec2, vec3, vec4, mat4, or texture)
     * @param {string} [type] - Optional type hint ('float', 'vec2', 'vec3', 'vec4', 'mat4', 'sampler2D')
     */
    setUniform(name, value, type) {
        this.uniforms.set(name, value);
        if (type) this._uniformTypes.set(name, type);
        return this;
    }

    /**
     * Get a uniform value.
     * @param {string} name - Uniform name
     * @returns {*} The uniform value or undefined
     */
    getUniform(name) {
        return this.uniforms.get(name);
    }

    /**
     * Set a texture uniform.
     * @param {string} name - Uniform name
     * @param {*} texture - WebGL texture or texture info
     * @param {number} [unit] - Texture unit index
     */
    setTexture(name, texture, unit) {
        const slot = unit ?? this._textures.size;
        this._textures.set(name, { texture, unit: slot });
        return this;
    }

    /**
     * Get texture by name.
     * @param {string} name - Uniform name
     * @returns {*} Texture info or undefined
     */
    getTexture(name) {
        return this._textures.get(name);
    }

    /**
     * Clone this material.
     * @returns {Material} Cloned material
     */
    clone() {
        const clone = new this.constructor();
        clone.name = `${this.name}_copy`;
        clone.renderState = { ...this.renderState };
        for (const [name, value] of this.uniforms) {
            clone.uniforms.set(name, value);
        }
        for (const [name, type] of this._uniformTypes) {
            clone._uniformTypes.set(name, type);
        }
        for (const [name, tex] of this._textures) {
            clone._textures.set(name, tex);
        }
        return clone;
    }

    /**
     * Dispose of GPU resources.
     * @param {Object} ctx - Flow context
     */
    destroy(ctx) {
        // Override in subclasses
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BuiltInMaterial — Simple color/flat materials
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple built-in material with a single color.
 * Good for debugging or stylized rendering.
 */
export class BuiltInMaterial extends Material {
    constructor(options = {}) {
        super(options);
        this.name = options.name || 'builtIn';
        this.renderState = {
            transparent: false,
            depthTest: true,
            depthWrite: true,
            cullFace: 'BACK',
            ...this.renderState,
        };

        // Set default color
        const color = options.color ?? [0.8, 0.8, 0.8];
        this.setUniform('color', Array.isArray(color) ? color : [color, color, color], 'vec3');

        this._program = null;
        this._vertShader = `#version 300 es
      precision highp float;
      layout(location = 0) in vec3 position;
      layout(location = 1) in vec3 normal;
      layout(location = 2) in vec2 uv;
      uniform mat4 modelMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;
      out vec3 vNormal;
      out vec3 vPosition;
      out vec2 vUv;
      void main() {
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vNormal = mat3(modelMatrix) * normal;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * vec4(vPosition, 1.0);
      }
    `;
        this._fragShader = `#version 300 es
      precision highp float;
      in vec3 vNormal;
      in vec3 vPosition;
      in vec2 vUv;
      uniform vec3 color;
      uniform vec3 lightPosition;
      uniform vec3 cameraPosition;
      out vec4 fragColor;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(lightPosition - vPosition);
        vec3 V = normalize(cameraPosition - vPosition);
        float diff = max(dot(N, L), 0.0);
        vec3 ambient = color * 0.3;
        vec3 diffuse = color * diff;
        fragColor = vec4(ambient + diffuse, 1.0);
      }
    `;
    }

    /**
     * Compile shader and prepare for rendering.
     * @param {Object} ctx - Flow context
     */
    init(ctx) {
        const gl = ctx.gl;
        this._program = this._compileShader(gl);
        ctx.state.materials ??= [];
        ctx.state.materials.push(this);
    }

    /**
     * Apply material settings before rendering.
     * @param {Object} ctx - Flow context
     */
    bind(ctx) {
        if (!this._program) return;
        const gl = ctx.gl;

        // Set render state
        if (this.renderState.depthTest) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
        gl.depthMask(this.renderState.depthWrite);

        if (this.renderState.cullFace === 'NONE') {
            gl.disable(gl.CULL_FACE);
        } else {
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl[this.renderState.cullFace]);
        }

        if (this.renderState.transparent) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl[this.renderState.blendSrc], gl[this.renderState.blendDst]);
        } else {
            gl.disable(gl.BLEND);
        }

        gl.useProgram(this._program);
        ctx.program = this._program;

        // Set uniforms
        const cam = ctx.state.camera;
        if (cam) {
            gl.uniformMatrix4fv(gl.getUniformLocation(this._program, 'viewMatrix'), false, cam.view);
            gl.uniformMatrix4fv(gl.getUniformLocation(this._program, 'projectionMatrix'), false, cam.projection);
            gl.uniform3fv(gl.getUniformLocation(this._program, 'cameraPosition'), cam.position);
        }

        const color = this.uniforms.get('color');
        if (color) gl.uniform3fv(gl.getUniformLocation(this._program, 'color'), color);

        gl.uniform3f(gl.getUniformLocation(this._program, 'lightPosition'), 5, 5, 5);
        gl.uniform1f(gl.getUniformLocation(this._program, 'time'), ctx.time);
    }

    _compileShader(gl) {
        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, this._vertShader);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error('BuiltInMaterial vertex shader error:', gl.getShaderInfoLog(vs));
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, this._fragShader);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error('BuiltInMaterial fragment shader error:', gl.getShaderInfoLog(fs));
        }

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('BuiltInMaterial program link error:', gl.getProgramInfoLog(program));
        }
        return program;
    }

    destroy(ctx) {
        if (this._program) ctx.gl.deleteProgram(this._program);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PBRMaterial — Physically Based Rendering Material
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PBR material using the GGX BRDF model.
 * Supports metallic-roughness workflow.
 */
export class PBRMaterial extends Material {
    constructor(options = {}) {
        super(options);
        this.name = options.name || 'pbr';
        this.renderState = {
            transparent: false,
            depthTest: true,
            depthWrite: true,
            cullFace: 'BACK',
            ...this.renderState,
        };

        // PBR properties
        this.setUniform('albedo', options.albedo ?? [0.8, 0.8, 0.8], 'vec3');
        this.setUniform('metallic', options.metallic ?? 0.0, 'float');
        this.setUniform('roughness', options.roughness ?? 0.5, 'float');
        this.setUniform('ao', options.ao ?? 1.0, 'float');
        this.setUniform('emissive', options.emissive ?? [0, 0, 0], 'vec3');
        this.setUniform('emissiveStrength', options.emissiveStrength ?? 1.0, 'float');

        // Optional textures
        if (options.albedoMap) this.setTexture('albedoMap', options.albedoMap);
        if (options.normalMap) this.setTexture('normalMap', options.normalMap);
        if (options.metallicMap) this.setTexture('metallicMap', options.metallicMap);
        if (options.roughnessMap) this.setTexture('roughnessMap', options.roughnessMap);
        if (options.aoMap) this.setTexture('aoMap', options.aoMap);

        this._program = null;
        this._vertShader = `#version 300 es
      precision highp float;
      layout(location = 0) in vec3 position;
      layout(location = 1) in vec3 normal;
      layout(location = 2) in vec2 uv;
      uniform mat4 modelMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;
      uniform mat4 normalMatrix;
      out vec3 vPosition;
      out vec3 vNormal;
      out vec2 vUv;
      out vec3 vWorldPosition;
      void main() {
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vPosition = position;
        vNormal = mat3(normalMatrix) * normal;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
      }
    `;
        this._fragShader = `#version 300 es
      precision highp float;
      in vec3 vPosition;
      in vec3 vNormal;
      in vec2 vUv;
      in vec3 vWorldPosition;
      
      uniform vec3 cameraPosition;
      uniform vec3 lightPosition;
      uniform vec3 lightColor;
      
      uniform vec3 albedo;
      uniform float metallic;
      uniform float roughness;
      uniform float ao;
      uniform vec3 emissive;
      uniform float emissiveStrength;
      
      #ifdef HAS_ALBEDO_MAP
      uniform sampler2D albedoMap;
      #endif
      #ifdef HAS_NORMAL_MAP
      uniform sampler2D normalMap;
      #endif
      #ifdef HAS_METALLIC_MAP
      uniform sampler2D metallicMap;
      #endif
      #ifdef HAS_ROUGHNESS_MAP
      uniform sampler2D roughnessMap;
      #endif
      #ifdef HAS_AO_MAP
      uniform sampler2D aoMap;
      #endif
      
      out vec4 fragColor;
      const float PI = 3.14159265359;

      float DistributionGGX(vec3 N, vec3 H, float roughness) {
        float a = roughness * roughness;
        float a2 = a * a;
        float NdotH = max(dot(N, H), 0.0);
        float NdotH2 = NdotH * NdotH;
        float num = a2;
        float denom = (NdotH2 * (a2 - 1.0) + 1.0);
        denom = PI * denom * denom;
        return num / denom;
      }

      float GeometrySchlickGGX(float NdotV, float roughness) {
        float r = (roughness + 1.0);
        float k = (r * r) / 8.0;
        return NdotV / (NdotV * (1.0 - k) + k);
      }

      float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
        float NdotV = max(dot(N, V), 0.0);
        float NdotL = max(dot(N, L), 0.0);
        float ggx2 = GeometrySchlickGGX(NdotV, roughness);
        float ggx1 = GeometrySchlickGGX(NdotL, roughness);
        return ggx1 * ggx2;
      }

      vec3 fresnelSchlick(float cosTheta, vec3 F0) {
        return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPosition);
        vec3 L = normalize(lightPosition - vWorldPosition);
        vec3 H = normalize(V + L);

        #ifdef HAS_ALBEDO_MAP
        vec4 tex = texture(albedoMap, vUv);
        vec3 albedoColor = tex.rgb * albedo;
        float alpha = tex.a;
        #else
        vec3 albedoColor = albedo;
        float alpha = 1.0;
        #endif

        #ifdef HAS_ROUGHNESS_MAP
        float r = texture(roughnessMap, vUv).r * roughness;
        #else
        float r = roughness;
        #endif

        #ifdef HAS_METALLIC_MAP
        float m = texture(metallicMap, vUv).r * metallic;
        #else
        float m = metallic;
        #endif

        #ifdef HAS_AO_MAP
        float aoVal = texture(aoMap, vUv).r * ao;
        #else
        float aoVal = ao;
        #endif

        vec3 F0 = vec3(0.04);
        F0 = mix(F0, albedoColor, m);

        float NDF = DistributionGGX(N, H, r);
        float G = GeometrySmith(N, V, L, r);
        vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

        vec3 numerator = NDF * G * F;
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
        vec3 specular = numerator / denominator;

        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;
        kD *= 1.0 - m;

        float NdotL = max(dot(N, L), 0.0);
        vec3 Lo = (kD * albedoColor / PI + specular) * lightColor * NdotL;

        vec3 ambient = vec3(0.03) * albedoColor * aoVal;
        vec3 color = ambient + Lo;

        // Emissive
        color += emissive * emissiveStrength;

        // HDR tonemapping
        color = color / (color + vec3(1.0));
        // Gamma correction
        color = pow(color, vec3(1.0 / 2.2));

        fragColor = vec4(color, alpha);
      }
    `;
    }

    init(ctx) {
        const gl = ctx.gl;
        this._program = this._compileShader(gl);
        ctx.state.materials ??= [];
        ctx.state.materials.push(this);
    }

    bind(ctx) {
        if (!this._program) return;
        const gl = ctx.gl;

        // Render state
        if (this.renderState.depthTest) gl.enable(gl.DEPTH_TEST);
        else gl.disable(gl.DEPTH_TEST);
        gl.depthMask(this.renderState.depthWrite);

        if (this.renderState.cullFace === 'NONE') gl.disable(gl.CULL_FACE);
        else {
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl[this.renderState.cullFace]);
        }

        if (this.renderState.transparent) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl[this.renderState.blendSrc], gl[this.renderState.blendDst]);
        } else {
            gl.disable(gl.BLEND);
        }

        gl.useProgram(this._program);
        ctx.program = this._program;

        // Camera uniforms
        const cam = ctx.state.camera;
        if (cam) {
            gl.uniformMatrix4fv(gl.getUniformLocation(this._program, 'viewMatrix'), false, cam.view);
            gl.uniformMatrix4fv(gl.getUniformLocation(this._program, 'projectionMatrix'), false, cam.projection);
            gl.uniform3fv(gl.getUniformLocation(this._program, 'cameraPosition'), cam.position);
        }

        // PBR uniforms
        const albedo = this.uniforms.get('albedo');
        if (albedo) gl.uniform3fv(gl.getUniformLocation(this._program, 'albedo'), albedo);
        gl.uniform1f(gl.getUniformLocation(this._program, 'metallic'), this.uniforms.get('metallic'));
        gl.uniform1f(gl.getUniformLocation(this._program, 'roughness'), this.uniforms.get('roughness'));
        gl.uniform1f(gl.getUniformLocation(this._program, 'ao'), this.uniforms.get('ao'));

        const emissive = this.uniforms.get('emissive');
        if (emissive) gl.uniform3fv(gl.getUniformLocation(this._program, 'emissive'), emissive);
        gl.uniform1f(gl.getUniformLocation(this._program, 'emissiveStrength'), this.uniforms.get('emissiveStrength'));

        gl.uniform3f(gl.getUniformLocation(this._program, 'lightPosition'), 5, 5, 5);
        gl.uniform3f(gl.getUniformLocation(this._program, 'lightColor'), 1, 1, 1);

        gl.uniform1f(gl.getUniformLocation(this._program, 'time'), ctx.time);
    }

    _compileShader(gl) {
        // Build fragment shader with defines for enabled textures
        let fsSource = this._fragShader;
        let defines = '';
        if (this._textures.has('albedoMap')) defines += '#define HAS_ALBEDO_MAP\n';
        if (this._textures.has('normalMap')) defines += '#define HAS_NORMAL_MAP\n';
        if (this._textures.has('metallicMap')) defines += '#define HAS_METALLIC_MAP\n';
        if (this._textures.has('roughnessMap')) defines += '#define HAS_ROUGHNESS_MAP\n';
        if (this._textures.has('aoMap')) defines += '#define HAS_AO_MAP\n';
        fsSource = defines + fsSource;

        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, this._vertShader);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error('PBRMaterial vertex shader error:', gl.getShaderInfoLog(vs));
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error('PBRMaterial fragment shader error:', gl.getShaderInfoLog(fs));
        }

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('PBRMaterial program link error:', gl.getProgramInfoLog(program));
        }
        return program;
    }

    destroy(ctx) {
        if (this._program) ctx.gl.deleteProgram(this._program);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PhysicalMaterial — Advanced material with transmission
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Physical material with transmission for glass-like effects.
 */
export class PhysicalMaterial extends PBRMaterial {
    constructor(options = {}) {
        super(options);
        this.name = options.name || 'physical';
        this.renderState = {
            transparent: true,
            depthTest: true,
            depthWrite: false,
            cullFace: 'BACK',
            blendSrc: 'SRC_ALPHA',
            blendDst: 'ONE_MINUS_SRC_ALPHA',
            ...this.renderState,
        };

        // Physical properties
        this.setUniform('transmission', options.transmission ?? 0.0, 'float');
        this.setUniform('thickness', options.thickness ?? 1.0, 'float');
        this.setUniform('ior', options.ior ?? 1.5, 'float');
        this.setUniform('opacity', options.opacity ?? 1.0, 'float');

        if (options.transmissionMap) this.setTexture('transmissionMap', options.transmissionMap);
    }

    bind(ctx) {
        super.bind(ctx);
        const gl = ctx.gl;
        gl.uniform1f(gl.getUniformLocation(this._program, 'transmission'), this.uniforms.get('transmission'));
        gl.uniform1f(gl.getUniformLocation(this._program, 'thickness'), this.uniforms.get('thickness'));
        gl.uniform1f(gl.getUniformLocation(this._program, 'ior'), this.uniforms.get('ior'));
        gl.uniform1f(gl.getUniformLocation(this._program, 'opacity'), this.uniforms.get('opacity'));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ShaderMaterial — Custom GLSL shaders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Custom shader material for full control over rendering.
 */
export class ShaderMaterial extends Material {
    constructor(options = {}) {
        super(options);
        this.name = options.name || 'shader';
        this.renderState = {
            transparent: options.transparent ?? false,
            depthTest: options.depthTest ?? true,
            depthWrite: options.depthWrite ?? true,
            cullFace: options.cullFace ?? 'BACK',
            ...this.renderState,
        };

        this.vertexShader = options.vertex ?? '';
        this.fragmentShader = options.fragment ?? '';
        this._program = null;
    }

    /**
     * Set vertex shader source.
     * @param {string} source - GLSL vertex shader
     */
    setVertexShader(source) {
        this.vertexShader = source;
        return this;
    }

    /**
     * Set fragment shader source.
     * @param {string} source - GLSL fragment shader
     */
    setFragmentShader(source) {
        this.fragmentShader = source;
        return this;
    }

    init(ctx) {
        const gl = ctx.gl;
        this._program = this._compileShader(gl);
        ctx.state.materials ??= [];
        ctx.state.materials.push(this);
    }

    bind(ctx) {
        if (!this._program) return;
        const gl = ctx.gl;

        // Render state
        if (this.renderState.depthTest) gl.enable(gl.DEPTH_TEST);
        else gl.disable(gl.DEPTH_TEST);
        gl.depthMask(this.renderState.depthWrite);

        if (this.renderState.cullFace === 'NONE') gl.disable(gl.CULL_FACE);
        else {
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl[this.renderState.cullFace]);
        }

        if (this.renderState.transparent) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl[this.renderState.blendSrc], gl[this.renderState.blendDst]);
        } else {
            gl.disable(gl.BLEND);
        }

        gl.useProgram(this._program);
        ctx.program = this._program;

        // Set camera uniforms if shader expects them
        const cam = ctx.state.camera;
        if (cam) {
            const vpLoc = gl.getUniformLocation(this._program, 'viewProjectionMatrix');
            if (vpLoc) gl.uniformMatrix4fv(vpLoc, false, cam.viewProjection);
            const vmLoc = gl.getUniformLocation(this._program, 'viewMatrix');
            if (vmLoc) gl.uniformMatrix4fv(vmLoc, false, cam.view);
            const pmLoc = gl.getUniformLocation(this._program, 'projectionMatrix');
            if (pmLoc) gl.uniformMatrix4fv(pmLoc, false, cam.projection);
            const cpLoc = gl.getUniformLocation(this._program, 'cameraPosition');
            if (cpLoc) gl.uniform3fv(cpLoc, cam.position);
        }

        // Set custom uniforms
        for (const [name, value] of this.uniforms) {
            const loc = gl.getUniformLocation(this._program, name);
            if (!loc) continue;
            const type = this._uniformTypes.get(name);
            if (type === 'float' || typeof value === 'number') {
                gl.uniform1f(loc, value);
            } else if (type === 'vec2' || (Array.isArray(value) && value.length === 2)) {
                gl.uniform2fv(loc, value);
            } else if (type === 'vec3' || (Array.isArray(value) && value.length === 3)) {
                gl.uniform3fv(loc, value);
            } else if (type === 'vec4' || (Array.isArray(value) && value.length === 4)) {
                gl.uniform4fv(loc, value);
            } else if (type === 'mat4' || (Array.isArray(value) && value.length === 16)) {
                gl.uniformMatrix4fv(loc, false, value);
            }
        }

        // Set textures
        let textureUnit = 0;
        for (const [name, texInfo] of this._textures) {
            const loc = gl.getUniformLocation(this._program, name);
            if (loc) {
                gl.activeTexture(gl.TEXTURE0 + textureUnit);
                const tex = texInfo.texture;
                if (tex.bind) tex.bind(gl);
                else gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.uniform1i(loc, textureUnit);
            }
            textureUnit++;
        }
    }

    _compileShader(gl) {
        const vs = gl.createShader(gl.VERTEX_SHADER);
        const vsSource = this.vertexShader.includes('#version') ? this.vertexShader :
            `#version 300 es\n${this.vertexShader}`;
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error('ShaderMaterial vertex shader error:', gl.getShaderInfoLog(vs));
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        const fsSource = this.fragmentShader.includes('#version') ? this.fragmentShader :
            `#version 300 es\nprecision highp float;\n${this.fragmentShader}`;
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error('ShaderMaterial fragment shader error:', gl.getShaderInfoLog(fs));
        }

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('ShaderMaterial program link error:', gl.getProgramInfoLog(program));
        }
        return program;
    }

    destroy(ctx) {
        if (this._program) ctx.gl.deleteProgram(this._program);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Material Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a material of the specified type.
 * 
 * @param {string} type - Material type: 'builtIn', 'pbr', 'physical', 'shader'
 * @param {Object} options - Material options
 * @returns {Material} The created material
 * 
 * @example
 * // Built-in material
 * const color = material('builtIn', { color: [1, 0, 0] })
 * 
 * // PBR material
 * const metal = material('pbr', { metallic: 1.0, roughness: 0.2 })
 * 
 * // Physical material
 * const glass = material('physical', { transmission: 0.9 })
 * 
 * // Custom shader
 * const custom = material('shader', { fragment: '...' })
 */
export function material(type, options = {}) {
    switch (type.toLowerCase()) {
        case 'builtin':
        case 'built-in':
        case 'flat':
            return new BuiltInMaterial(options);
        case 'pbr':
            return new PBRMaterial(options);
        case 'physical':
            return new PhysicalMaterial(options);
        case 'shader':
        case 'custom':
            return new ShaderMaterial(options);
        default:
            console.warn(`Unknown material type: ${type}, defaulting to PBR`);
            return new PBRMaterial(options);
    }
}

/**
 * Pre-defined material presets.
 */
export const materials = {
    // Metals
    gold: () => material('pbr', { name: 'gold', albedo: [1.0, 0.84, 0.0], metallic: 1.0, roughness: 0.2 }),
    silver: () => material('pbr', { name: 'silver', albedo: [0.97, 0.97, 0.97], metallic: 1.0, roughness: 0.2 }),
    copper: () => material('pbr', { name: 'copper', albedo: [0.95, 0.64, 0.54], metallic: 1.0, roughness: 0.3 }),
    chrome: () => material('pbr', { name: 'chrome', albedo: [0.9, 0.9, 0.9], metallic: 1.0, roughness: 0.05 }),

    // Plastics/Polymers
    plasticRed: () => material('pbr', { name: 'plasticRed', albedo: [0.8, 0.1, 0.1], metallic: 0.0, roughness: 0.5 }),
    plasticWhite: () => material('pbr', { name: 'plasticWhite', albedo: [0.95, 0.95, 0.95], metallic: 0.0, roughness: 0.3 }),
    matteBlack: () => material('pbr', { name: 'matteBlack', albedo: [0.05, 0.05, 0.05], metallic: 0.0, roughness: 0.9 }),

    // Glass/Crystal
    glass: () => material('physical', { name: 'glass', albedo: [1, 1, 1], metallic: 0.0, roughness: 0.05, transmission: 0.95, ior: 1.5 }),
    frostedGlass: () => material('physical', { name: 'frostedGlass', albedo: [0.9, 0.9, 1.0], metallic: 0.0, roughness: 0.4, transmission: 0.8, ior: 1.4 }),

    // Emissive
    emissiveRed: () => material('pbr', { name: 'emissiveRed', albedo: [0.1, 0.0, 0.0], emissive: [1.0, 0.1, 0.1], emissiveStrength: 2.0 }),
    emissiveBlue: () => material('pbr', { name: 'emissiveBlue', albedo: [0.0, 0.1, 0.5], emissive: [0.1, 0.3, 1.0], emissiveStrength: 3.0 }),
    neon: () => material('pbr', { name: 'neon', albedo: [0.0, 0.0, 0.0], emissive: [0.0, 1.0, 0.5], emissiveStrength: 5.0 }),

    // Debug materials
    normal: () => material('shader', {
        name: 'normalDebug',
        fragment: `
      in vec3 vNormal;
      out vec4 fragColor;
      void main() { fragColor = vec4(vNormal * 0.5 + 0.5, 1.0); }
    `
    }),
    uv: () => material('shader', {
        name: 'uvDebug',
        fragment: `
      in vec2 vUv;
      out vec4 fragColor;
      void main() { fragColor = vec4(vUv, 0.0, 1.0); }
    `
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────────────────────

export default {
    Material,
    BuiltInMaterial,
    PBRMaterial,
    PhysicalMaterial,
    ShaderMaterial,
    material,
    materials,
};


/**
 * mushu/core/model-formats — Built-in and extensible 3D model format loaders
 * 
 * This module demonstrates the extensibility system for adding new 3D model formats.
 * Examples include glTF 2.0, Blend (Blender), FBX, and custom formats.
 * 
 * @module mushu/core/model-formats
 */

import { ModelFormatLoader } from './model.js';

// ═══════════════════════════════════════════════════════════════════════════
// Extended Format Loaders (Examples for Future Implementation)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * glTF 2.0 Loader with full buffer and image support.
 * 
 * Usage:
 *   import { GLTFLoader2 } from 'mushu/core/model-formats';
 *   import { registerModelFormat } from 'mushu/core';
 *   
 *   registerModelFormat('gltf2', new GLTFLoader2());
 *   const model = await loadModel('model.gltf', { format: 'gltf2' });
 */
export class GLTFLoader2 extends ModelFormatLoader {
    /**
     * Load a glTF 2.0 model from URL.
     * Handles both JSON (.gltf) and binary (.glb) formats.
     * 
     * @param {string} url - URL to glTF or GLB file
     * @param {Object} options - Load options
     * @param {string} options.basePath - Base path for external resources
     * @returns {Promise<Object>} Parsed model with meshes and materials
     */
    async loadAsync(url, options = {}) {
        const { basePath = url.substring(0, url.lastIndexOf('/') + 1) } = options;
        const ext = url.split('.').pop().toLowerCase();

        let json;
        let buffer = null;

        if (ext === 'glb') {
            // Binary glTF format
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load glTF: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            const result = this._parseGLB(arrayBuffer);
            json = result.json;
            buffer = result.buffer;
        } else {
            // JSON glTF format
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load glTF: ${response.statusText}`);
            json = await response.json();
        }

        return this._parseGLTFJSON(json, buffer, basePath, options);
    }

    /**
     * Parse GLB (Binary glTF) container.
     * @private
     */
    _parseGLB(arrayBuffer) {
        const view = new DataView(arrayBuffer);

        // Check magic number (0x46546C67 = "glTF")
        const magic = view.getUint32(0, true);
        if (magic !== 0x46546c67) {
            throw new Error('Invalid GLB file (bad magic number)');
        }

        const version = view.getUint32(4, true);
        const length = view.getUint32(8, true);

        if (version !== 2) {
            throw new Error(`Unsupported glTF version: ${version}`);
        }

        // Parse chunks
        let offset = 12;
        let json = null;
        let buffer = null;

        while (offset < length) {
            const chunkLength = view.getUint32(offset, true);
            const chunkType = view.getUint32(offset + 4, true); // 0x4E4F534A = "JSON", 0x004E4942 = "BIN"

            if (chunkType === 0x4e4f534a) {
                // JSON chunk
                const jsonData = new Uint8Array(arrayBuffer, offset + 8, chunkLength);
                const decoder = new TextDecoder();
                json = JSON.parse(decoder.decode(jsonData));
            } else if (chunkType === 0x004e4942) {
                // BIN chunk
                buffer = new Uint8Array(arrayBuffer, offset + 8, chunkLength);
            }

            offset += 8 + chunkLength;
        }

        return { json, buffer };
    }

    /**
     * Parse glTF JSON and construct mesh data.
     * @private
     * @todo Handle animations, skins, lights, and other glTF features
     */
    async _parseGLTFJSON(json, binBuffer, basePath, options = {}) {
        const meshes = [];
        const materials = [];

        // Load external buffers if needed
        if (!binBuffer && json.buffers) {
            for (const buf of json.buffers) {
                if (buf.uri && !buf.uri.startsWith('data:')) {
                    const response = await fetch(basePath + buf.uri);
                    if (response.ok) {
                        binBuffer = new Uint8Array(await response.arrayBuffer());
                    }
                }
            }
        }

        // Parse materials
        if (json.materials) {
            for (const mtl of json.materials) {
                materials.push({
                    name: mtl.name || 'Material',
                    type: 'gltf-pbr',
                    // Standard glTF PBR properties
                    baseColorFactor: mtl.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1],
                    metallicFactor: mtl.pbrMetallicRoughness?.metallicFactor ?? 0,
                    roughnessFactor: mtl.pbrMetallicRoughness?.roughnessFactor ?? 1,
                    emissiveFactor: mtl.emissiveFactor || [0, 0, 0],
                    doubleSided: mtl.doubleSided ?? false,
                    alphaMode: mtl.alphaMode || 'OPAQUE',
                    alphaCutoff: mtl.alphaCutoff ?? 0.5,
                    // Texture references
                    baseColorTexture: mtl.pbrMetallicRoughness?.baseColorTexture,
                    normalTexture: mtl.normalTexture,
                    occlusionTexture: mtl.occlusionTexture,
                    emissiveTexture: mtl.emissiveTexture,
                    metallicRoughnessTexture: mtl.pbrMetallicRoughness?.metallicRoughnessTexture,
                });
            }
        }

        // Parse meshes
        if (json.meshes) {
            for (let meshIdx = 0; meshIdx < json.meshes.length; meshIdx++) {
                const gltfMesh = json.meshes[meshIdx];

                for (const primitive of gltfMesh.primitives) {
                    const positions = this._getAccessorData(primitive.attributes.POSITION, json, binBuffer);
                    const normals = primitive.attributes.NORMAL
                        ? this._getAccessorData(primitive.attributes.NORMAL, json, binBuffer)
                        : this._generateNormals(positions);
                    const uvs = primitive.attributes.TEXCOORD_0
                        ? this._getAccessorData(primitive.attributes.TEXCOORD_0, json, binBuffer)
                        : new Float32Array(positions.length / 3 * 2);

                    let indices = null;
                    if (primitive.indices !== undefined) {
                        indices = this._getAccessorData(primitive.indices, json, binBuffer);
                    }

                    meshes.push({
                        name: gltfMesh.name || `Mesh_${meshIdx}`,
                        material: materials[primitive.material || 0] || materials[0],
                        geometry: {
                            positions,
                            normals,
                            uvs,
                            ...(indices && { indices }),
                        },
                    });
                }
            }
        }

        return {
            meshes,
            materials: materials.reduce((acc, m) => {
                acc[m.name] = m;
                return acc;
            }, {}),
            metadata: {
                format: 'gltf',
                version: json.asset?.version,
                generator: json.asset?.generator,
                meshCount: meshes.length,
                hasMaterials: materials.length > 0,
                hasAnimations: (json.animations?.length ?? 0) > 0,
            },
        };
    }

    /**
     * Extract typed data from accessor.
     * @private
     */
    _getAccessorData(accessorIdx, json, binBuffer) {
        const accessor = json.accessors[accessorIdx];
        const bufferView = json.bufferViews[accessor.bufferView];

        const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        let TypedArray;

        switch (accessor.componentType) {
            case 5120:
                TypedArray = Int8Array;
                break;
            case 5121:
                TypedArray = Uint8Array;
                break;
            case 5122:
                TypedArray = Int16Array;
                break;
            case 5125:
                TypedArray = Uint32Array;
                break;
            case 5126:
                TypedArray = Float32Array;
                break;
            default:
                throw new Error(`Unknown component type: ${accessor.componentType}`);
        }

        const elementCount = this._getAccessorElementCount(accessor.type);
        const data = new TypedArray(
            binBuffer.buffer,
            binBuffer.byteOffset + offset,
            accessor.count * elementCount
        );

        return new Float32Array(data);
    }

    /**
     * Get element count for accessor type.
     * @private
     */
    _getAccessorElementCount(type) {
        switch (type) {
            case 'SCALAR':
                return 1;
            case 'VEC2':
                return 2;
            case 'VEC3':
                return 3;
            case 'VEC4':
            case 'MAT2':
                return 4;
            case 'MAT3':
                return 9;
            case 'MAT4':
                return 16;
            default:
                return 1;
        }
    }

    /**
     * Generate face normals.
     * @private
     */
    _generateNormals(positions) {
        const normals = new Float32Array(positions.length);
        const vertexNormals = new Map();

        for (let i = 0; i < positions.length; i += 9) {
            const p0 = [positions[i], positions[i + 1], positions[i + 2]];
            const p1 = [positions[i + 3], positions[i + 4], positions[i + 5]];
            const p2 = [positions[i + 6], positions[i + 7], positions[i + 8]];

            const e1 = [(p1[0] - p0[0]), (p1[1] - p0[1]), (p1[2] - p0[2])];
            const e2 = [(p2[0] - p0[0]), (p2[1] - p0[1]), (p2[2] - p0[2])];

            const normal = [
                e1[1] * e2[2] - e1[2] * e2[1],
                e1[2] * e2[0] - e1[0] * e2[2],
                e1[0] * e2[1] - e1[1] * e2[0],
            ];

            const len = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
            if (len > 0) {
                normal[0] /= len;
                normal[1] /= len;
                normal[2] /= len;
            }

            for (let j = 0; j < 3; j++) {
                const idx = i + j * 3;
                const key = `${positions[idx]},${positions[idx + 1]},${positions[idx + 2]}`;
                if (!vertexNormals.has(key)) {
                    vertexNormals.set(key, [0, 0, 0]);
                }
                const vn = vertexNormals.get(key);
                vn[0] += normal[0];
                vn[1] += normal[1];
                vn[2] += normal[2];
            }
        }

        let normIdx = 0;
        for (let i = 0; i < positions.length; i += 3) {
            const key = `${positions[i]},${positions[i + 1]},${positions[i + 2]}`;
            const vn = vertexNormals.get(key) || [0, 1, 0];
            const len = Math.sqrt(vn[0] ** 2 + vn[1] ** 2 + vn[2] ** 2);
            if (len > 0) {
                normals[normIdx++] = vn[0] / len;
                normals[normIdx++] = vn[1] / len;
                normals[normIdx++] = vn[2] / len;
            } else {
                normals[normIdx++] = 0;
                normals[normIdx++] = 1;
                normals[normIdx++] = 0;
            }
        }

        return normals;
    }
}

/**
 * FBX Loader Template
 * 
 * Usage:
 *   import { FBXLoader } from 'mushu/core/model-formats';
 *   registerModelFormat('fbx', new FBXLoader());
 * 
 * @note Full implementation requires FBX binary parsing library
 */
export class FBXLoader extends ModelFormatLoader {
    async loadAsync(url, options = {}) {
        throw new Error(
            'FBX support requires additional dependencies. Use: npm install fbx-parser'
        );
    }
}

/**
 * Blender Blend Loader Template
 * 
 * Usage:
 *   import { BlendLoader } from 'mushu/core/model-formats';
 *   registerModelFormat('blend', new BlendLoader());
 * 
 * @note Full implementation requires Blender binary format parser or glTF export
 */
export class BlendLoader extends ModelFormatLoader {
    async loadAsync(url, options = {}) {
        throw new Error(
            'Native Blend support requires additional dependencies. ' +
            'Consider exporting from Blender as glTF 2.0 instead.'
        );
    }
}

/**
 * USDZ Loader Template (Apple AR formats)
 * 
 * Usage:
 *   import { USDALoader } from 'mushu/core/model-formats';
 *   registerModelFormat('usda', new USDALoader());
 * 
 * @note Format is text-based, similar to USD
 */
export class USDALoader extends ModelFormatLoader {
    async loadAsync(url, options = {}) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load USDA: ${response.statusText}`);
        const content = await response.text();
        return this.load(content, options);
    }

    load(content, options = {}) {
        // Placeholder: USDA parsing logic
        return {
            meshes: [],
            materials: {},
            metadata: { format: 'usda', status: 'not-implemented' },
        };
    }
}

/**
 * Template for creating custom format loaders.
 * 
 * Usage:
 *   class MyFormatLoader extends ModelFormatLoader {
 *     async loadAsync(url, options) {
 *       const response = await fetch(url);
 *       const content = await response.text();
 *       return this.load(content, options);
 *     }
 *     
 *     load(content, options) {
 *       // Parse custom format and return:
 *       return {
 *         meshes: [
 *           {
 *             name: 'mesh_name',
 *             material: { ... },
 *             geometry: {
 *               positions: Float32Array,
 *               normals: Float32Array,
 *               uvs: Float32Array,
 *               indices: Uint32Array,
 *             }
 *           }
 *         ],
 *         materials: { ... },
 *         metadata: { ... }
 *       };
 *     }
 *   }
 *   
 *   registerModelFormat('myformat', new MyFormatLoader());
 */

export default {
    GLTFLoader2,
    FBXLoader,
    BlendLoader,
    USDALoader,
};

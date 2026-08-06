/**
 * mushu/core/model — Model Loading and Management System
 *
 * A comprehensive system for loading and rendering 3D models from various formats.
 * Supports OBJ/MTL with textures and provides extensibility for glTF, BLEND, and other formats.
 *
 * Usage:
 *   import { loadModel, ModelLoader } from 'mushu/core';
 *
 *   const model = await loadModel('path/to/model.obj', {
 *     texturePath: 'path/to/textures/',
 *     materialDefaults: { roughness: 0.5 }
 *   });
 *
 *   scene.addModel('my-model', model, { position: [0, 0, 0] });
 *
 * @module mushu/core/model
 */

import { vao } from './geometry.js';
import { texture } from './textures.js';
import { mat4 } from './transforms.js';

// ═══════════════════════════════════════════════════════════════════════════
// Model Format Loaders (Plugin Architecture)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base class for model format loaders.
 * Implement `load()` and optionally `loadAsync()` methods.
 */
export class ModelFormatLoader {
    /**
     * Load a model from content string.
     * @param {string} content - Raw file content
     * @param {Object} options - Format-specific options
     * @returns {Object} Parsed model data
     */
    load(content, options = {}) {
        throw new Error('ModelFormatLoader.load() must be implemented');
    }

    /**
     * Async load for remote resource handling.
     * @param {string} urlOrContent - URL or content
     * @param {Object} options - Format-specific options
     * @returns {Promise<Object>} Parsed model data
     */
    async loadAsync(urlOrContent, options = {}) {
        // Default: fetch if URL, otherwise parse
        if (urlOrContent.startsWith('http') || urlOrContent.startsWith('/')) {
            const response = await fetch(urlOrContent);
            const content = await response.text();
            return this.load(content, options);
        }
        return this.load(urlOrContent, options);
    }
}

/**
 * OBJ format loader with MTL material support.
 */
class OBJLoader extends ModelFormatLoader {
    load(objContent, options = {}) {
        const {
            mtlContent = null,
            texturePath = '',
            materialDefaults = {},
            smoothingGroups = true,
        } = options;

        const tempPositions = [];
        const tempNormals = [];
        const tempUvs = [];
        const tempColors = [];

        const meshes = [];
        let currentMesh = {
            name: 'default',
            material: 'default',
            positions: [],
            normals: [],
            uvs: [],
            colors: [],
            indices: [],
            vertexMap: new Map(),
            vertexIndex: 0,
        };

        let materials = {};
        if (mtlContent) {
            materials = parseMTL(mtlContent, texturePath, materialDefaults);
        }

        const lines = objContent.split('\n');
        let currentMaterial = 'default';
        let smoothingGroup = 'default';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const parts = trimmed.split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                // Vertex position (and optional color)
                tempPositions.push(
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                );
                if (parts.length > 4) {
                    tempColors.push(parseFloat(parts[4]), parseFloat(parts[5]), parseFloat(parts[6]));
                }
            } else if (type === 'vn') {
                // Vertex normal
                tempNormals.push(
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                );
            } else if (type === 'vt') {
                // Texture coordinate
                tempUvs.push(parseFloat(parts[1]), 1.0 - parseFloat(parts[2]));
            } else if (type === 'usemtl') {
                // Switch active material
                const newMaterial = parts[1];
                if (
                    currentMesh.positions.length > 0 &&
                    currentMesh.material !== newMaterial
                ) {
                    // Push current mesh before switching
                    meshes.push(currentMesh);
                    currentMesh = {
                        name: currentMesh.name,
                        material: newMaterial,
                        positions: [],
                        normals: [],
                        uvs: [],
                        colors: [],
                        indices: [],
                        vertexMap: new Map(),
                        vertexIndex: 0,
                    };
                }
                currentMaterial = newMaterial;
                currentMesh.material = newMaterial;
            } else if (type === 'o' || type === 'g') {
                // New object/group
                if (currentMesh.positions.length > 0) {
                    meshes.push(currentMesh);
                }
                const objName = parts[1] || 'untitled';
                currentMesh = {
                    name: objName,
                    material: currentMaterial,
                    positions: [],
                    normals: [],
                    uvs: [],
                    colors: [],
                    indices: [],
                    vertexMap: new Map(),
                    vertexIndex: 0,
                };
            } else if (type === 's') {
                // Smoothing group
                if (smoothingGroups) {
                    smoothingGroup = parts[1];
                }
            } else if (type === 'f') {
                // Face
                const faceVertices = parts.slice(1);

                // Triangulate polygons
                for (let i = 1; i < faceVertices.length - 1; i++) {
                    const tri = [faceVertices[0], faceVertices[i], faceVertices[i + 1]];

                    for (const vertStr of tri) {
                        if (currentMesh.vertexMap.has(vertStr)) {
                            currentMesh.indices.push(currentMesh.vertexMap.get(vertStr));
                        } else {
                            addVertex(
                                vertStr,
                                currentMesh,
                                tempPositions,
                                tempNormals,
                                tempUvs,
                                tempColors
                            );
                        }
                    }
                }
            }
        }

        if (currentMesh.positions.length > 0) {
            meshes.push(currentMesh);
        }

        // Normalize mesh structure
        const normalizedMeshes = meshes.map((mesh) => ({
            name: mesh.name,
            material: materials[mesh.material] || { name: mesh.material, ...materialDefaults },
            geometry: {
                positions: new Float32Array(mesh.positions),
                normals: new Float32Array(
                    mesh.normals.length > 0 ? mesh.normals : generateNormals(mesh.positions)
                ),
                uvs: new Float32Array(mesh.uvs),
                indices: new Uint32Array(mesh.indices),
                ...(mesh.colors.length > 0 && { colors: new Float32Array(mesh.colors) }),
            },
        }));

        return {
            meshes: normalizedMeshes,
            materials,
            metadata: {
                format: 'obj',
                hasMaterials: Object.keys(materials).length > 0,
                meshCount: normalizedMeshes.length,
            },
        };
    }
}

/**
 * MTL format parser for materials.
 * @private
 */
function parseMTL(mtlContent, texturePath = '', defaults = {}) {
    const materials = {};
    let currentMaterial = null;

    const lines = mtlContent.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const parts = trimmed.split(/\s+/);
        const type = parts[0];

        if (type === 'newmtl') {
            if (currentMaterial) materials[currentMaterial.name] = currentMaterial;
            currentMaterial = {
                name: parts[1],
                // Standard MTL properties
                Ka: [0.2, 0.2, 0.2], // Ambient
                Kd: [0.8, 0.8, 0.8], // Diffuse
                Ks: [1.0, 1.0, 1.0], // Specular
                Ns: 32, // Specular exponent
                Ni: 1.0, // Refraction index
                d: 1.0, // Opacity/dissolve
                Tr: 0.0, // Transparency (1 - d)
                illum: 2, // Illumination model
                // Map references
                map_Ka: null,
                map_Kd: null,
                map_Ks: null,
                map_Bump: null,
                map_d: null,
                map_Disp: null,
                // Custom properties for PBR
                ...defaults,
            };
        } else if (currentMaterial) {
            if (type === 'Ka' || type === 'Kd' || type === 'Ks') {
                currentMaterial[type] = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
            } else if (type === 'Ns') {
                currentMaterial.Ns = parseFloat(parts[1]);
            } else if (type === 'Ni') {
                currentMaterial.Ni = parseFloat(parts[1]);
            } else if (type === 'd') {
                currentMaterial.d = parseFloat(parts[1]);
            } else if (type === 'Tr') {
                currentMaterial.Tr = parseFloat(parts[1]);
            } else if (type === 'illum') {
                currentMaterial.illum = parseInt(parts[1]);
            } else if (type.startsWith('map_')) {
                // Texture map
                const mapPath = parts.slice(1).join(' ');
                const textureName = texturePath + mapPath;
                currentMaterial[type] = textureName;
            }
        }
    }

    if (currentMaterial) {
        materials[currentMaterial.name] = currentMaterial;
    }

    return materials;
}

/**
 * Add a vertex to a mesh, handling deduplication.
 * @private
 */
function addVertex(
    vertStr,
    mesh,
    tempPositions,
    tempNormals,
    tempUvs,
    tempColors
) {
    const [vIdx, vtIdx, vnIdx] = vertStr.split('/').map((v) => (v ? parseInt(v) - 1 : -1));

    // Position (required)
    if (vIdx >= 0) {
        mesh.positions.push(
            tempPositions[vIdx * 3],
            tempPositions[vIdx * 3 + 1],
            tempPositions[vIdx * 3 + 2]
        );
    }

    // Normal (optional, fallback to default up)
    if (vnIdx >= 0 && tempNormals.length > 0) {
        mesh.normals.push(
            tempNormals[vnIdx * 3],
            tempNormals[vnIdx * 3 + 1],
            tempNormals[vnIdx * 3 + 2]
        );
    } else {
        mesh.normals.push(0, 1, 0);
    }

    // UV coordinate (optional, fallback to [0,0])
    if (vtIdx >= 0 && tempUvs.length > 0) {
        mesh.uvs.push(tempUvs[vtIdx * 2], tempUvs[vtIdx * 2 + 1]);
    } else {
        mesh.uvs.push(0, 0);
    }

    // Color (optional, fallback to white)
    if (tempColors.length > 0) {
        const colorIdx = vIdx * 3;
        mesh.colors.push(
            tempColors[colorIdx] || 1.0,
            tempColors[colorIdx + 1] || 1.0,
            tempColors[colorIdx + 2] || 1.0
        );
    }

    mesh.vertexMap.set(vertStr, mesh.vertexIndex);
    mesh.indices.push(mesh.vertexIndex);
    mesh.vertexIndex++;
}

/**
 * Generate face normals from positions.
 * @private
 */
function generateNormals(positions) {
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

/**
 * GLTF format loader (extensible).
 * @todo Implement full glTF 2.0 support with buffers, images, animations
 */
class GLTFLoader extends ModelFormatLoader {
    async loadAsync(url, options = {}) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load glTF: ${response.statusText}`);

        const ext = url.split('.').pop().toLowerCase();
        const content =
            ext === 'glb' ? await response.arrayBuffer() : await response.text();

        return this.load(content, options);
    }

    load(content, options = {}) {
        // Placeholder for glTF parsing
        return {
            meshes: [],
            materials: {},
            metadata: { format: 'gltf', status: 'not-implemented' },
        };
    }
}

/**
 * Registry of available model format loaders.
 */
const FORMAT_LOADERS = new Map([
    ['obj', new OBJLoader()],
    ['gltf', new GLTFLoader()],
    ['glb', new GLTFLoader()],
]);

/**
 * Register a custom model format loader.
 * @param {string} format - File extension (e.g. 'blend', 'fbx')
 * @param {ModelFormatLoader} loader - Loader instance
 */
export function registerModelFormat(format, loader) {
    if (!(loader instanceof ModelFormatLoader)) {
        throw new Error(
            'Model loader must extend ModelFormatLoader'
        );
    }
    FORMAT_LOADERS.set(format.toLowerCase(), loader);
}

/**
 * Load a model from a URL, content string, or File object.
 * Automatically detects format from file extension or explicit option.
 * 
 * Usage:
 *   // From URL
 *   const model = await loadModel('path/to/model.obj');
 *   
 *   // From File object (e.g., HTML file input)
 *   const model = await loadModel(fileObject, { format: 'obj' });
 *   
 *   // From raw content
 *   const model = await loadModel(objContent, { format: 'obj' });
 * 
 * @param {string|File|Blob} urlOrContentOrFile - URL, raw content, or File/Blob object
 * @param {Object} options - Format-specific options
 * @param {string} options.format - Explicit format (auto-detected if omitted)
 * @param {string} options.texturePath - Base path for texture references
 * @param {Object} options.mtlUrl - MTL file URL (for OBJ)
 * @returns {Promise<Object>} Parsed model data
 */
export async function loadModel(urlOrContentOrFile, options = {}) {
    const { format = null, texturePath = '', ...loaderOptions } = options;

    // Handle File/Blob objects
    let content = urlOrContentOrFile;
    let detectedFormat = format;

    if (urlOrContentOrFile instanceof File || urlOrContentOrFile instanceof Blob) {
        // Read file as text
        content = await urlOrContentOrFile.text();

        // Detect format from file name if available
        if (!detectedFormat && urlOrContentOrFile.name) {
            const ext = urlOrContentOrFile.name.split('.').pop().toLowerCase();
            if (FORMAT_LOADERS.has(ext)) {
                detectedFormat = ext;
            }
        }
    } else if (typeof urlOrContentOrFile === 'string') {
        // Detect format from URL or explicit option
        if (!detectedFormat && urlOrContentOrFile.includes('.')) {
            const ext = urlOrContentOrFile.split('.').pop().toLowerCase();
            if (FORMAT_LOADERS.has(ext)) {
                detectedFormat = ext;
            }
        }
    }

    if (!detectedFormat) {
        throw new Error(
            `Cannot determine model format. Specify 'format' option or use a recognized file extension.`
        );
    }

    const loader = FORMAT_LOADERS.get(detectedFormat);
    if (!loader) {
        throw new Error(
            `No loader registered for format: ${detectedFormat}. Available: ${Array.from(
                FORMAT_LOADERS.keys()
            ).join(', ')}`
        );
    }

    // If it's a File/Blob that we already read, use sync load
    if (urlOrContentOrFile instanceof File || urlOrContentOrFile instanceof Blob) {
        return loader.load(content, {
            texturePath,
            ...loaderOptions,
        });
    }

    // Otherwise use async load for URL string
    return loader.loadAsync(urlOrContentOrFile, {
        ...loaderOptions,
    });
}

/**
 * Load MTL material references.
 * Typically called alongside OBJ loading.
 * @param {string} mtlUrl - URL to MTL file
 * @param {string} texturePath - Base path for textures
 * @returns {Promise<Object>} Materials map
 */
export async function loadMTL(mtlUrl, texturePath = '') {
    const response = await fetch(mtlUrl);
    if (!response.ok) throw new Error(`Failed to load MTL: ${response.statusText}`);
    const content = await response.text();
    return parseMTL(content, texturePath);
}

/**
 * Create a material from MTL data for use with scene.
 * @param {Object} mtlData - Material data from MTL
 * @param {Object} loadedTextures - Map of texture name: texture handle
 * @returns {Object} Material-like object for scene rendering
 */
export function createMaterialFromMTL(mtlData, loadedTextures = {}) {
    return {
        type: 'mtl',
        name: mtlData.name,
        properties: {
            Ka: mtlData.Ka,
            Kd: mtlData.Kd,
            Ks: mtlData.Ks,
            Ns: mtlData.Ns,
            d: mtlData.d,
            Ni: mtlData.Ni,
        },
        textures: {
            ambient: loadedTextures[mtlData.map_Ka],
            diffuse: loadedTextures[mtlData.map_Kd],
            specular: loadedTextures[mtlData.map_Ks],
            normal: loadedTextures[mtlData.map_Bump],
            displacement: loadedTextures[mtlData.map_Disp],
            alpha: loadedTextures[mtlData.map_d],
        },
    };
}

/**
 * ModelLoader class for managing complete model loads with resources.
 * Handles texture loading, material setup, and scene integration.
 */
export class ModelLoader {
    constructor(options = {}) {
        this.texturePath = options.texturePath || '';
        this.cache = new Map();
        this.textureCache = new Map();
        this.materialCache = new Map();
    }

    /**
     * Load a model with all its materials and textures.
     * @param {string} url - Model file URL
     * @param {Object} options - Load options
     * @returns {Promise<Object>} Complete model data with loaded assets
     */
    async load(url, options = {}) {
        const cacheKey = url + JSON.stringify(options);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Load main model
        const modelData = await loadModel(url, {
            texturePath: this.texturePath,
            ...options,
        });

        // Load associated textures
        const loadedTextures = await this._loadTextures(modelData.materials);

        // Enrich model data
        const enrichedModel = {
            ...modelData,
            textures: loadedTextures,
            getMaterial: (name) =>
                createMaterialFromMTL(
                    modelData.materials[name],
                    loadedTextures
                ),
        };

        this.cache.set(cacheKey, enrichedModel);
        return enrichedModel;
    }

    /**
     * Load all textures referenced in materials.
     * @private
     */
    async _loadTextures(materials) {
        const texturePromises = [];
        const textureMap = {};

        for (const mat of Object.values(materials)) {
            const textureMaps = ['map_Ka', 'map_Kd', 'map_Ks', 'map_Bump', 'map_d', 'map_Disp'];

            for (const mapType of textureMaps) {
                if (mat[mapType] && !this.textureCache.has(mat[mapType])) {
                    const texPath = mat[mapType];
                    texturePromises.push(
                        fetch(texPath)
                            .then((res) => {
                                if (!res.ok) throw new Error(`Failed to load texture: ${texPath}`);
                                return res.blob();
                            })
                            .then((blob) => {
                                const url = URL.createObjectURL(blob);
                                textureMap[texPath] = url;
                                this.textureCache.set(texPath, url);
                            })
                            .catch((err) => {
                                console.warn(`Texture load failed (will use default):`, texPath, err);
                            })
                    );
                }
            }
        }

        await Promise.all(texturePromises);
        return textureMap;
    }

    /**
     * Clear caches.
     */
    clear() {
        this.cache.clear();
        this.textureCache.forEach((url) => URL.revokeObjectURL(url));
        this.textureCache.clear();
        this.materialCache.clear();
    }
}

export default ModelLoader;

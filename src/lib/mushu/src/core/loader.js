/**
 * mushu/core/loader — Asset Loading System
 * 
 * Centralized system for loading and parsing external assets:
 * - 3D Models (OBJ with MTL, glTF, and extensible format support)
 * - Textures and other resources
 * - Scene composition from model data
 * 
 * @module mushu/core/loader
 */

import { loadOBJ } from './geometry.js';
import { loadModel, loadMTL, ModelLoader, registerModelFormat } from './model.js';

export class Loader {
    /**
     * Load an OBJ file from URL or File object with optional MTL support.
     * @param {string|File|Blob} urlOrFile - URL, File object, or Blob
     * @param {Object} options - Load options
     * @param {string} options.mtlUrl - URL to associated MTL file
     * @param {File|Blob} options.mtlFile - MTL file object (alternative to mtlUrl)
     * @param {string} options.texturePath - Base path for texture references
     * @returns {Promise<Object>} Complete model data with materials and textures.
     */
    static async obj(urlOrFile, options = {}) {
        try {
            let objContent;

            // Handle File/Blob objects
            if (urlOrFile instanceof File || urlOrFile instanceof Blob) {
                objContent = await urlOrFile.text();
            } else if (typeof urlOrFile === 'string') {
                const response = await fetch(urlOrFile);
                if (!response.ok) throw new Error(`Failed to load OBJ: ${response.statusText}`);
                objContent = await response.text();
            } else {
                throw new Error('obj() requires a URL string, File, or Blob');
            }

            let mtlContent = null;

            // Try to load MTL from options
            if (options.mtlFile && (options.mtlFile instanceof File || options.mtlFile instanceof Blob)) {
                mtlContent = await options.mtlFile.text();
            } else if (options.mtlUrl) {
                try {
                    const mtlResponse = await fetch(options.mtlUrl);
                    if (mtlResponse.ok) {
                        mtlContent = await mtlResponse.text();
                    }
                } catch (e) {
                    console.warn('Failed to load MTL:', options.mtlUrl);
                }
            }

            return loadModel(objContent, {
                format: 'obj',
                mtlContent,
                texturePath: options.texturePath || '',
                ...options,
            });
        } catch (err) {
            console.error('Loader.obj error:', err);
            throw err;
        }
    }

    /**
     * Load a model file automatically detecting format from extension.
     * Supports: OBJ/MTL, glTF, glB, and extensible formats.
     * Can load from URL, File object, or Blob.
     * @param {string|File|Blob} urlOrFile - URL, File object, or Blob
     * @param {Object} options - Load options
     * @param {string} options.texturePath - Base path for textures
     * @param {string} options.format - Explicit format override
     * @returns {Promise<Object>} Parsed model with materials and metadata.
     */
    static async model(urlOrFile, options = {}) {
        try {
            return await loadModel(urlOrFile, options);
        } catch (err) {
            console.error('Loader.model error:', err);
            throw err;
        }
    }

    /**
     * Load a glTF file from URL (JSON or GLB).
     * @param {string} url - URL of the .gltf or .glb file.
     * @param {Object} options - Load options
     * @returns {Promise<Object>} Parsed glTF model.
     */
    static async gltf(url, options = {}) {
        try {
            return await loadModel(url, { format: 'gltf', ...options });
        } catch (err) {
            console.error('Loader.gltf error:', err);
            throw err;
        }
    }

    /**
     * Load MTL materials file.
     * @param {string} url - URL of the .mtl file.
     * @param {string} texturePath - Base path for texture references.
     * @returns {Promise<Object>} Materials map with properties.
     */
    static async mtl(url, texturePath = '') {
        try {
            return await loadMTL(url, texturePath);
        } catch (err) {
            console.error('Loader.mtl error:', err);
            throw err;
        }
    }

    /**
     * Create a model loader instance with caching and resource management.
     * Useful for loading multiple models with shared settings.
     * @param {Object} options - ModelLoader options
     * @returns {ModelLoader} Loader instance
     */
    static createModelLoader(options = {}) {
        return new ModelLoader(options);
    }

    /**
     * Register a custom model format loader.
     * Enables support for additional formats like BLEND, FBX, etc.
     * @param {string} format - File extension (e.g. 'blend', 'fbx')
     * @param {ModelFormatLoader} loader - Loader instance
     */
    static registerFormat(format, loader) {
        registerModelFormat(format, loader);
    }

    /**
     * Load multiple assets in parallel.
     * @param {Object} assets - Map of { name: url }
     * @returns {Promise<Object>} Map of { name: loadedAsset }
     */
    static async all(assets) {
        const keys = Object.keys(assets);
        const promises = keys.map(key => {
            const url = assets[key];
            if (url.endsWith('.obj')) return this.obj(url);
            if (url.endsWith('.gltf') || url.endsWith('.glb')) return this.gltf(url);
            if (url.endsWith('.mtl')) return this.mtl(url);
            return fetch(url).then(r => r.blob());
        });

        const results = await Promise.all(promises);
        return keys.reduce((acc, key, i) => {
            acc[key] = results[i];
            return acc;
        }, {});
    }
}

// Export model utilities for direct use
export { loadModel, loadMTL, ModelLoader, registerModelFormat };

export default Loader;

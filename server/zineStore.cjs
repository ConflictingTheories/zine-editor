'use strict';

/**
 * zineStore.cjs — canonical zine data shape.
 *
 * The `zines.data` column historically held TWO shapes:
 *   - the editor sync (POST /api/zines) wrote the pages ARRAY directly
 *   - the MCP handlers wrote the OBJECT { pages: [...] }
 * Every consumer that did `JSON.parse(zine.data).pages` 500'd on the other
 * shape. The canonical stored shape is the object { pages: [...] }.
 *
 * Rules:
 *   - READ through `normalizeZineData` — tolerates both legacy shapes.
 *   - WRITE through `serializeZineData` — always the canonical shape.
 */

/**
 * Normalize raw stored data to the canonical { pages: [...] } object.
 * Accepts the legacy bare-pages-array shape too.
 * @param {string|object|Array} raw — the stored `zines.data` value
 * @returns {{ pages: Array }}
 * @throws {Error} with `status = 400` when the shape is invalid.
 */
function normalizeZineData(raw) {
    let parsed;
    try {
        parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        parsed = undefined; // falls through to the invalid-shape error below
    }
    if (Array.isArray(parsed)) {
        return { pages: parsed };
    }
    if (parsed && Array.isArray(parsed.pages)) {
        return parsed;
    }
    const err = new Error('Invalid zine data: expected { pages: [...] } or a pages array');
    err.status = 400;
    throw err;
}

/**
 * Serialize zine data for storage — always the canonical shape.
 * @param {string|object|Array} raw
 * @returns {string} JSON string of { pages: [...] }
 */
function serializeZineData(raw) {
    return JSON.stringify(normalizeZineData(raw));
}

/**
 * Convenience: normalized pages array straight from a zine row.
 * @param {{ data: string }} zine — DB row
 * @returns {Array}
 */
function getPages(zine) {
    return normalizeZineData(zine.data).pages;
}

module.exports = { normalizeZineData, serializeZineData, getPages };

'use strict';
// P1: zines.data shape split-brain — canonicalization tests for server/zineStore.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeZineData, serializeZineData, getPages } = require('../zineStore.cjs');

const pages = [{ id: 'p1', elements: [] }, { id: 'p2', elements: [] }];

test('normalizeZineData accepts the canonical { pages } object', () => {
    const out = normalizeZineData(JSON.stringify({ pages }));
    assert.deepEqual(out.pages, pages);
});

test('normalizeZineData accepts the legacy bare pages array (editor sync shape)', () => {
    const out = normalizeZineData(JSON.stringify(pages));
    assert.deepEqual(out.pages, pages);
});

test('normalizeZineData accepts an already-parsed value', () => {
    assert.deepEqual(normalizeZineData({ pages }).pages, pages);
    assert.deepEqual(normalizeZineData(pages).pages, pages);
});

test('normalizeZineData throws 400 on invalid shapes', () => {
    for (const bad of ['"nope"', '{}', '{"pages":"nope"}', 'null', '']) {
        assert.throws(() => normalizeZineData(bad), /Invalid zine data/);
        try { normalizeZineData(bad); } catch (e) { assert.equal(e.status, 400); }
    }
});

test('serializeZineData always writes the canonical object shape', () => {
    // legacy array in → canonical object out
    const fromArray = JSON.parse(serializeZineData(pages));
    assert.ok(!Array.isArray(fromArray) && Array.isArray(fromArray.pages));
    // canonical object in → unchanged
    const fromObject = JSON.parse(serializeZineData({ pages }));
    assert.deepEqual(fromObject.pages, pages);
});

test('getPages reads the pages array off a zine row either way', () => {
    assert.deepEqual(getPages({ data: JSON.stringify(pages) }), pages);
    assert.deepEqual(getPages({ data: JSON.stringify({ pages }) }), pages);
});

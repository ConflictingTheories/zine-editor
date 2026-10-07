'use strict';

/**
 * assetStore.test.cjs — DiskAssetStore unit tests.
 * Pure fs + crypto: runs under plain `node --test`, no server, no installs.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { DiskAssetStore, sha256Hex } = require('../assetStore.cjs');

function tmpRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'svrn-assets-'));
}

test('put stores bytes and get returns them', async () => {
    const store = new DiskAssetStore(tmpRoot());
    const bytes = Buffer.from('hello svrn');
    const hash = sha256Hex(bytes);
    const meta = await store.put(hash, bytes, 'text/plain');
    assert.equal(meta.hash, hash);
    assert.equal(meta.size, bytes.length);
    const got = await store.get(hash);
    assert.ok(got);
    assert.deepEqual(got.buffer, bytes);
});

test('put rejects bytes that do not match the claimed hash', async () => {
    const store = new DiskAssetStore(tmpRoot());
    const bytes = Buffer.from('real bytes');
    const wrongHash = '0'.repeat(64);
    await assert.rejects(() => store.put(wrongHash, bytes), /hash mismatch/i);
    assert.equal(await store.exists(wrongHash), false);
});

test('put rejects malformed hashes', async () => {
    const store = new DiskAssetStore(tmpRoot());
    await assert.rejects(() => store.put('not-a-hash', Buffer.from('x')), /Invalid content hash/);
    await assert.rejects(() => store.put('../escape', Buffer.from('x')), /Invalid content hash/);
});

test('files are sharded by hash prefix', async () => {
    const root = tmpRoot();
    const store = new DiskAssetStore(root);
    const bytes = Buffer.from('shard me');
    const hash = sha256Hex(bytes);
    await store.put(hash, bytes);
    const expected = path.join(root, hash.slice(0, 2), hash);
    assert.ok(fs.existsSync(expected), `expected sharded path ${expected}`);
});

test('get returns null for missing hash', async () => {
    const store = new DiskAssetStore(tmpRoot());
    assert.equal(await store.get('a'.repeat(64)), null);
    assert.equal(await store.exists('a'.repeat(64)), false);
});

test('del removes bytes', async () => {
    const store = new DiskAssetStore(tmpRoot());
    const bytes = Buffer.from('bye');
    const hash = sha256Hex(bytes);
    await store.put(hash, bytes);
    assert.equal(await store.exists(hash), true);
    await store.del(hash);
    assert.equal(await store.exists(hash), false);
    assert.equal(await store.get(hash), null);
});

test('identical bytes are idempotent (dedupe by construction)', async () => {
    const store = new DiskAssetStore(tmpRoot());
    const bytes = Buffer.from('same');
    const hash = sha256Hex(bytes);
    await store.put(hash, bytes);
    await store.put(hash, bytes); // overwrite with identical content is a no-op
    const got = await store.get(hash);
    assert.deepEqual(got.buffer, bytes);
});

test('sha256Hex matches node crypto', () => {
    const bytes = crypto.randomBytes(64);
    assert.equal(sha256Hex(bytes), crypto.createHash('sha256').update(bytes).digest('hex'));
});

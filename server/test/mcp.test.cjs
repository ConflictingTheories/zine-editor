'use strict';
/**
 * P8: MCP surface integration test.
 *
 * Boots the real server as a child process against a temp SQLite file and
 * drives the MCP tools over HTTP: create zine -> add page -> add text
 * element -> apply theme -> publish, asserting state through the API.
 * Also covers the P1 data-shape regression (editor-synced zines must accept
 * MCP writes).
 *
 * Requires installed dependencies to execute (not run in this environment).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 18099;
const BASE = `http://127.0.0.1:${PORT}`;
const SERVER_ENTRY = path.resolve(__dirname, '../server.cjs');

let child = null;
let tmpDir = null;

async function waitForHealth(timeoutMs = 45000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        try {
            const res = await fetch(`${BASE}/api/health`);
            if (res.ok) return;
        } catch {
            // server not up yet
        }
        if (Date.now() > deadline) throw new Error('server did not become healthy in time');
        await new Promise((r) => setTimeout(r, 250));
    }
}

async function api(method, endpoint, token, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON body */ }
    return { status: res.status, json, text };
}

async function mcpTool(token, name, args) {
    const { status, json, text } = await api('POST', '/mcp/tools/call', token, { name, arguments: args });
    assert.equal(status, 200, `mcp tool ${name} failed: ${text}`);
    return json;
}

test.before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svrn-mcp-test-'));
    child = spawn(process.execPath, [SERVER_ENTRY], {
        env: {
            ...process.env,
            PORT: String(PORT),
            DB_PATH: path.join(tmpDir, 'test.sqlite'),
            JWT_SECRET: 'mcp-test-secret-not-for-prod',
            ALLOW_DEMO_ACCOUNT: 'false',
            NODE_ENV: 'test',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.on('error', (err) => { throw err; });
    await waitForHealth();
});

test.after(async () => {
    if (child && child.exitCode === null) {
        child.kill('SIGTERM');
        await once(child, 'exit').catch(() => {});
    }
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

let token;
let zineId;

test('registers a user and returns a JWT', async () => {
    const { status, json } = await api('POST', '/api/auth/register', null, {
        username: 'mcptest',
        email: 'mcp@test.local',
        password: 'testpassword123',
    });
    assert.equal(status, 200);
    assert.ok(json.token, 'expected a JWT');
    token = json.token;
});

test('mcp: create_zine -> add_page -> add_text_element -> get_zine', async () => {
    const created = await mcpTool(token, 'create_zine', { title: 'MCP Test Pixozine' });
    assert.ok(created.zineId, 'expected a zineId');
    zineId = created.zineId;

    const page = await mcpTool(token, 'add_page', { zineId, background: '#ffffff' });
    assert.equal(page.pageIdx, 1);

    const el = await mcpTool(token, 'add_text_element', {
        zineId, pageIdx: 1, content: 'Hello from the test agent',
    });
    assert.ok(el.elementId || el.id || el.element, 'expected an element reference');

    const zine = await mcpTool(token, 'get_zine', { zineId });
    const pages = zine.data.pages;
    assert.equal(pages.length, 2);
    assert.equal(pages[1].elements.length, 1);
    assert.equal(pages[1].elements[0].content, 'Hello from the test agent');
});

test('mcp: apply_theme touches every page without 500s', async () => {
    const result = await mcpTool(token, 'apply_theme', { zineId, theme: 'classic' });
    assert.ok(result);
    const zine = await mcpTool(token, 'get_zine', { zineId });
    assert.equal(zine.data.pages.length, 2);
});

test('P1 regression: MCP writes work on an editor-synced (array-shape) zine', async () => {
    // The editor syncs the bare pages array — the legacy shape that used to
    // make every MCP write 500.
    const legacyPages = [{ id: 'legacy-1', elements: [], background: '#ffffff', texture: null }];
    const { status, json } = await api('POST', '/api/zines', token, {
        title: 'Legacy Shape Zine',
        data: legacyPages,
        theme: 'classic',
    });
    assert.equal(status, 200);
    const legacyId = json.id;

    const page = await mcpTool(token, 'add_page', { zineId: legacyId, background: '#000000' });
    assert.equal(page.pageIdx, 1, 'MCP add_page must work on editor-synced zines');

    const zine = await mcpTool(token, 'get_zine', { zineId: legacyId });
    assert.equal(zine.data.pages.length, 2);
    assert.ok(!Array.isArray(zine.data), 'stored shape must be the canonical object');
});

test('P2: publish_zine persists monetization fields like the REST route', async () => {
    const result = await mcpTool(token, 'publish_zine', {
        zineId,
        author: 'Test Author',
        monetization_type: 'one_time',
        price: 5,
        currency: 'USD',
    });
    assert.equal(result.status, 'published');
    assert.equal(result.monetization_type, 'one_time');

    const { status, json } = await api('GET', `/mcp/zines/${zineId}`, token);
    assert.equal(status, 200);
    assert.equal(json.monetization_type, 'one_time');
    assert.ok(json.price_units > 0, 'price must be stored in credit units');
    assert.equal(json.is_published, 1);
});

test('P2: publish_zine 400s on a paid model without a price', async () => {
    const { status, json } = await api('POST', '/mcp/tools/call', token, {
        name: 'publish_zine',
        arguments: { zineId, monetization_type: 'one_time' },
    });
    assert.equal(status, 400);
    assert.match(json.error, /price above zero/);
});

import test from 'node:test'
import assert from 'node:assert/strict'
import { packSvrn, unpackSvrn } from '../src/index.js'

test('packages and verifies a normalized project', async () => {
  const project = { id: 'test-zine', title: 'Test Zine', pages: [{ id: 'one', background: '#fff', elements: [{ id: 'copy', type: 'text', content: 'Hello', x: 1, y: 2 }] }] }
  const packed = await packSvrn(project)
  const unpacked = await unpackSvrn(packed.archive)
  assert.equal(unpacked.manifest.issue.id, 'test-zine')
  assert.equal(unpacked.project.pages[0].elements[0].content, 'Hello')
})

test('rejects a corrupted archive', async () => {
  await assert.rejects(() => unpackSvrn(new Uint8Array([1, 2, 3])), /Invalid \.svrn archive/)
})

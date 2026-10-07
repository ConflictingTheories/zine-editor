import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PBKDF2_ITERATIONS,
  b64encode,
  b64decode,
  derivePageKey,
  encryptContent,
  decryptContent,
  encryptContentWithKey,
  decryptContentWithKey,
  randomSaltB64,
  isPageLocked,
  hasLegacyPassword,
  lockPage,
  unlockPage,
  relockPage,
  migrateLegacyPageLock,
} from '../src/pageCrypto.js'

// Fast iterations for unit tests; one test below exercises the default.
const FAST_ITER = 1000
const SECRET = 'the butler did it'
const WRONG = 'the gardener did it'

const samplePage = {
  id: 'p1',
  isLocked: true,
  background: '#0a0505',
  texture: null,
  elements: [{ id: 'el_1', type: 'text', content: 'The treasure is buried under the old oak.' }],
  interactions: [],
}

test('encrypt/decrypt roundtrip with a password', async () => {
  const envelope = await encryptContent({ hidden: SECRET }, SECRET, FAST_ITER)
  assert.equal(envelope.v, 1)
  assert.equal(envelope.iter, FAST_ITER)
  const back = await decryptContent(envelope, SECRET)
  assert.equal(back.hidden, SECRET)
})

test('wrong password fails closed', async () => {
  const envelope = await encryptContent({ hidden: SECRET }, SECRET, FAST_ITER)
  await assert.rejects(() => decryptContent(envelope, WRONG), /Incorrect password/)
})

test('tampered ciphertext fails closed', async () => {
  const envelope = await encryptContent({ hidden: SECRET }, SECRET, FAST_ITER)
  const tampered = { ...envelope, ct: envelope.ct.slice(0, -4) + 'AAAA' }
  await assert.rejects(() => decryptContent(tampered, SECRET), /Incorrect password/)
})

test('tampered salt fails closed', async () => {
  const envelope = await encryptContent({ hidden: SECRET }, SECRET, FAST_ITER)
  const tampered = { ...envelope, salt: randomSaltB64() }
  await assert.rejects(() => decryptContent(tampered, SECRET), /Incorrect password/)
})

test('malformed envelope is rejected before any crypto', async () => {
  await assert.rejects(() => decryptContent({ v: 1 }, SECRET), /malformed lock envelope/)
  await assert.rejects(() => decryptContent(null, SECRET), /malformed lock envelope/)
})

test('envelope leaks no plaintext', async () => {
  const envelope = await encryptContent({ hidden: SECRET }, SECRET, FAST_ITER)
  const serialized = JSON.stringify(envelope)
  assert.ok(!serialized.includes(SECRET), 'secret must not appear in the envelope')
  assert.ok(!serialized.includes(SECRET), 'password must not appear in the envelope')
})

test('default iteration count matches the OWASP recommendation', () => {
  assert.equal(PBKDF2_ITERATIONS, 600_000)
})

test('lockPage strips all plaintext content and the password', async () => {
  const locked = await lockPage({ ...samplePage, password: 'old-plaintext' }, SECRET, FAST_ITER)
  assert.ok(isPageLocked(locked))
  assert.equal(locked.id, 'p1')
  assert.equal(locked.isLocked, true)
  assert.ok(!('elements' in locked), 'elements must not survive locking')
  assert.ok(!('password' in locked), 'plaintext password must not survive locking')
  assert.ok(!JSON.stringify(locked).includes('treasure'), 'secret content must not leak')
})

test('unlockPage restores the full page on the correct password', async () => {
  const locked = await lockPage(samplePage, SECRET, FAST_ITER)
  const working = await unlockPage(locked, SECRET)
  assert.equal(working.id, 'p1')
  assert.equal(working.background, '#0a0505')
  assert.deepEqual(working.elements, samplePage.elements)
  assert.ok(!('lock' in working), 'working copy carries no envelope')
})

test('unlockPage rejects the wrong password', async () => {
  const locked = await lockPage(samplePage, SECRET, FAST_ITER)
  await assert.rejects(() => unlockPage(locked, WRONG), /Incorrect password/)
})

test('unlockPage refuses pages that are not locked', async () => {
  await assert.rejects(() => unlockPage({ id: 'p9' }, SECRET), /not locked/)
})

test('session-key re-lock avoids re-derivation and rotates the IV', async () => {
  const salt = randomSaltB64()
  const key = await derivePageKey(SECRET, salt, FAST_ITER)
  const session = { key, salt, iter: FAST_ITER }
  const env1 = await encryptContentWithKey({ n: 1 }, key, salt, FAST_ITER)
  const env2 = await encryptContentWithKey({ n: 1 }, key, salt, FAST_ITER)
  assert.notEqual(env1.iv, env2.iv, 'IV must never repeat')
  assert.notEqual(env1.ct, env2.ct)
  assert.equal((await decryptContentWithKey(env1, key)).n, 1)

  const locked = await lockPage(samplePage, SECRET, FAST_ITER)
  const working = await unlockPage(locked, SECRET)
  working.elements.push({ id: 'el_2', type: 'text', content: 'edited' })
  const relocked = await relockPage(working, session)
  assert.ok(isPageLocked(relocked))
  const back = await decryptContent(relocked.lock, SECRET)
  assert.equal(back.elements.length, 2)
})

test('legacy plaintext passwords migrate transparently on unlock', async () => {
  const legacy = { ...samplePage, password: 'mystery-code' }
  assert.ok(hasLegacyPassword(legacy))
  assert.ok(!isPageLocked(legacy))

  await assert.rejects(
    () => migrateLegacyPageLock(legacy, 'wrong-code', FAST_ITER),
    /Incorrect password/
  )
  const migrated = await migrateLegacyPageLock(legacy, 'mystery-code', FAST_ITER)
  assert.ok(isPageLocked(migrated))
  assert.ok(!('password' in migrated), 'plaintext password must be gone after migration')
  assert.ok(!hasLegacyPassword(migrated))
  const working = await unlockPage(migrated, 'mystery-code')
  assert.equal(working.elements[0].content, 'The treasure is buried under the old oak.')
})

test('b64 helpers roundtrip binary data', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 255])
  assert.deepEqual(b64decode(b64encode(bytes)), bytes)
})

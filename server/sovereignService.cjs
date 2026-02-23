/**
 * Sovereign Token Service
 * 
 * Handles sovereign token operations:
 * - Token creation and management
 * - Content sealing and unlocking
 * - Delegation management
 * - Integration with content gates
 */

'use strict';

const crypto = require('crypto');
const { encrypt, decrypt } = require('./encryption.cjs');

// Token constants
const MAGIC = 0x534F5631; // "SOV1"
const FRAME_COUNT = 60;
const FRAME_SIZE = 128;
const MAX_PAYLOAD_BYTES = 512;

// Helper functions (mirroring client-side for verification)
function bytesToBits(bytes) {
    const bits = [];
    for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
    return bits;
}

function bitsToBytes(bits) {
    const bitArray = Array.isArray(bits) ? bits : Array.from(bits);
    const paddedLength = Math.ceil(bitArray.length / 8) * 8;
    const paddedBits = [...bitArray];
    while (paddedBits.length < paddedLength) paddedBits.push(0);

    const bytes = new Uint8Array(paddedBits.length / 8);
    for (let i = 0; i < bytes.length; i++) {
        let v = 0;
        for (let j = 0; j < 8; j++) {
            const bitIndex = i * 8 + j;
            if (bitIndex < paddedBits.length) {
                v = (v << 1) | (paddedBits[bitIndex] & 1);
            }
        }
        bytes[i] = v;
    }
    return bytes;
}

function concatUint8(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of arrays) { out.set(a, off); off += a.length; }
    return out;
}

function u32ToBytes(n) {
    return new Uint8Array([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]);
}

function bytesToU32(b, o = 0) {
    return (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0;
}

// Seed and palette generation
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

async function hashSeed(str) {
    const buf = Buffer.from(str);
    const hash = crypto.createHash('sha256').update(buf).digest();
    return hash.readUInt32BE(0);
}

function derivePalette(seed) {
    const rng = mulberry32(seed);
    const h1 = Math.floor(rng() * 360);
    const h2 = (h1 + 120 + Math.floor(rng() * 60)) % 360;
    const h3 = (h2 + 120 + Math.floor(rng() * 60)) % 360;
    return [h1, h2, h3];
}

// Generate random bytes
function randomBytes(n) {
    return crypto.randomBytes(n);
}

// Base64 helpers
function toBase64Url(buf) {
    return buf.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function fromBase64Url(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64');
}

/**
 * Create a new sovereign token for a user
 */
async function createToken(db, userId, identity, claims = {}) {
    // Generate key pair using Node's crypto (ECDSA P-256)
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const tokenId = `sov_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const seed = await hashSeed(identity || tokenId);
    const palette = derivePalette(seed);

    // Build payload
    const payload = {
        id: identity,
        claims,
        iat: Date.now(),
        tokenId
    };

    const payloadBytes = Buffer.from(JSON.stringify(payload));
    if (payloadBytes.length > MAX_PAYLOAD_BYTES) {
        throw new Error('Claims payload too large (max 512B)');
    }

    // Create signature (simplified - in production use proper ECDSA)
    const signature = crypto.sign('sha256', payloadBytes, privateKey);

    // Build packet: header + payload + signature
    const header = concatUint8(
        u32ToBytes(MAGIC),
        u32ToBytes(payloadBytes.length),
        Buffer.alloc(8) // reserved
    );
    const packet = concatUint8(header, payloadBytes, Buffer.from(signature));

    // Store in database
    const [tokenRecordId] = await db('sovereign_tokens').insert({
        user_id: userId,
        token_id: tokenId,
        identity: identity,
        public_key_jwk: JSON.stringify({ // Simplified JWK representation
            kty: 'EC',
            crv: 'P-256',
            x: publicKey.toString('base64'),
            y: '' // Would need proper JWK conversion
        }),
        private_key_jwk: encrypt(privateKey), // Encrypt the private key
        claims: JSON.stringify(claims),
        token_data: toBase64Url(packet), // Store the full token data
        palette_h1: palette[0].toString(),
        palette_h2: palette[1].toString(),
        palette_h3: palette[2].toString()
    });

    return {
        tokenId,
        tokenData: toBase64Url(packet),
        palette,
        claims,
        identity
    };
}

/**
 * Verify a sovereign token
 */
async function verifyToken(db, tokenData) {
    try {
        const packet = fromBase64Url(tokenData);

        // Check magic bytes
        const magic = bytesToU32(packet, 0);
        if (magic !== MAGIC) {
            return { valid: false, error: 'Invalid magic bytes' };
        }

        // Parse header to get payload length
        const payloadLen = bytesToU32(packet, 4);
        const headerLen = 16;

        // Extract payload and signature
        const payload = packet.slice(headerLen, headerLen + payloadLen);
        const signature = packet.slice(headerLen + payloadLen);

        // Parse payload
        const claims = JSON.parse(payload.toString());

        // Look up token in database
        const tokenRecord = await db('sovereign_tokens')
            .where({ token_id: claims.tokenId, is_active: 1 })
            .first();

        if (!tokenRecord) {
            return { valid: false, error: 'Token not found in database' };
        }

        // Verify signature (simplified)
        const publicKey = tokenRecord.public_key_jwk;
        const isValid = crypto.verify('sha256', payload, publicKey, signature);

        return {
            valid: isValid,
            claims,
            tokenId: claims.tokenId,
            identity: claims.id
        };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

/**
 * Seal content with a sovereign token gate
 */
async function sealContent(db, zineId, tokenId, content) {
    // Get the token
    const token = await db('sovereign_tokens')
        .where({ token_id: tokenId, is_active: 1 })
        .first();

    if (!token) {
        throw new Error('Token not found');
    }

    // Generate gate ID
    const gateId = `gate_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    // Encrypt content (simplified - in production use the full SCEE or AES-GCM)
    const iv = crypto.randomBytes(12);
    const key = crypto.randomBytes(32); // In production, derive from token identity

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
        cipher.update(content, 'utf8'),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    // Combine: iv + authTag + encrypted
    const envelope = Buffer.concat([iv, authTag, encrypted]);

    // Store gate in database
    const [gateId_db] = await db('content_gates').insert({
        zine_id: zineId,
        gate_id: gateId,
        gate_type: 'token',
        envelope: toBase64Url(envelope),
        sovereign_token_id: token.id
    });

    return {
        gateId,
        envelope: toBase64Url(envelope)
    };
}

/**
 * Unlock content with a token
 */
async function unlockContent(db, gateId, tokenData) {
    // Get the gate
    const gate = await db('content_gates')
        .where({ gate_id: gateId, is_active: 1 })
        .first();

    if (!gate) {
        throw new Error('Gate not found');
    }

    // Verify the token
    const verification = await verifyToken(db, tokenData);
    if (!verification.valid) {
        throw new Error('Invalid token: ' + verification.error);
    }

    // Check if token belongs to gate owner
    const gateToken = await db('sovereign_tokens')
        .where({ id: gate.sovereign_token_id })
        .first();

    // For now, any valid token can unlock - in production, check ownership

    // Decrypt content
    const envelope = fromBase64Url(gate.envelope);
    const iv = envelope.slice(0, 12);
    const authTag = envelope.slice(12, 28);
    const encrypted = envelope.slice(28);

    // In production, derive key from token identity
    const key = crypto.randomBytes(32); // This should be derived

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    try {
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        return {
            content: decrypted.toString('utf8'),
            gateId,
            tokenId: verification.tokenId
        };
    } catch (error) {
        throw new Error('Decryption failed - token does not match gate');
    }
}

/**
 * Create a delegated token
 */
async function createDelegation(db, parentTokenId, delegateUserId, purpose, ttl = null) {
    // Get parent token
    const parentToken = await db('sovereign_tokens')
        .where({ id: parentTokenId, is_active: 1 })
        .first();

    if (!parentToken) {
        throw new Error('Parent token not found');
    }

    // Create delegation record
    const expiresAt = ttl ? new Date(Date.now() + ttl) : null;
    const gateId = `gate_${Date.now()}`; // Would link to specific gate

    const [delegationId] = await db('delegated_tokens').insert({
        parent_token_id: parentTokenId,
        delegate_user_id: delegateUserId,
        delegation_purpose: purpose,
        gate_id: gateId,
        expires_at: expiresAt
    });

    // In production, create actual delegated token blob

    return {
        delegationId,
        purpose,
        expiresAt,
        gateId
    };
}

/**
 * Verify a delegated token
 */
async function verifyDelegation(db, delegationId) {
    const delegation = await db('delegated_tokens')
        .where({ id: delegationId, is_active: 1 })
        .first();

    if (!delegation) {
        return { valid: false, error: 'Delegation not found' };
    }

    // Check expiration
    if (delegation.expires_at && new Date(delegation.expires_at) < new Date()) {
        return { valid: false, error: 'Delegation expired' };
    }

    return {
        valid: true,
        purpose: delegation.delegation_purpose,
        gateId: delegation.gate_id,
        expiresAt: delegation.expires_at
    };
}

/**
 * Get user's sovereign tokens
 */
async function getUserTokens(db, userId) {
    return db('sovereign_tokens')
        .where({ user_id: userId, is_active: 1 })
        .select('id', 'token_id', 'identity', 'claims', 'palette_h1', 'palette_h2', 'palette_h3', 'created_at');
}

/**
 * Get content gate info (without content)
 */
async function getGateInfo(db, gateId) {
    const gate = await db('content_gates as g')
        .join('sovereign_tokens as t', 'g.sovereign_token_id', 't.id')
        .join('zines as z', 'g.zine_id', 'z.id')
        .select(
            'g.id', 'g.gate_id', 'g.gate_type', 'g.price_credits', 'g.price_usd',
            'z.id as zine_id', 'z.title as zine_title',
            't.identity as creator_identity'
        )
        .where('g.gate_id', gateId)
        .first();

    return gate;
}

/**
 * Check if user has access to gated content
 */
async function checkAccess(db, zineId, userId) {
    // Get zine
    const zine = await db('zines').where({ id: zineId }).first();
    if (!zine) return { hasAccess: false, reason: 'not_found' };

    // Check if zine is free
    if (zine.access_level === 'public' || zine.monetization_type === 'free') {
        return { hasAccess: true };
    }

    // Check if user is owner
    if (zine.user_id === userId) {
        return { hasAccess: true, reason: 'owner' };
    }

    // Check funding status for crowdfunded content
    if (zine.monetization_type === 'crowdfund' && zine.is_funded) {
        return { hasAccess: true, reason: 'funded' };
    }

    // Check if user has contributed
    if (zine.monetization_type === 'crowdfund' || zine.monetization_type === 'one_time') {
        const contribution = await db('contributions')
            .where({ zine_id: zineId, user_id: userId })
            .first();
        if (contribution) {
            return { hasAccess: true, reason: 'contributor' };
        }
    }

    // Check subscription
    if (zine.monetization_type === 'subscription') {
        const subscription = await db('subscriptions')
            .where({ creator_id: zine.user_id, subscriber_id: userId, is_active: 1 })
            .first();
        if (subscription) {
            return { hasAccess: true, reason: 'subscriber' };
        }
    }

    // Check token gate
    if (zine.requires_token && zine.gate_id) {
        const delegation = await db('delegated_tokens')
            .where({ gate_id: zine.gate_id, delegate_user_id: userId, is_active: 1 })
            .first();
        if (delegation) {
            return { hasAccess: true, reason: 'token_holder' };
        }
    }

    return {
        hasAccess: false,
        reason: zine.monetization_type,
        price: zine.premium_price,
        fundingGoal: zine.funding_goal,
        amountRaised: zine.amount_raised
    };
}

module.exports = {
    createToken,
    verifyToken,
    sealContent,
    unlockContent,
    createDelegation,
    verifyDelegation,
    getUserTokens,
    getGateInfo,
    checkAccess,
    MAGIC,
    FRAME_COUNT,
    FRAME_SIZE,
    MAX_PAYLOAD_BYTES
};


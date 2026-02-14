const crypto = require('crypto');

// Use a consistent key for development if not provided
// In production, this MUST be a secure random 32-byte hex string provided in env vars
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000'; // 32 bytes (64 hex chars)
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = Buffer.from(ENCRYPTION_KEY, 'hex');

        // If key is invalid length (e.g. fallback string is not hex), handle or error. 
        // For existing fallback '00...', it is valid hex.

        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        console.error('Encryption error:', e);
        return text; // Fallback: store raw (NOT RECOMMENDED for prod, but prevents data loss in dev)
    }
}

function decrypt(text) {
    if (!text) return null;
    // Check if text is in format iv:encrypted
    const parts = text.split(':');
    if (parts.length !== 2) {
        // Assume unencrypted legacy data
        return text;
    }

    try {
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const key = Buffer.from(ENCRYPTION_KEY, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    } catch (e) {
        console.error('Decryption error:', e);
        return text; // Fallback
    }
}

module.exports = { encrypt, decrypt };

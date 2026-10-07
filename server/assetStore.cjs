/**
 * assetStore.cjs — content-hash-addressed binary storage.
 *
 * Assets are addressed by the SHA-256 of their bytes. The client already
 * references library bytes by `assetId` (see src/utils/projectAssets.js);
 * when syncing, the client uploads each missing hash once and every project
 * that references it stays a metadata-only JSON document. Deduplication is
 * free: identical bytes share one hash.
 *
 * Two implementations behind one interface:
 *   - DiskAssetStore  — dev default. Files under <root>/<hh>/<hash>.
 *   - S3AssetStore    — production. Same interface; throws a typed error
 *                       until S3_BUCKET (etc.) is configured.
 *
 * Encrypted pages inline their assets before locking (client-side), so the
 * server only ever sees opaque bytes here — it never decrypts anything.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const HASH_RE = /^[0-9a-f]{64}$/;

function assertHash(hash) {
    if (!HASH_RE.test(String(hash || ''))) {
        const err = new Error('Invalid content hash: expected 64 lowercase hex chars');
        err.status = 400;
        throw err;
    }
}

function sha256Hex(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

class DiskAssetStore {
    constructor(rootDir) {
        this.rootDir = rootDir;
        fs.mkdirSync(rootDir, { recursive: true });
    }

    _pathFor(hash) {
        assertHash(hash);
        return path.join(this.rootDir, hash.slice(0, 2), hash);
    }

    async put(hash, buffer, mime) {
        assertHash(hash);
        const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        if (sha256Hex(bytes) !== hash) {
            const err = new Error('Content hash mismatch: bytes do not match the claimed hash');
            err.status = 422;
            throw err;
        }
        const file = this._pathFor(hash);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        // Write atomically: temp file + rename, so a crash never leaves a
        // truncated asset behind under its final name.
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, bytes);
        fs.renameSync(tmp, file);
        return { hash, size: bytes.length, mime: mime || 'application/octet-stream' };
    }

    async get(hash) {
        const file = this._pathFor(hash);
        if (!fs.existsSync(file)) return null;
        return { buffer: fs.readFileSync(file) };
    }

    async exists(hash) {
        return fs.existsSync(this._pathFor(hash));
    }

    async del(hash) {
        const file = this._pathFor(hash);
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
}

class S3AssetStore {
    constructor({ bucket, region, endpoint, keyPrefix }) {
        this.bucket = bucket;
        this.region = region;
        this.endpoint = endpoint;
        this.keyPrefix = keyPrefix || 'assets/';
        // Lazy: only require the SDK when actually configured, so dev
        // installs never pay for it.
        this._sdk = null;
    }

    _client() {
        if (!this.bucket) {
            const err = new Error(
                'S3 asset store is not configured: set S3_BUCKET (and S3_REGION / AWS credentials). ' +
                'Falling back to disk storage: unset ASSET_STORE or set ASSET_STORE=disk.'
            );
            err.status = 503;
            err.code = 'asset-store-not-configured';
            throw err;
        }
        if (!this._sdk) {
            // Swap point: prefer the runtime's S3 client here.
            this._sdk = require('@aws-sdk/client-s3');
        }
        const { S3Client } = this._sdk;
        return new S3Client({
            region: this.region || 'us-east-1',
            ...(this.endpoint ? { endpoint: this.endpoint, forcePathStyle: true } : {}),
        });
    }

    _key(hash) {
        assertHash(hash);
        return `${this.keyPrefix}${hash.slice(0, 2)}/${hash}`;
    }

    async put(hash, buffer) {
        const client = this._client();
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        if (sha256Hex(bytes) !== hash) {
            const err = new Error('Content hash mismatch: bytes do not match the claimed hash');
            err.status = 422;
            throw err;
        }
        await client.send(new PutObjectCommand({ Bucket: this.bucket, Key: this._key(hash), Body: bytes }));
        return { hash, size: bytes.length };
    }

    async get(hash) {
        const client = this._client();
        const { GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
        try {
            await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this._key(hash) }));
        } catch {
            return null;
        }
        const out = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this._key(hash) }));
        const chunks = [];
        for await (const chunk of out.Body) chunks.push(chunk);
        return { buffer: Buffer.concat(chunks) };
    }

    async exists(hash) {
        const client = this._client();
        const { HeadObjectCommand } = require('@aws-sdk/client-s3');
        try {
            await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this._key(hash) }));
            return true;
        } catch {
            return false;
        }
    }

    async del(hash) {
        const client = this._client();
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this._key(hash) }));
    }
}

function createAssetStore() {
    const kind = (process.env.ASSET_STORE || 'disk').toLowerCase();
    if (kind === 's3') {
        return new S3AssetStore({
            bucket: process.env.S3_BUCKET,
            region: process.env.S3_REGION,
            endpoint: process.env.S3_ENDPOINT,
            keyPrefix: process.env.S3_KEY_PREFIX,
        });
    }
    const root = process.env.ASSET_STORE_PATH ||
        path.join(__dirname, 'data', 'assets');
    return new DiskAssetStore(root);
}

module.exports = {
    DiskAssetStore,
    S3AssetStore,
    createAssetStore,
    sha256Hex,
    assertHash,
};

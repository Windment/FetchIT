'use strict';

const { TextDecoder } = require('util');

const UTF8_STRICT = createDecoder('utf-8', true);
const GBK = createDecoder('gbk', false);

const MAX_PENDING_BYTES = 64 * 1024;

function createDecoder(encoding, fatal) {
    try {
        return new TextDecoder(encoding, { fatal });
    } catch (e) {
        return null;
    }
}

function decodeBuffer(buffer) {
    if (!buffer || !buffer.length) return '';

    if (UTF8_STRICT) {
        try {
            return UTF8_STRICT.decode(buffer);
        } catch (e) {
        }
    }

    if (GBK) {
        try {
            return GBK.decode(buffer);
        } catch (e) {
        }
    }

    return buffer.toString('utf8');
}

function createLineReader(onLine) {
    let pending = Buffer.alloc(0);

    const emit = (buffer) => {
        const line = decodeBuffer(buffer);
        if (line.trim()) onLine(line);
    };

    const flushPending = () => {
        if (!pending.length) return;
        const buffer = pending;
        pending = Buffer.alloc(0);
        emit(buffer);
    };

    return {
        write(chunk) {
            if (chunk === null || chunk === undefined) return;
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
            if (!buffer.length) return;

            pending = pending.length ? Buffer.concat([pending, buffer]) : buffer;

            let start = 0;
            for (let i = 0; i < pending.length; i++) {
                const byte = pending[i];
                if (byte !== 0x0a && byte !== 0x0d) continue;
                if (i > start) emit(pending.subarray(start, i));
                start = i + 1;
            }
            if (start > 0) pending = pending.subarray(start);

            if (pending.length > MAX_PENDING_BYTES) flushPending();
        },
        flush: flushPending
    };
}

module.exports = {
    decodeBuffer,
    createLineReader
};

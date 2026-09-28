'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ILLEGAL_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const RESERVED_NAMES = new Set([
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);
const MAX_NAME_LENGTH = 80;
const MAX_REGISTRY_ENTRIES = 500;
const MAX_DUPLICATE_SUFFIX = 999;

function sanitizeFolderName(name) {
    let value = String(name === null || name === undefined ? '' : name)
        .replace(ILLEGAL_CHARS, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    value = value.replace(/[. ]+$/, '');

    if (!value) value = '合集';

    if (RESERVED_NAMES.has(value.toUpperCase())) value = value + '_';

    if (value.length > MAX_NAME_LENGTH) {
        value = value.slice(0, MAX_NAME_LENGTH).replace(/[. ]+$/, '');
        if (!value) value = '合集';
    }

    return value;
}

function buildEpisodePrefix(index, total) {
    const position = Number(index);
    if (!isFinite(position) || position < 0) return '';

    const count = Math.max(Number(total) || 0, position + 1);
    const width = Math.max(2, String(count).length);

    return String(position + 1).padStart(width, '0') + '. ';
}

function keyOf(sourceUrl) {
    return crypto.createHash('sha1').update(String(sourceUrl || '')).digest('hex').slice(0, 16);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function readRegistry(registryFile) {
    if (!registryFile) return {};
    try {
        const data = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
        return data && typeof data === 'object' ? data : {};
    } catch (e) {
        return {};
    }
}

function writeRegistry(registryFile, registry) {
    if (!registryFile) return;
    try {
        const keys = Object.keys(registry);
        let payload = registry;

        if (keys.length > MAX_REGISTRY_ENTRIES) {
            payload = {};
            keys.slice(-MAX_REGISTRY_ENTRIES).forEach((key) => {
                payload[key] = registry[key];
            });
        }

        fs.mkdirSync(path.dirname(registryFile), { recursive: true });
        fs.writeFileSync(registryFile, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
    }
}

function resolveCollectionDir(baseDir, title, sourceUrl, registryFile) {
    const base = path.resolve(baseDir || process.cwd());
    const safeTitle = sanitizeFolderName(title);
    const key = keyOf(sourceUrl);
    const registry = readRegistry(registryFile);
    const known = registry[key];

    if (known && known.dir) {
        const knownDir = path.resolve(known.dir);
        if (path.dirname(knownDir) === base) {
            ensureDir(knownDir);
            return knownDir;
        }
    }

    const taken = new Set();
    Object.keys(registry).forEach((itemKey) => {
        const entry = registry[itemKey];
        if (!entry || !entry.dir || itemKey === key) return;
        taken.add(path.resolve(entry.dir));
    });

    let dir = path.join(base, safeTitle);
    let counter = 2;
    while (taken.has(path.resolve(dir)) && counter <= MAX_DUPLICATE_SUFFIX) {
        dir = path.join(base, `${safeTitle} (${counter})`);
        counter++;
    }

    ensureDir(dir);
    registry[key] = {
        dir,
        title: safeTitle,
        url: String(sourceUrl || ''),
        updatedAt: Date.now()
    };
    writeRegistry(registryFile, registry);

    return dir;
}

module.exports = {
    sanitizeFolderName,
    buildEpisodePrefix,
    resolveCollectionDir
};

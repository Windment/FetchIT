const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ctx = require('./context');

const CORE_KEY = Buffer.from('687a4852416d736f356b496e62617857', 'hex');
const META_KEY = Buffer.from('2331346C6A6B5F215C5D2630553C2728', 'hex');
const MAGIC = Buffer.from('CTENFDAM', 'ascii');
const KWM_PREDEFINED_KEY = 'MoOtOiTvINGwd2E6n0E1i7L5t2IoOoNk';

const DECRYPT_EXTENSIONS = ['ncm', 'uc', 'qmc0', 'qmc3', 'qmcflac', 'qmcogg', 'mflac', 'mflac0', 'mgg', 'mgg0', 'mgg1', 'kgm', 'kgma', 'vpr', 'kwm', 'xm', 'mg3d', 'tm0', 'tm2', 'tm3', 'tm6', 'ofl_en', 'x2m', 'x3m'];

function aesEcbDecrypt(buf, key) {
    const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
    decipher.setAutoPadding(true);
    return Buffer.concat([decipher.update(buf), decipher.final()]);
}

function sniffExt(buf) {
    if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'mp3';
    if (buf.length >= 4 && buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) return 'flac';
    if (buf.length >= 4 && buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return 'ogg';
    if (buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return 'm4a';
    if (buf.length >= 4 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'wav';
    return 'mp3';
}

function decryptNcm(filePath) {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 8 || !buf.subarray(0, 8).equals(MAGIC)) {
        throw new Error('不是有效的 NCM 文件');
    }
    let offset = 10;

    const keyLen = buf.readUInt32LE(offset);
    offset += 4;
    const keyCipher = Buffer.from(buf.subarray(offset, offset + keyLen));
    for (let i = 0; i < keyCipher.length; i++) keyCipher[i] ^= 0x64;
    offset += keyLen;
    const keyPlain = aesEcbDecrypt(keyCipher, CORE_KEY);
    const keyData = keyPlain.subarray(17);
    if (keyData.length === 0) throw new Error('无法解析密钥');

    const box = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) box[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (box[i] + j + keyData[i % keyData.length]) & 0xff;
        const t = box[i];
        box[i] = box[j];
        box[j] = t;
    }
    const keyBox = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) {
        const idx = (i + 1) & 0xff;
        const si = box[idx];
        const sj = box[(idx + si) & 0xff];
        keyBox[i] = box[(si + sj) & 0xff];
    }

    let meta = {};
    const metaLen = buf.readUInt32LE(offset);
    offset += 4;
    if (metaLen > 0) {
        const metaCipher = Buffer.from(buf.subarray(offset, offset + metaLen));
        for (let i = 0; i < metaCipher.length; i++) metaCipher[i] ^= 0x63;
        offset += metaLen;
        const b64 = metaCipher.subarray(22).toString('utf8');
        const metaPlain = aesEcbDecrypt(Buffer.from(b64, 'base64'), META_KEY).toString('utf8');
        const labelIndex = metaPlain.indexOf(':');
        try {
            const obj = JSON.parse(metaPlain.slice(labelIndex + 1));
            meta = metaPlain.slice(0, labelIndex) === 'dj' ? obj.mainMusic : obj;
        } catch (e) {}
    }

    offset += buf.readUInt32LE(offset + 5) + 13;
    const audio = Buffer.from(buf.subarray(offset));
    for (let i = 0; i < audio.length; i++) audio[i] ^= keyBox[i & 0xff];

    const format = (meta.format || sniffExt(audio)).toLowerCase();
    return { audio, format };
}

function decryptUc(filePath) {
    const buf = fs.readFileSync(filePath);
    const audio = Buffer.from(buf);
    for (let i = 0; i < audio.length; i++) audio[i] ^= 0xa3;
    return { audio, format: sniffExt(audio) };
}

function decryptKwm(filePath) {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 0x20) throw new Error('不是有效的 KWM 文件');
    const magic1 = Buffer.from('yeelion-kuwo-tme', 'ascii');
    const magic2 = Buffer.concat([Buffer.from('yeelion-kuwo', 'ascii'), Buffer.alloc(4)]);
    const head = buf.subarray(0, 16);
    if (!head.equals(magic1) && !head.equals(magic2)) {
        throw new Error('不是有效的 KWM 文件');
    }
    const keyStr = buf.subarray(0x18, 0x20).readBigUInt64LE(0).toString();
    let keyStrTrim = keyStr;
    if (keyStrTrim.length > 32) keyStrTrim = keyStrTrim.slice(0, 32);
    else if (keyStrTrim.length < 32) keyStrTrim = keyStrTrim.padEnd(32, keyStrTrim);
    const mask = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
        mask[i] = KWM_PREDEFINED_KEY.charCodeAt(i) ^ keyStrTrim.charCodeAt(i);
    }
    const audio = Buffer.from(buf.subarray(0x400));
    for (let i = 0; i < audio.length; i++) audio[i] ^= mask[i % 0x20];
    return { audio, format: sniffExt(audio) };
}

function decryptXm(filePath) {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 0x10) throw new Error('此 XM 文件已损坏');
    if (!buf.subarray(0, 4).equals(Buffer.from('ifmt', 'ascii'))) throw new Error('此 XM 文件已损坏');
    if (buf[8] !== 0xfe || buf[9] !== 0xfe || buf[10] !== 0xfe || buf[11] !== 0xfe) throw new Error('此 XM 文件已损坏');
    const typeMap = { ' WAV': 'wav', 'FLAC': 'flac', ' MP3': 'mp3', ' A4M': 'm4a' };
    const format = typeMap[buf.subarray(4, 8).toString('ascii')];
    if (!format) throw new Error('未知的 XM 文件类型');
    const key = buf[0xf];
    const dataOffset = buf[0xc] | (buf[0xd] << 8) | (buf[0xe] << 16);
    const audio = Buffer.from(buf.subarray(0x10));
    for (let cur = dataOffset; cur < audio.length; cur++) {
        audio[cur] = ((audio[cur] - key) ^ 0xff) & 0xff;
    }
    return { audio, format };
}

function isUpperHex(buf) {
    for (let i = 0; i < buf.length; i++) {
        const ch = buf[i];
        if (!((ch >= 0x30 && ch <= 0x39) || (ch >= 0x41 && ch <= 0x46))) return false;
    }
    return true;
}

function isPrintableAscii(buf) {
    for (let i = 0; i < buf.length; i++) {
        if (buf[i] < 0x20 || buf[i] > 0x7e) return false;
    }
    return true;
}

function decryptMg3dSegment(data, key) {
    const out = Buffer.from(data);
    for (let i = 0; i < out.length; i++) {
        out[i] = (out[i] - key[i % 0x20]) & 0xff;
    }
    return out;
}

function decryptMg3d(filePath) {
    const buf = fs.readFileSync(filePath);
    const segmentSize = 0x20;
    const header = buf.subarray(0, 0x100);
    const possibleKeys = [];
    for (let i = segmentSize; i < segmentSize * 20; i += segmentSize) {
        const possibleKey = buf.subarray(i, i + segmentSize);
        if (possibleKey.length < segmentSize) continue;
        if (!isUpperHex(possibleKey)) continue;
        const tempHeader = decryptMg3dSegment(header, possibleKey);
        if (!tempHeader.subarray(0, 4).equals(Buffer.from('RIFF', 'ascii'))) continue;
        if (!tempHeader.subarray(8, 16).equals(Buffer.from('WAVEfmt ', 'ascii'))) continue;
        const fmtChunkSize = tempHeader.readUInt32LE(0x10);
        if (![16, 18, 40].includes(fmtChunkSize)) continue;
        const firstDataChunkOffset = 0x14 + fmtChunkSize;
        if (firstDataChunkOffset + 4 > tempHeader.length) continue;
        if (!isPrintableAscii(tempHeader.subarray(firstDataChunkOffset, firstDataChunkOffset + 4))) continue;
        const secondDataChunkOffset = firstDataChunkOffset + 8 + tempHeader.readUInt32LE(firstDataChunkOffset + 4);
        if (secondDataChunkOffset <= header.length) {
            if (secondDataChunkOffset + 4 > tempHeader.length) continue;
            if (!isPrintableAscii(tempHeader.subarray(secondDataChunkOffset, secondDataChunkOffset + 4))) continue;
        }
        possibleKeys.push(Buffer.from(possibleKey));
    }
    if (possibleKeys.length === 0) throw new Error('未找到合适的密钥');
    const audio = decryptMg3dSegment(buf, possibleKeys[0]);
    return { audio, format: 'wav' };
}

function decryptFile(filePath) {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    switch (ext) {
        case 'ncm': return decryptNcm(filePath);
        case 'uc': return decryptUc(filePath);
        case 'kwm': return decryptKwm(filePath);
        case 'xm': return decryptXm(filePath);
        case 'mg3d': return decryptMg3d(filePath);
        default: throw new Error('暂不支持该格式');
    }
}

ipcMain.on('select-decrypt-files', async (event) => {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: '加密音乐', extensions: DECRYPT_EXTENSIONS }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        event.reply('decrypt-files-selected', result.filePaths);
    }
});

ipcMain.on('decrypt-files', (event, files) => {
    ctx.ensureDirectoryExists(ctx.settings.savePath);

    files.forEach((file) => {
        try {
            const { audio, format } = decryptFile(file.path);
            const base = path.basename(file.path, path.extname(file.path));
            const output = path.join(ctx.settings.savePath, base + '.' + format);
            fs.writeFileSync(output, audio);
            event.reply('decrypt-result', { id: file.id, success: true });
        } catch (error) {
            event.reply('decrypt-result', { id: file.id, success: false, error: error.message });
        }
    });
});

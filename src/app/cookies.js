const { ipcMain, dialog, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ctx = require('./context');

const INVALID_NAME_RE = /[\\/:*?"<>|]/;
const COOKIE_NAME_RE = /^[\w\u4e00-\u9fa5.\- ()]+$/;

ipcMain.on('select-cookies-file', async (event) => {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        event.reply('cookies-file-selected', result.filePaths[0]);
        event.reply('cookie-import-file-selected', result.filePaths[0]);
    }
});

ipcMain.on('update-advanced-memory', (event, data) => {
    let changed = false;
    if (data.cookiePath !== undefined && ctx.settings.lastCookiePath !== data.cookiePath) {
        ctx.settings.lastCookiePath = data.cookiePath;
        changed = true;
    }
    if (data.cookieName !== undefined && ctx.settings.lastCookieName !== data.cookieName) {
        ctx.settings.lastCookieName = data.cookieName;
        changed = true;
    }
    if (data.userAgent !== undefined && ctx.settings.lastUserAgent !== data.userAgent) {
        ctx.settings.lastUserAgent = data.userAgent;
        changed = true;
    }
    if (changed) ctx.saveSettingsToFile();
});

ipcMain.on('get-cookie-pool-path', (event) => {
    event.reply('cookie-pool-path', ctx.settings.cookiePool);
});

ipcMain.on('list-cookies', (event) => {
    const dir = ctx.settings.cookiePool;
    const broadcast = (list) => {
        event.reply('cookies-list', list);
        if (ctx.mainWindow) ctx.mainWindow.webContents.send('cookies-list-changed-raw', list);
    };
    if (!fs.existsSync(dir)) { broadcast([]); return; }
    fs.readdir(dir, { withFileTypes: true }, (err, files) => {
        if (err) { broadcast([]); return; }
        const results = [];
        for (const f of files) {
            if (!f.isFile() || !f.name.toLowerCase().endsWith('.txt')) continue;
            const full = path.join(dir, f.name);
            try {
                const stat = fs.statSync(full);
                results.push({
                    name: f.name.slice(0, -4),
                    fileName: f.name,
                    filePath: full,
                    mtimeMs: stat.mtimeMs
                });
            } catch (_) {}
        }
        results.sort((a, b) => b.mtimeMs - a.mtimeMs);
        broadcast(results);
    });
});

ipcMain.on('read-cookie-content', (event, nameInput) => {
    if (!nameInput || typeof nameInput !== 'string') { event.reply('cookie-content', { error: 'invalid' }); return; }
    if (nameInput.includes('/') || nameInput.includes('\\') || nameInput.includes('..')) {
        event.reply('cookie-content', { error: 'invalid' });
        return;
    }
    const fileName = nameInput.toLowerCase().endsWith('.txt') ? nameInput : (nameInput + '.txt');
    const target = path.join(ctx.settings.cookiePool, fileName);
    const poolRoot = path.resolve(ctx.settings.cookiePool);
    if (!path.resolve(target).toLowerCase().startsWith(poolRoot.toLowerCase())) {
        event.reply('cookie-content', { error: 'invalid' });
        return;
    }
    fs.readFile(target, 'utf8', (err, data) => {
        if (err) { event.reply('cookie-content', { error: 'not-found' }); return; }
        const MAX = 2 * 1024 * 1024;
        const baseName = fileName.slice(-4).toLowerCase() === '.txt' ? fileName.slice(0, -4) : fileName;
        if (Buffer.byteLength(data, 'utf8') > MAX) {
            let buf = Buffer.from(data, 'utf8');
            buf = buf.slice(0, MAX);
            event.reply('cookie-content', { name: baseName, content: buf.toString('utf8'), truncated: true });
        } else {
            event.reply('cookie-content', { name: baseName, content: data });
        }
    });
});

ipcMain.on('add-cookie-file', (event, payload) => {
    const srcPath = payload && payload.srcPath;
    const rawName = payload && payload.name;
    const overwrite = !!(payload && payload.overwrite);
    if (!srcPath || typeof srcPath !== 'string' || typeof rawName !== 'string') {
        event.reply('add-cookie-file-result', { error: 'invalid-name' });
        return;
    }
    const name = rawName.trim();
    if (!name || name.length > 64 || INVALID_NAME_RE.test(name)) {
        event.reply('add-cookie-file-result', { error: 'invalid-name' });
        return;
    }
    const fileName = name + '.txt';
    ctx.ensureDirectoryExists(ctx.settings.cookiePool);
    const target = path.join(ctx.settings.cookiePool, fileName);
    if (!fs.existsSync(srcPath)) {
        event.reply('add-cookie-file-result', { error: 'src-missing' });
        return;
    }
    if (fs.existsSync(target) && !overwrite) {
        event.reply('add-cookie-file-result', { error: 'exists', name });
        return;
    }
    fs.copyFile(srcPath, target, (err) => {
        if (err) {
            event.reply('add-cookie-file-result', { error: 'copy-failed' });
            return;
        }
        event.reply('add-cookie-file-result', { ok: true, name });
        if (ctx.mainWindow) ctx.mainWindow.webContents.send('cookies-list-changed');
    });
});

ipcMain.on('add-cookie-text', (event, payload) => {
    const rawName = payload && payload.name;
    const content = payload && payload.content;
    const overwrite = !!(payload && payload.overwrite);
    if (typeof rawName !== 'string' || typeof content !== 'string') {
        event.reply('add-cookie-file-result', { error: 'invalid-name' });
        return;
    }
    const name = rawName.trim();
    if (!name || name.length > 64 || INVALID_NAME_RE.test(name)) {
        event.reply('add-cookie-file-result', { error: 'invalid-name' });
        return;
    }
    if (!content.trim()) {
        event.reply('add-cookie-file-result', { error: 'empty-content' });
        return;
    }
    const fileName = name + '.txt';
    ctx.ensureDirectoryExists(ctx.settings.cookiePool);
    const target = path.join(ctx.settings.cookiePool, fileName);
    if (fs.existsSync(target) && !overwrite) {
        event.reply('add-cookie-file-result', { error: 'exists', name });
        return;
    }
    fs.writeFile(target, content, 'utf8', (err) => {
        if (err) {
            event.reply('add-cookie-file-result', { error: 'copy-failed' });
            return;
        }
        event.reply('add-cookie-file-result', { ok: true, name });
        if (ctx.mainWindow) ctx.mainWindow.webContents.send('cookies-list-changed');
    });
});

ipcMain.on('delete-cookie-file', (event, nameInput) => {
    if (!nameInput || typeof nameInput !== 'string' || nameInput.includes('/') || nameInput.includes('\\') || nameInput.includes('..')) {
        event.reply('delete-cookie-file-result', { error: 'invalid' });
        return;
    }
    const fileName = nameInput.toLowerCase().endsWith('.txt') ? nameInput : (nameInput + '.txt');
    const target = path.join(ctx.settings.cookiePool, fileName);
    const poolRoot = path.resolve(ctx.settings.cookiePool);
    if (!path.resolve(target).toLowerCase().startsWith(poolRoot.toLowerCase())) {
        event.reply('delete-cookie-file-result', { error: 'invalid' });
        return;
    }
    if (!fs.existsSync(target)) {
        event.reply('delete-cookie-file-result', { error: 'not-found' });
        return;
    }
    const deletedPath = path.resolve(target);
    fs.unlink(target, (err) => {
        if (err) { event.reply('delete-cookie-file-result', { error: 'failed' }); return; }
        event.reply('delete-cookie-file-result', { ok: true, deletedPath });
        if (ctx.mainWindow) ctx.mainWindow.webContents.send('cookies-list-changed');
    });
});

ipcMain.on('rename-cookie-file', (event, payload) => {
    const oldName = payload && payload.oldName;
    const rawName = payload && payload.newName;
    if (typeof oldName !== 'string' || typeof rawName !== 'string') {
        event.reply('rename-cookie-file-result', { error: 'invalid' });
        return;
    }
    const name = rawName.trim();
    if (!name || name.length > 64 || INVALID_NAME_RE.test(name) || !COOKIE_NAME_RE.test(name)) {
        event.reply('rename-cookie-file-result', { error: 'invalid-name' });
        return;
    }
    if (oldName.includes('/') || oldName.includes('\\') || oldName.includes('..')) {
        event.reply('rename-cookie-file-result', { error: 'invalid' });
        return;
    }
    const oldFile = oldName.toLowerCase().endsWith('.txt') ? oldName : oldName + '.txt';
    const newFile = name + '.txt';
    const poolRoot = path.resolve(ctx.settings.cookiePool);
    const oldTarget = path.join(ctx.settings.cookiePool, oldFile);
    const newTarget = path.join(ctx.settings.cookiePool, newFile);
    if (!path.resolve(oldTarget).toLowerCase().startsWith(poolRoot.toLowerCase()) ||
        !path.resolve(newTarget).toLowerCase().startsWith(poolRoot.toLowerCase())) {
        event.reply('rename-cookie-file-result', { error: 'invalid' });
        return;
    }
    if (!fs.existsSync(oldTarget)) {
        event.reply('rename-cookie-file-result', { error: 'not-found' });
        return;
    }
    if (oldFile.toLowerCase() === newFile.toLowerCase()) {
        event.reply('rename-cookie-file-result', { ok: true, oldName, name });
        if (ctx.mainWindow) ctx.mainWindow.webContents.send('cookies-list-changed');
        return;
    }
    if (fs.existsSync(newTarget)) {
        event.reply('rename-cookie-file-result', { error: 'exists', name });
        return;
    }
    fs.rename(oldTarget, newTarget, (err) => {
        if (err) { event.reply('rename-cookie-file-result', { error: 'failed' }); return; }
        event.reply('rename-cookie-file-result', { ok: true, oldName, name });
        if (ctx.mainWindow) ctx.mainWindow.webContents.send('cookies-list-changed');
    });
});

ipcMain.on('select-cookie-pool', async (event) => {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
        properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths.length) return;
    const newPath = result.filePaths[0];
    try {
        ctx.ensureDirectoryExists(newPath);
        ctx.settings.cookiePool = newPath;
        ctx.saveSettingsToFile();
        event.reply('cookie-pool-changed', newPath);
        if (ctx.mainWindow) ctx.mainWindow.webContents.send('cookies-list-changed');
    } catch (err) {
        if (ctx.mainWindow) ctx.mainWindow.webContents.send('show-notification', 'Cookie池目录切换失败，请检查权限');
    }
});

//非管理员权限时也许会遇到的问题
function ensureCookiePool() {
    try {
        ctx.ensureDirectoryExists(ctx.settings.cookiePool);
    } catch (err) {
        if (ctx.mainWindow) {
            ctx.mainWindow.webContents.send('show-notification', 'Cookie池目录创建失败，请检查权限或在设置中更换目录');
        }
    }
}

//cookies被拱了
function checkRememberedCookie() {
    if (ctx.settings.rememberCookie && ctx.settings.lastCookiePath) {
        fs.access(ctx.settings.lastCookiePath, fs.constants.F_OK, (err) => {
            if (err && ctx.mainWindow) {
                ctx.mainWindow.webContents.send('show-notification', 'cookie文件被挪动，需要的话请重新配置');
            }
        });
    }
}

const extractWindows = new Map();

function normalizeSiteUrl(input) {
    let text = String(input || '').trim();
    if (!text) return null;
    if (!/^https?:\/\//i.test(text)) text = 'https://' + text;
    try {
        const u = new URL(text);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        if (!u.hostname) return null;
        return u;
    } catch (_) {
        return null;
    }
}

function buildNetscapeCookieFile(cookies) {
    const sorted = (cookies || []).slice().sort((a, b) => {
        const da = String(a.domain || '').toLowerCase();
        const db = String(b.domain || '').toLowerCase();
        if (da !== db) return da < db ? -1 : 1;
        const na = String(a.name || '');
        const nb = String(b.name || '');
        return na < nb ? -1 : (na > nb ? 1 : 0);
    });
    const lines = ['# Netscape HTTP Cookie File'];
    sorted.forEach((c) => {
        const includeSub = !c.hostOnly;
        const d = String(c.domain || '').replace(/^\.+/, '');
        const domain = (includeSub ? '.' : '') + d;
        const flag = includeSub ? 'TRUE' : 'FALSE';
        const secure = c.secure ? 'TRUE' : 'FALSE';
        const expires = c.session ? 0 : Math.floor(c.expirationDate || 0);
        const prefix = c.httpOnly ? '#HttpOnly_' : '';
        lines.push(prefix + domain + '\t' + flag + '\t' + (c.path || '/') + '\t' + secure + '\t' + expires + '\t' + (c.name || '') + '\t' + (c.value == null ? '' : c.value));
    });
    return lines.join('\n') + '\n';
}

function generateExtractCookieName(hostname) {
    let base = String(hostname || 'cookie').toLowerCase().replace(/^www\./, '').replace(INVALID_NAME_RE, '_').replace(/[^\w.\- ()]/g, '').trim();
    if (!base) base = 'cookie';
    base = base.slice(0, 64);
    let name = base;
    let index = 2;
    const dir = ctx.settings.cookiePool;
    while (fs.existsSync(path.join(dir, name + '.txt'))) {
        name = base + '_' + index;
        index += 1;
    }
    return name;
}

ipcMain.on('start-cookie-extract', (event, url) => {
    const parsed = normalizeSiteUrl(url);
    if (!parsed) {
        event.reply('cookie-extract-error', '无效的站点地址，请输入完整域名');
        return;
    }
    const partition = 'cookie-extract-' + crypto.randomBytes(6).toString('hex');
    const win = new BrowserWindow({
        width: 1100,
        height: 780,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        resizable: true,
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true
        }
    });
    const webContentsId = win.webContents.id;
    const theme = ctx.settings.theme || 'dark';
    const primaryColor = ctx.settings.primaryColor || '#0078d4';
    extractWindows.set(webContentsId, { url: parsed.href, hostname: parsed.hostname, partition });
    win.loadFile(path.join(__dirname, '../renderer/cookie-extract.html'), {
        query: { url: parsed.href, hostname: parsed.hostname, partition, theme, primaryColor }
    });
    win.on('closed', () => {
        extractWindows.delete(webContentsId);
    });
    if (ctx.mainWindow) {
        ctx.mainWindow.once('closed', () => {
            if (!win.isDestroyed()) win.close();
        });
    }
});

ipcMain.on('cookie-extract-finish', (event) => {
    const info = extractWindows.get(event.sender.id);
    if (!info) return;
    const ses = session.fromPartition(info.partition);
    ses.cookies.get({}).then((cookies) => {
        if (!cookies || !cookies.length) {
            event.sender.send('cookie-extract-result', { error: 'no-cookies' });
            return;
        }
        const content = buildNetscapeCookieFile(cookies);
        const name = generateExtractCookieName(info.hostname);
        ctx.ensureDirectoryExists(ctx.settings.cookiePool);
        const target = path.join(ctx.settings.cookiePool, name + '.txt');
        fs.writeFile(target, content, 'utf8', (err) => {
            if (err) {
                event.sender.send('cookie-extract-result', { error: 'write-failed' });
                return;
            }
            event.sender.send('cookie-extract-result', { ok: true, name });
            if (ctx.mainWindow) ctx.mainWindow.webContents.send('cookies-list-changed');
        });
    }).catch(() => {
        event.sender.send('cookie-extract-result', { error: 'read-failed' });
    });
});

ipcMain.on('close-extract-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
});

module.exports = { ensureCookiePool, checkRememberedCookie };

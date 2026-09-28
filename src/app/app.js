const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const ctx = require('./context');
const windowManager = require('./window');
require('./settings');
const cookieManager = require('./cookies');
require('./downloads');
require('./decrypt');

function warmupBinary(binaryPath, args = ['--version']) {
    if (!binaryPath) return;
    try {
        const p = spawn(binaryPath, args, {
            stdio: 'ignore',
            windowsHide: true
        });
        p.on('error', () => {});
        p.unref();
    } catch (e) {}
}

function warmupBinaries() {
    warmupBinary(ctx.ytdlpPath);
    warmupBinary(ctx.ffmpegPath, ['-version']);
    warmupBinary(ctx.aria2cPath, ['--version']);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        windowManager.onSecondInstance();
    });
}

app.whenReady().then(async () => {
    if (!gotSingleInstanceLock) return;
    await ctx.loadSettings();
    windowManager.createMainWindow();
    ctx.ensureDirectoryExists(ctx.settings.savePath);
    cookieManager.ensureCookiePool();
    cookieManager.checkRememberedCookie();
    warmupBinaries();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    ctx.forceQuit = true;
    if (ctx.tray) { ctx.tray.destroy(); ctx.tray = null; }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createMainWindow();
    } else {
        windowManager.restoreFromTray();
    }
});

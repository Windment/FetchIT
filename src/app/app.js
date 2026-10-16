const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const log = require('./logger');
const ctx = require('./context');
const windowManager = require('./window');
require('./settings');
const cookieManager = require('./cookies');
require('./downloads');
require('./decrypt');

app.setAppUserModelId('com.windment.fetchit');

function warmupBinary(binaryPath, args = ['--version']) {
    if (!binaryPath) return;
    try {
        const p = spawn(binaryPath, args, {
            stdio: 'ignore',
            windowsHide: true
        });
        p.on('error', () => {});
        p.unref();
    } catch (e) {
        log.warn('app', 'Failed to warm up external tool:', binaryPath);
    }
}

function warmupBinaries() {
    warmupBinary(ctx.ytdlpPath);
    warmupBinary(ctx.ffmpegPath, ['-version']);
    warmupBinary(ctx.aria2cPath, ['--version']);
}

function checkExternalTools() {
    const tools = [
        ['yt-dlp', ctx.ytdlpPath],
        ['ffmpeg', ctx.ffmpegPath],
        ['aria2c', ctx.aria2cPath]
    ];
    tools.forEach(([name, p]) => {
        try {
            if (fs.existsSync(p)) {
                log.info('app', `External tool ready: ${name} (${p})`);
            } else {
                log.warn('app', `External tool missing: ${name} (${p}). Related downloads will be unavailable; restore the utils components from the official release page`);
            }
        } catch (e) {
            log.warn('app', `External tool check failed: ${name}`);
        }
    });
    const conf = require('path').join(ctx.utilsPath, 'aria2.conf');
    if (!fs.existsSync(conf)) {
        log.warn('app', `aria2 config missing: ${conf}; direct downloads may fail`);
    }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        log.info('app', 'Second instance detected, focusing main window');
        windowManager.onSecondInstance();
    });
}

app.whenReady().then(async () => {
    if (!gotSingleInstanceLock) return;
    await ctx.loadSettings();
    log.setLogDir(ctx.settings.logPath);
    log.info('app', `FetchIT starting: Electron ${process.versions.electron} / Chromium ${process.versions.chrome} / Node ${process.versions.node} / ${process.platform}`);
    log.info('app', `Settings loaded: savePath=${ctx.settings.savePath}, cookiePool=${ctx.settings.cookiePool}, closeBehavior=${ctx.settings.closeBehavior}, logPath=${ctx.settings.logPath}`);
    windowManager.createMainWindow();
    ctx.ensureDirectoryExists(ctx.settings.savePath);
    cookieManager.ensureCookiePool();
    cookieManager.checkRememberedCookie();
    checkExternalTools();
    warmupBinaries();
    log.info('app', 'Startup sequence complete');
});

app.on('window-all-closed', () => {
    log.info('app', 'All windows closed, quitting app');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    ctx.forceQuit = true;
    if (ctx.tray) {
        log.info('tray', 'App quitting, destroying tray');
        ctx.tray.destroy();
        ctx.tray = null;
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createMainWindow();
    } else {
        windowManager.restoreFromTray();
    }
});

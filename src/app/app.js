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
        log.warn('app', '预热外部工具失败：', binaryPath);
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
                log.info('app', `外部工具就绪：${name}（${p}）`);
            } else {
                log.warn('app', `外部工具缺失：${name}（${p}）。相关下载功能将不可用，请到官方发布页补齐 utils 目录组件`);
            }
        } catch (e) {
            log.warn('app', `外部工具检查失败：${name}`);
        }
    });
    const conf = require('path').join(ctx.utilsPath, 'aria2.conf');
    if (!fs.existsSync(conf)) {
        log.warn('app', `aria2 配置缺失：${conf}，直链下载可能失败`);
    }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        log.info('app', '检测到第二个实例，唤醒主窗口');
        windowManager.onSecondInstance();
    });
}

app.whenReady().then(async () => {
    if (!gotSingleInstanceLock) return;
    log.info('app', `FetchIT 启动：Electron ${process.versions.electron} / Chromium ${process.versions.chrome} / Node ${process.versions.node} / ${process.platform}`);
    await ctx.loadSettings();
    log.info('app', `设置已加载：保存位置=${ctx.settings.savePath}，Cookie池=${ctx.settings.cookiePool}，关闭行为=${ctx.settings.closeBehavior}`);
    windowManager.createMainWindow();
    ctx.ensureDirectoryExists(ctx.settings.savePath);
    cookieManager.ensureCookiePool();
    cookieManager.checkRememberedCookie();
    checkExternalTools();
    warmupBinaries();
    log.info('app', '启动流程完成');
});

app.on('window-all-closed', () => {
    log.info('app', '所有窗口已关闭，应用退出');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    ctx.forceQuit = true;
    if (ctx.tray) {
        log.info('tray', '应用退出，销毁托盘');
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

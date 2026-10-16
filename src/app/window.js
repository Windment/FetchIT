const { app, BrowserWindow, Tray, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const log = require('./logger');
const ctx = require('./context');

function createMainWindow() {
    ctx.mainWindow = new BrowserWindow({
        width: 1000,
        height: 750,
        minWidth: 1000,
        minHeight: 750,
        frame: false,
        resizable: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devTools: false
        },
        backgroundColor: '#000000'
    });

    ctx.mainWindow.setAspectRatio(1000 / 750);

    ctx.mainWindow.webContents.on('render-process-gone', (_e, details) => {
        log.error('window', 'Renderer process crashed:', details && details.reason);
    });

    ctx.mainWindow.once('ready-to-show', () => {
        ctx.mainWindow.show();
        log.info('window', 'Main window created and shown');
    });

    ctx.mainWindow.on('close', (e) => {
        if (ctx.forceQuit) {
            if (ctx.tray) { ctx.tray.destroy(); ctx.tray = null; }
            return;
        }
        if (ctx.settings.closeBehavior === 'ask') {
            e.preventDefault();
            if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
                ctx.mainWindow.webContents.send('show-close-choice');
            }
            return;
        }
        if (ctx.settings.closeBehavior === 'minimize') {
            e.preventDefault();
            log.info('window', 'Window close: minimizing to tray');
            if (ctx.settings.openOutputOnClose) shell.openPath(ctx.settings.savePath);
            minimizeToTray();
        } else {
            log.info('window', 'Window close: quitting app');
            if (ctx.settings.openOutputOnClose) shell.openPath(ctx.settings.savePath);
            if (ctx.tray) { ctx.tray.destroy(); ctx.tray = null; }
        }
    });

    ctx.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function createTray() {
    if (ctx.tray) return;
    try {
        const iconPath = ctx.getTrayIconPath();
        ctx.tray = new Tray(iconPath);
        ctx.tray.setToolTip('FetchIT');
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '显示主窗口',
                click: () => { restoreFromTray(); }
            },
            {
                label: '打开输出文件夹',
                click: () => { shell.openPath(ctx.settings.savePath); }
            },
            { type: 'separator' },
            {
                label: '退出 FetchIT',
                click: () => {
                    log.info('tray', 'User quit via tray menu');
                    ctx.forceQuit = true;
                    if (ctx.tray) { ctx.tray.destroy(); ctx.tray = null; }
                    app.quit();
                }
            }
        ]);
        ctx.tray.setContextMenu(contextMenu);
        ctx.tray.on('click', () => { restoreFromTray(); });
        ctx.tray.on('double-click', () => { restoreFromTray(); });
        log.info('tray', 'System tray created');
    } catch (err) {
        log.error('tray', 'Failed to create tray:', err);
    }
}

function restoreFromTray() {
    if (!ctx.mainWindow) { createMainWindow(); return; }
    if (ctx.mainWindow.isMinimized()) ctx.mainWindow.restore();
    ctx.mainWindow.show();
    ctx.mainWindow.focus();
    log.debug('window', 'Restoring main window from tray');
}

function minimizeToTray() {
    createTray();
    if (ctx.mainWindow) {
        ctx.mainWindow.hide();
        log.info('window', 'Window hidden to tray');
        if (process.platform === 'darwin') app.dock && app.dock.hide && app.dock.hide();
    }
}

function onSecondInstance() {
    if (!ctx.mainWindow) { createMainWindow(); return; }
    if (ctx.mainWindow.isMinimized()) ctx.mainWindow.restore();
    ctx.mainWindow.show();
    ctx.mainWindow.focus();
}

function applyCloseChoice(action, remember) {
    log.info('window', `User chose close behavior: ${action}${remember ? ' (remembered)' : ''}`);
    if (remember) {
        ctx.settings.closeBehavior = action;
        ctx.saveSettingsToFile();
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
            ctx.mainWindow.webContents.send('settings-data', ctx.settings);
        }
    }
    if (action === 'minimize') {
        minimizeToTray();
    } else {
        ctx.forceQuit = true;
        if (ctx.tray) { ctx.tray.destroy(); ctx.tray = null; }
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) ctx.mainWindow.close();
    }
}

ipcMain.on('minimize-window', () => {
    log.debug('window', 'Minimizing window');
    ctx.mainWindow.minimize();
});

ipcMain.on('flash-frame', () => {
    if (ctx.mainWindow && !ctx.mainWindow.isFocused()) {
        ctx.mainWindow.flashFrame(true);
    }
});

ipcMain.on('close-window', () => {
    ctx.mainWindow.close();
});

ipcMain.on('close-window-choice', (_event, payload) => {
    const action = payload && payload.action === 'minimize' ? 'minimize' : 'quit';
    const remember = !!(payload && payload.remember);
    applyCloseChoice(action, remember);
});

ipcMain.on('open-output-folder', () => {
    shell.openPath(ctx.settings.savePath);
});

ipcMain.on('open-folder', (_event, dirPath) => {
    if (typeof dirPath === 'string' && dirPath) {
        shell.openPath(dirPath);
    }
});

ipcMain.on('open-external', (_event, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        shell.openExternal(url);
    }
});

ipcMain.on('renderer-log', (_event, payload) => {
    try {
        const level = payload && payload.level;
        const mod = (payload && payload.module) || 'renderer';
        const args = (payload && payload.args) || [];
        const safe = ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info';
        log[safe](mod, ...args.map((a) => String(a)).slice(0, 6));
    } catch (err) {}
});

module.exports = { createMainWindow, restoreFromTray, onSecondInstance };

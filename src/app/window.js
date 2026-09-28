const { app, BrowserWindow, Tray, Menu, shell, ipcMain } = require('electron');
const path = require('path');
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
            devTools: false,
            enableRemoteModule: true
        },
        backgroundColor: '#000000'
    });

    ctx.mainWindow.setAspectRatio(1000 / 750);

    ctx.mainWindow.once('ready-to-show', () => {
        ctx.mainWindow.show();
    });

    ctx.mainWindow.on('close', (e) => {
        if (ctx.forceQuit) {
            if (ctx.tray) { ctx.tray.destroy(); ctx.tray = null; }
            return;
        }
        if (ctx.settings.closeBehavior === 'minimize') {
            e.preventDefault();
            if (ctx.settings.openOutputOnClose) shell.openPath(ctx.settings.savePath);
            minimizeToTray();
        } else {
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
                    ctx.forceQuit = true;
                    if (ctx.tray) { ctx.tray.destroy(); ctx.tray = null; }
                    app.quit();
                }
            }
        ]);
        ctx.tray.setContextMenu(contextMenu);
        ctx.tray.on('click', () => { restoreFromTray(); });
        ctx.tray.on('double-click', () => { restoreFromTray(); });
    } catch (err) {
    }
}

function restoreFromTray() {
    if (!ctx.mainWindow) { createMainWindow(); return; }
    if (ctx.mainWindow.isMinimized()) ctx.mainWindow.restore();
    ctx.mainWindow.show();
    ctx.mainWindow.focus();
}

function minimizeToTray() {
    createTray();
    if (ctx.mainWindow) {
        ctx.mainWindow.hide();
        if (process.platform === 'darwin') app.dock && app.dock.hide && app.dock.hide();
    }
}

function onSecondInstance() {
    if (!ctx.mainWindow) { createMainWindow(); return; }
    if (ctx.mainWindow.isMinimized()) ctx.mainWindow.restore();
    ctx.mainWindow.show();
    ctx.mainWindow.focus();
}

ipcMain.on('minimize-window', () => {
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

ipcMain.on('open-output-folder', () => {
    shell.openPath(ctx.settings.savePath);
});

module.exports = { createMainWindow, restoreFromTray, onSecondInstance };

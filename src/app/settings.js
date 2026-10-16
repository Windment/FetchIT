const { app, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const log = require('./logger');
const ctx = require('./context');

ipcMain.on('get-settings', (event) => {
    event.reply('settings-data', ctx.settings);
});

ipcMain.on('reset-settings', (event) => {
    ctx.settings = { ...ctx.defaultSettings };
    ctx.ensureDirectoryExists(ctx.settings.savePath);
    try { ctx.ensureDirectoryExists(ctx.settings.logPath); } catch (_) {}
    log.setLogDir(ctx.settings.logPath);
    ctx.saveSettingsToFile();
    log.info('settings', 'Settings reset to defaults');
    if (ctx.mainWindow) {
        ctx.mainWindow.webContents.send('notification-duration-updated', ctx.settings.notificationDuration || 3);
        ctx.mainWindow.webContents.send('system-notification-updated', {
            onComplete: ctx.settings.systemNotificationOnComplete !== false,
            scope: ctx.settings.systemNotificationScope || 'all'
        });
        ctx.mainWindow.webContents.send('remember-settings-updated', {
            rememberCookie: ctx.settings.rememberCookie !== false,
            rememberUserAgent: ctx.settings.rememberUserAgent !== false
        });
    }
    event.reply('settings-data', ctx.settings);
});

ipcMain.on('save-settings', (event, newSettings) => {
    const prevRememberCookie = ctx.settings.rememberCookie;
    const prevRememberUserAgent = ctx.settings.rememberUserAgent;
    const prevLogPath = ctx.settings.logPath;
    ctx.settings = { ...ctx.settings, ...newSettings };
    if (prevRememberCookie && !ctx.settings.rememberCookie) {
        ctx.settings.lastCookiePath = '';
    }
    if (prevRememberUserAgent && !ctx.settings.rememberUserAgent) {
        ctx.settings.lastUserAgent = '';
    }
    ctx.ensureDirectoryExists(ctx.settings.savePath);
    try { ctx.ensureDirectoryExists(ctx.settings.cookiePool); } catch (_) {}
    try { ctx.ensureDirectoryExists(ctx.settings.logPath); } catch (_) {}
    ctx.saveSettingsToFile();
    if (prevLogPath !== ctx.settings.logPath) {
        log.setLogDir(ctx.settings.logPath);
    }
    log.info('settings', `Settings saved: closeBehavior=${ctx.settings.closeBehavior}, maxConcurrentTasks=${ctx.settings.maxConcurrentTasks}, concurrency=${ctx.settings.concurrency}, savePath=${ctx.settings.savePath}, cookiePool=${ctx.settings.cookiePool}, logPath=${ctx.settings.logPath}`);
    if (ctx.mainWindow) {
        ctx.mainWindow.webContents.send('notification-duration-updated', ctx.settings.notificationDuration || 3);
        ctx.mainWindow.webContents.send('system-notification-updated', {
            onComplete: ctx.settings.systemNotificationOnComplete !== false,
            scope: ctx.settings.systemNotificationScope || 'all'
        });
        ctx.mainWindow.webContents.send('remember-settings-updated', {
            rememberCookie: ctx.settings.rememberCookie !== false,
            rememberUserAgent: ctx.settings.rememberUserAgent !== false
        });
    }
    event.reply('settings-saved', true);
});

ipcMain.on('select-save-path', async (event) => {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        log.info('settings', `Save path selected: ${result.filePaths[0]}`);
        event.reply('save-path-selected', result.filePaths[0]);
    }
});

ipcMain.on('select-log-path', async (event) => {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
        properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        log.info('settings', `Log path selected: ${result.filePaths[0]}`);
        event.reply('log-path-selected', result.filePaths[0]);
    }
});

ipcMain.on('clear-logs', (event) => {
    const current = log.getLogFilePath();
    const dir = current ? path.dirname(current) : ctx.settings.logPath;
    let removed = 0;
    try {
        fs.readdirSync(dir).forEach((name) => {
            if (!name.toLowerCase().endsWith('.log')) return;
            try {
                fs.unlinkSync(path.join(dir, name));
                removed++;
            } catch (_) {}
        });
        log.info('settings', `Logs cleared (${removed} files)`);
    } catch (error) {
        log.error('settings', 'Failed to clear logs:', error);
    }
    event.reply('logs-cleared', { removed });
});

ipcMain.on('select-background-image', async (event) => {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
        properties: ['openFile'],
        filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
    });

    if (result.canceled || result.filePaths.length === 0) return;

    const srcPath = result.filePaths[0];
    const ext = path.extname(srcPath) || '.png';
    const destPath = path.join(app.getPath('userData'), 'background-' + Date.now() + ext);

    const prev = ctx.settings.backgroundImage;
    if (prev && prev !== destPath) {
        try { fs.unlinkSync(prev); } catch (_) {}
    }

    try {
        fs.copyFileSync(srcPath, destPath);
    } catch (error) {
        event.reply('background-image-selected', null);
        return;
    }

    event.reply('background-image-selected', destPath);
});

ipcMain.on('remove-background-image', (event) => {
    const bg = ctx.settings.backgroundImage;
    if (bg) {
        try { fs.unlinkSync(bg); } catch (_) {}
    }
    event.reply('background-image-removed');
});

ipcMain.on('export-settings', async (event) => {
    const result = await dialog.showSaveDialog(ctx.mainWindow, {
        defaultPath: 'fetchit-settings.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (!result.canceled && result.filePath) {
        try {
            fs.writeFileSync(result.filePath, JSON.stringify(ctx.settings, null, 4), 'utf8');
            log.info('settings', `Settings exported to ${result.filePath}`);
            event.reply('settings-exported', true);
        } catch (error) {
            log.error('settings', 'Failed to export settings:', error);
            event.reply('settings-exported', false);
        }
    }
});

ipcMain.on('import-settings', async (event) => {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        try {
            const data = fs.readFileSync(result.filePaths[0], 'utf8');
            const importedSettings = JSON.parse(data);
            log.info('settings', `Settings imported from ${result.filePaths[0]}`);
            event.reply('settings-imported', importedSettings);
        } catch (error) {
            log.error('settings', 'Failed to import settings:', error);
            event.reply('settings-imported', null);
        }
    }
});

ipcMain.on('import-settings-from-path', (event, filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const importedSettings = JSON.parse(data);
        log.info('settings', `Settings imported from ${filePath}`);
        event.reply('settings-imported', importedSettings);
    } catch (error) {
        log.error('settings', 'Failed to import settings:', error);
        event.reply('settings-imported', null);
    }
});

ipcMain.on('apply-imported-settings', (event, importedSettings) => {
    ctx.settings = { ...ctx.defaultSettings, ...importedSettings };
    ctx.ensureDirectoryExists(ctx.settings.savePath);
    try { ctx.ensureDirectoryExists(ctx.settings.logPath); } catch (_) {}
    log.setLogDir(ctx.settings.logPath);
    ctx.saveSettingsToFile();
    log.info('settings', 'Imported settings applied');
    if (ctx.mainWindow) {
        ctx.mainWindow.webContents.send('notification-duration-updated', ctx.settings.notificationDuration || 3);
    }
    event.reply('settings-data', ctx.settings);
    event.reply('settings-applied', true);
});

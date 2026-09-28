const { app, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const ctx = require('./context');

ipcMain.on('get-settings', (event) => {
    event.reply('settings-data', ctx.settings);
});

ipcMain.on('reset-settings', (event) => {
    ctx.settings = { ...ctx.defaultSettings };
    ctx.ensureDirectoryExists(ctx.settings.savePath);
    ctx.saveSettingsToFile();
    if (ctx.mainWindow) {
        ctx.mainWindow.webContents.send('notification-duration-updated', ctx.settings.notificationDuration || 3);
        ctx.mainWindow.webContents.send('system-notification-updated', ctx.settings.systemNotificationOnComplete !== false);
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
    ctx.settings = { ...ctx.settings, ...newSettings };
    if (prevRememberCookie && !ctx.settings.rememberCookie) {
        ctx.settings.lastCookiePath = '';
    }
    if (prevRememberUserAgent && !ctx.settings.rememberUserAgent) {
        ctx.settings.lastUserAgent = '';
    }
    ctx.ensureDirectoryExists(ctx.settings.savePath);
    try { ctx.ensureDirectoryExists(ctx.settings.cookiePool); } catch (_) {}
    ctx.saveSettingsToFile();
    if (ctx.mainWindow) {
        ctx.mainWindow.webContents.send('notification-duration-updated', ctx.settings.notificationDuration || 3);
        ctx.mainWindow.webContents.send('system-notification-updated', ctx.settings.systemNotificationOnComplete !== false);
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
        event.reply('save-path-selected', result.filePaths[0]);
    }
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
            event.reply('settings-exported', true);
        } catch (error) {
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
            event.reply('settings-imported', importedSettings);
        } catch (error) {
            event.reply('settings-imported', null);
        }
    }
});

ipcMain.on('import-settings-from-path', (event, filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const importedSettings = JSON.parse(data);
        event.reply('settings-imported', importedSettings);
    } catch (error) {
        event.reply('settings-imported', null);
    }
});

ipcMain.on('apply-imported-settings', (event, importedSettings) => {
    ctx.settings = { ...ctx.defaultSettings, ...importedSettings };
    ctx.ensureDirectoryExists(ctx.settings.savePath);
    ctx.saveSettingsToFile();
    if (ctx.mainWindow) {
        ctx.mainWindow.webContents.send('notification-duration-updated', ctx.settings.notificationDuration || 3);
    }
    event.reply('settings-data', ctx.settings);
    event.reply('settings-applied', true);
});

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';
const utilsPath = isDev ? path.join(__dirname, '../../utils') : path.join(process.resourcesPath, 'utils');

//这一坨是默认设置
const ctx = {
    isDev,
    utilsPath,
    ytdlpPath: path.join(utilsPath, 'yt-dlp.exe'),
    ffmpegPath: path.join(utilsPath, 'ffmpeg.exe'),
    aria2cPath: path.join(utilsPath, 'aria2c.exe'),
    mainWindow: null,
    downloadTasks: [],
    activeDownloads: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalTasks: 0,
    tray: null,
    forceQuit: false,
    settingsFilePath: path.join(app.getPath('userData'), 'settings.json'),
    collectionFoldersFile: path.join(app.getPath('userData'), 'collection-folders.json'),
    defaultSettings: {
        savePath: path.join(app.getPath('downloads'), 'FetchIT') + path.sep,
        maxConcurrentTasks: 3,
        concurrency: 8,
        forceIpv4: 'default',
        progressFreezeRetry: { enabled: false, value: 180 },
        requestInterval: 0.5,
        rateLimit: { enabled: false, value: '' },
        cookies: { enabled: false, path: '' },
        proxy: { enabled: false, value: '' },
        customHeaders: { enabled: false, value: '' },
        theme: 'dark',
        primaryColor: '#0078d4',
        notificationDuration: 3,
        systemNotificationOnComplete: true,
        rememberCookie: true,
        rememberUserAgent: true,
        lastCookiePath: '',
        lastUserAgent: '',
        closeBehavior: 'quit',
        openOutputOnClose: false,
        cookiePool: path.join(app.getPath('documents'), 'Mycookies'),
        lastCookieName: '',
        backgroundImage: '',
        backgroundBlur: 10,
        collectionFolderEnabled: true
    },
    settings: null,
    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    },
    saveSettingsToFile() {
        fs.writeFile(ctx.settingsFilePath, JSON.stringify(ctx.settings, null, 4), 'utf8', (error) => {
            if (error) {
            }
        });
    },
    loadSettings() {
        return new Promise((resolve) => {
            fs.readFile(ctx.settingsFilePath, 'utf8', (error, data) => {
                if (error) {
                    ctx.settings = { ...ctx.defaultSettings };
                } else {
                    try {
                        const loadedSettings = JSON.parse(data);
                        ctx.settings = { ...ctx.defaultSettings, ...loadedSettings };
                    } catch (parseError) {
                        ctx.settings = { ...ctx.defaultSettings };
                    }
                }
                resolve();
            });
        });
    },
    getTrayIconPath() {
        const devIco = path.join(__dirname, '../../icons/icon.ico');
        const prodIco = path.join(process.resourcesPath, 'icons/icon.ico');
        if (fs.existsSync(devIco)) return devIco;
        if (fs.existsSync(prodIco)) return prodIco;
        const devFallback = path.join(__dirname, '../../icon.ico');
        const prodFallback = path.join(process.resourcesPath, 'icon.ico');
        if (fs.existsSync(devFallback)) return devFallback;
        return prodFallback;
    }
};

ctx.settings = { ...ctx.defaultSettings };

module.exports = ctx;

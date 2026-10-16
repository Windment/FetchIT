const { ipcRenderer, clipboard } = require('electron');

window.addEventListener('error', (event) => {
    try {
        ipcRenderer.send('renderer-log', {
            level: 'error',
            module: 'renderer',
            args: ['未捕获异常：', event.message, '@', event.filename, ':', event.lineno]
        });
    } catch (e) {}
});
window.addEventListener('unhandledrejection', (event) => {
    try {
        ipcRenderer.send('renderer-log', {
            level: 'error',
            module: 'renderer',
            args: ['未处理的 Promise 拒绝：', String(event.reason)]
        });
    } catch (e) {}
});

let notificationDuration = 3000;
let systemNotificationOnComplete = true;
let systemNotificationScope = 'all';
let rememberCookie = true;
let rememberUserAgent = true;
let hasTasks = false;
let currentMode = 'normal';

const notification = document.getElementById('notification');

function escapeHTML(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function extractLinks(text) {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const links = [];
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
        links.push(match[0]);
    }

    return links;
}

function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = 'notification ' + type;
    notification.classList.add('show');

    if (notification._timeout) {
        clearTimeout(notification._timeout);
    }

    notification._timeout = setTimeout(() => {
        notification.classList.remove('show');
        notification._timeout = null;
    }, notificationDuration);
}

ipcRenderer.on('settings-data', (event, settings) => {
    if (settings.notificationDuration) {
        notificationDuration = settings.notificationDuration * 1000;
    }
    if (settings.systemNotificationOnComplete !== undefined) {
        systemNotificationOnComplete = settings.systemNotificationOnComplete;
    }
    if (settings.systemNotificationScope) {
        systemNotificationScope = settings.systemNotificationScope;
    }
    if (settings.rememberCookie !== undefined) {
        rememberCookie = settings.rememberCookie;
    }
    if (settings.rememberUserAgent !== undefined) {
        rememberUserAgent = settings.rememberUserAgent;
    }
});

ipcRenderer.on('notification-duration-updated', (event, duration) => {
    notificationDuration = duration * 1000;
});

ipcRenderer.on('system-notification-updated', (event, flags) => {
    systemNotificationOnComplete = flags.onComplete !== false;
    systemNotificationScope = flags.scope || 'all';
});

ipcRenderer.on('remember-settings-updated', (event, data) => {
    rememberCookie = data.rememberCookie;
    rememberUserAgent = data.rememberUserAgent;
});

ipcRenderer.send('get-settings');

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

const overlayBlurSelectors = [
    '.confirm-modal',
    '.cookie-select-modal',
    '.cookie-manager-modal',
    '.error-panel',
    '.help-modal',
    '.about-modal',
    '.playlist-select-modal',
    '.selection-dialog',
    '.close-choice-modal'
];

const overlayBlurElements = overlayBlurSelectors
    .map((sel) => document.querySelector(sel))
    .filter(Boolean);

function updateOverlayBlur() {
    const anyOpen = overlayBlurElements.some((el) => el.classList.contains('show'));
    document.body.classList.toggle('overlay-open', anyOpen);
}

const overlayBlurObserver = new MutationObserver(updateOverlayBlur);
overlayBlurElements.forEach((el) => {
    overlayBlurObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
});
updateOverlayBlur();

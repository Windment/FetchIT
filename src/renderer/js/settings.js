const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const browsePathBtn = document.getElementById('browsePathBtn');
const cookiePoolPath = document.getElementById('cookiePoolPath');
const browseCookiePoolBtn = document.getElementById('browseCookiePoolBtn');
const themeDarkBtn = document.getElementById('themeDarkBtn');
const themeLightBtn = document.getElementById('themeLightBtn');
const customColorPicker = document.getElementById('customColorPicker');
const importBackgroundBtn = document.getElementById('importBackgroundBtn');
const backgroundPreview = document.getElementById('backgroundPreview');
const backgroundPreviewImg = document.getElementById('backgroundPreviewImg');
const removeBackgroundBtn = document.getElementById('removeBackgroundBtn');
const backgroundBlur = document.getElementById('backgroundBlur');

const savePath = document.getElementById('savePath');
const maxConcurrentTasks = document.getElementById('maxConcurrentTasks');
const concurrency = document.getElementById('concurrency');
const progressFreezeRetryEnabled = document.getElementById('progressFreezeRetryEnabled');
const progressFreezeRetryValue = document.getElementById('progressFreezeRetryValue');
const requestIntervalValue = document.getElementById('requestIntervalValue');
const retries = document.getElementById('retries');
const bufferSize = document.getElementById('bufferSize');
const rateLimitEnabled = document.getElementById('rateLimitEnabled');
const rateLimitValue = document.getElementById('rateLimitValue');
const proxyEnabled = document.getElementById('proxyEnabled');
const proxyValue = document.getElementById('proxyValue');
const notificationDurationInput = document.getElementById('notificationDuration');
const denoRuntimeEnabled = document.getElementById('denoRuntimeEnabled');
const systemNotificationToggle = document.getElementById('systemNotificationOnComplete');
const rememberCookieToggle = document.getElementById('rememberCookie');
const rememberUserAgentToggle = document.getElementById('rememberUserAgent');
const openOutputOnCloseToggle = document.getElementById('openOutputOnClose');
const closeBehaviorTrigger = document.getElementById('closeBehaviorTrigger');
const closeBehaviorTriggerValue = document.getElementById('closeBehaviorTriggerValue');
const closeBehaviorPanel = document.getElementById('closeBehaviorPanel');
const closeBehaviorBackBtn = document.getElementById('closeBehaviorBackBtn');
const colorOptionBtns = document.querySelectorAll('.color-option');
const numberUpBtns = document.querySelectorAll('.number-up');
const numberDownBtns = document.querySelectorAll('.number-down');

const ipVersionTrigger = document.getElementById('ipVersionTrigger');
const ipVersionTriggerValue = document.getElementById('ipVersionTriggerValue');
const ipVersionPanel = document.getElementById('ipVersionPanel');
const ipVersionBackBtn = document.getElementById('ipVersionBackBtn');

let currentIpVersion = 'default';
let currentCloseBehavior = 'quit';

let currentTheme = 'dark';
let currentPrimaryColor = '#0078d4';
let currentBackgroundImage = '';
let currentBackgroundBlur = 10;

function pathToFileUrl(p) {
    return 'file:///' + encodeURI(p.replace(/\\/g, '/'));
}

function applyBackgroundBlur(value) {
    currentBackgroundBlur = Math.max(0, Math.min(40, parseInt(value) || 0));
    backgroundBlur.value = currentBackgroundBlur;
    document.documentElement.style.setProperty('--glass-blur', currentBackgroundBlur + 'px');
}

function applyBackgroundImage(imagePath) {
    currentBackgroundImage = imagePath || '';
    const body = document.body;
    if (currentBackgroundImage) {
        const url = pathToFileUrl(currentBackgroundImage);
        body.style.setProperty('--glass-bg-image', 'url("' + url + '")');
        body.classList.add('liquid-glass');
        backgroundPreviewImg.src = url;
        backgroundPreview.classList.add('show');
        removeBackgroundBtn.classList.add('show');
    } else {
        body.style.removeProperty('--glass-bg-image');
        body.classList.remove('liquid-glass');
        backgroundPreviewImg.removeAttribute('src');
        backgroundPreview.classList.remove('show');
        removeBackgroundBtn.classList.remove('show');
    }
}

function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    
    if (theme === 'dark') {
        themeDarkBtn.classList.add('active');
        themeLightBtn.classList.remove('active');
    } else {
        themeLightBtn.classList.add('active');
        themeDarkBtn.classList.remove('active');
    }
}

themeDarkBtn.addEventListener('click', () => {
    applyTheme('dark');
});

themeLightBtn.addEventListener('click', () => {
    applyTheme('light');
});

function applyPrimaryColor(color) {
    currentPrimaryColor = color;
    document.documentElement.style.setProperty('--primary-color', color);

    const hoverColor = adjustColorBrightness(color, -20);
    document.documentElement.style.setProperty('--primary-hover', hoverColor);

    const activeColor = adjustColorBrightness(color, -40);
    document.documentElement.style.setProperty('--primary-active', activeColor);

    const lightColor = hexToRgba(color, 0.2);
    document.documentElement.style.setProperty('--primary-light', lightColor);

    const lighterColor = hexToRgba(color, 0.08);
    document.documentElement.style.setProperty('--primary-lighter', lighterColor);

    document.documentElement.style.setProperty('--on-primary', getOnColor(color));
    document.documentElement.style.setProperty('--shadow-primary', `0 1px 3px ${hexToRgba(color, 0.32)}`);

    customColorPicker.value = color;

    document.querySelectorAll('.color-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.color === color) {
            btn.classList.add('active');
        }
    });
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getOnColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1d1b20' : '#ffffff';
}

function adjustColorBrightness(hex, amount) {
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

colorOptionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        applyPrimaryColor(color);
    });
});

customColorPicker.addEventListener('input', (e) => {
    applyPrimaryColor(e.target.value);
});

importBackgroundBtn.addEventListener('click', () => {
    ipcRenderer.send('select-background-image');
});

removeBackgroundBtn.addEventListener('click', () => {
    applyBackgroundImage('');
    ipcRenderer.send('remove-background-image');
});

backgroundBlur.addEventListener('input', () => {
    applyBackgroundBlur(backgroundBlur.value);
});

ipcRenderer.on('background-image-selected', (event, path) => {
    if (path) {
        applyBackgroundImage(path);
        showNotification('背景图已导入');
    } else {
        showNotification('导入背景图失败', 'error');
    }
});

saveSettingsBtn.addEventListener('click', () => {
    const settings = {
        savePath: savePath.value,
        cookiePool: cookiePoolPath.value,
        maxConcurrentTasks: parseInt(maxConcurrentTasks.value),
        concurrency: parseInt(concurrency.value),
        forceIpv4: currentIpVersion,
        progressFreezeRetry: {
            enabled: progressFreezeRetryEnabled.checked,
            value: parseInt(progressFreezeRetryValue.value) || 180
        },
        requestInterval: parseFloat(requestIntervalValue.value) || 0,
        retries: parseInt(retries.value) || 5,
        bufferSize: parseInt(bufferSize.value) || 1024,
        rateLimit: {
            enabled: rateLimitEnabled.checked,
            value: rateLimitValue.value
        },
        proxy: {
            enabled: proxyEnabled.checked,
            value: proxyValue.value
        },
        theme: currentTheme,
        primaryColor: currentPrimaryColor,
        backgroundImage: currentBackgroundImage,
        backgroundBlur: currentBackgroundBlur,
        notificationDuration: parseInt(notificationDurationInput.value) || 3,
        denoRuntimeEnabled: denoRuntimeEnabled.checked,
        systemNotificationOnComplete: systemNotificationToggle.checked,
        rememberCookie: rememberCookieToggle.checked,
        rememberUserAgent: rememberUserAgentToggle.checked,
        closeBehavior: currentCloseBehavior,
        openOutputOnClose: openOutputOnCloseToggle.checked
    };

    ipcRenderer.send('save-settings', settings);
});

let resetPending = false;
let resetRestoreTimer = null;

saveSettingsBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (resetRestoreTimer) {
        clearTimeout(resetRestoreTimer);
    }
    if (!resetPending) {
        resetPending = true;
        saveSettingsBtn.classList.add('reset-pending');
        saveSettingsBtn.textContent = '再次右键以初始化设置';
        resetRestoreTimer = setTimeout(() => {
            resetPending = false;
            saveSettingsBtn.classList.remove('reset-pending');
            saveSettingsBtn.textContent = '保存';
            resetRestoreTimer = null;
        }, 3000);
    } else {
        resetPending = false;
        if (resetRestoreTimer) {
            clearTimeout(resetRestoreTimer);
            resetRestoreTimer = null;
        }
        saveSettingsBtn.classList.remove('reset-pending');
        saveSettingsBtn.textContent = '保存';
        ipcRenderer.send('reset-settings');
    }
});

browsePathBtn.addEventListener('click', () => {
    ipcRenderer.send('select-save-path');
});

browseCookiePoolBtn.addEventListener('click', () => {
    ipcRenderer.send('select-cookie-pool');
});

ipcRenderer.on('cookie-pool-changed', (event, newPath) => {
    cookiePoolPath.value = newPath;
});

function updateInputStates() {
    rateLimitValue.disabled = !rateLimitEnabled.checked;
    proxyValue.disabled = !proxyEnabled.checked;
    progressFreezeRetryValue.disabled = !progressFreezeRetryEnabled.checked;
}

rateLimitEnabled.addEventListener('change', updateInputStates);
proxyEnabled.addEventListener('change', updateInputStates);
progressFreezeRetryEnabled.addEventListener('change', updateInputStates);

function showSettingPanel(panel) {
    ipVersionPanel.classList.remove('show');
    panel.classList.add('show');
}

function hideSettingPanel(panel) {
    panel.classList.remove('show');
}

function setIpVersion(value) {
    currentIpVersion = value;
    document.querySelectorAll('#ipVersionPanel .codec-option input[type="checkbox"]').forEach(cb => {
        const checked = cb.value === value;
        cb.checked = checked;
        if (checked) {
            ipVersionTriggerValue.textContent = cb.dataset.label;
        }
    });
}

ipVersionTrigger.addEventListener('click', () => showSettingPanel(ipVersionPanel));

ipVersionBackBtn.addEventListener('click', () => hideSettingPanel(ipVersionPanel));

document.querySelectorAll('#ipVersionPanel .codec-option input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
        if (cb.checked) {
            document.querySelectorAll('#ipVersionPanel .codec-option input[type="checkbox"]').forEach(other => {
                if (other !== cb) other.checked = false;
            });
            currentIpVersion = cb.value;
            ipVersionTriggerValue.textContent = cb.dataset.label;
        } else {
            cb.checked = true;
        }
    });
});

function setCloseBehavior(value) {
    currentCloseBehavior = value;
    document.querySelectorAll('#closeBehaviorPanel .codec-option input[type="checkbox"]').forEach(cb => {
        const checked = cb.value === value;
        cb.checked = checked;
        if (checked) {
            closeBehaviorTriggerValue.textContent = cb.dataset.label;
        }
    });
}

closeBehaviorTrigger.addEventListener('click', () => showSettingPanel(closeBehaviorPanel));
closeBehaviorBackBtn.addEventListener('click', () => hideSettingPanel(closeBehaviorPanel));

document.querySelectorAll('#closeBehaviorPanel .codec-option input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
        if (cb.checked) {
            document.querySelectorAll('#closeBehaviorPanel .codec-option input[type="checkbox"]').forEach(other => {
                if (other !== cb) other.checked = false;
            });
            currentCloseBehavior = cb.value;
            closeBehaviorTriggerValue.textContent = cb.dataset.label;
        } else {
            cb.checked = true;
        }
    });
});

ipcRenderer.on('settings-data', (event, settings) => {
    savePath.value = settings.savePath;
    cookiePoolPath.value = settings.cookiePool || '';
    maxConcurrentTasks.value = settings.maxConcurrentTasks;
    concurrency.value = settings.concurrency;
    progressFreezeRetryEnabled.checked = settings.progressFreezeRetry?.enabled || false;
    progressFreezeRetryValue.value = settings.progressFreezeRetry?.value || 180;
    requestIntervalValue.value = settings.requestInterval || 0.5;
    retries.value = settings.retries || 5;
    bufferSize.value = settings.bufferSize || 1024;
    rateLimitEnabled.checked = settings.rateLimit.enabled;
    rateLimitValue.value = settings.rateLimit.value;
    proxyEnabled.checked = settings.proxy.enabled;
    proxyValue.value = settings.proxy.value;

    if (settings.theme) {
        applyTheme(settings.theme);
    } else {
        applyTheme('dark');
    }

    if (settings.primaryColor) {
        applyPrimaryColor(settings.primaryColor);
    } else {
        applyPrimaryColor('#0078d4');
    }

    applyBackgroundImage(settings.backgroundImage || '');
    applyBackgroundBlur(settings.backgroundBlur != null ? settings.backgroundBlur : 10);

    if (settings.notificationDuration) {
        notificationDurationInput.value = settings.notificationDuration;
    } else {
        notificationDurationInput.value = 3;
    }

    const iv = settings.forceIpv4 || 'default';
    setIpVersion(iv);

    if (settings.denoRuntimeEnabled !== undefined) {
        denoRuntimeEnabled.checked = settings.denoRuntimeEnabled;
    } else {
        denoRuntimeEnabled.checked = true;
    }

    if (settings.systemNotificationOnComplete !== undefined) {
        systemNotificationToggle.checked = settings.systemNotificationOnComplete;
    } else {
        systemNotificationToggle.checked = true;
    }

    if (settings.rememberCookie !== undefined) {
        rememberCookieToggle.checked = settings.rememberCookie;
    } else {
        rememberCookieToggle.checked = true;
    }

    if (settings.rememberUserAgent !== undefined) {
        rememberUserAgentToggle.checked = settings.rememberUserAgent;
    } else {
        rememberUserAgentToggle.checked = true;
    }

    if (settings.closeBehavior) {
        setCloseBehavior(settings.closeBehavior);
    } else {
        setCloseBehavior('quit');
    }

    openOutputOnCloseToggle.checked = !!settings.openOutputOnClose;

    updateInputStates();
});

ipcRenderer.on('save-path-selected', (event, path) => {
    savePath.value = path;
});

ipcRenderer.on('settings-saved', () => {
    showNotification('设置已保存');
    settingsModal.classList.remove('show');
    document.getElementById('settingsModalOverlay').classList.remove('show');
});

numberUpBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const step = parseFloat(btn.dataset.step) || 1;
        const input = document.getElementById(targetId);
        const max = parseFloat(input.max);
        const currentValue = parseFloat(input.value) || 0;
        const newValue = currentValue + step;
        
        if (isNaN(max) || newValue <= max) {
            input.value = newValue;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
});

numberDownBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const step = parseFloat(btn.dataset.step) || 1;
        const input = document.getElementById(targetId);
        const min = parseFloat(input.min);
        const currentValue = parseFloat(input.value) || 0;
        const newValue = currentValue - step;
        
        if (isNaN(min) || newValue >= min) {
            input.value = newValue;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
});

setTimeout(() => {
    ipcRenderer.send('get-settings');
}, 100);

const exportSettingsBtn = document.getElementById('exportSettingsBtn');
const importSettingsBtn = document.getElementById('importSettingsBtn');
const confirmModal = document.getElementById('confirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalMessage = document.getElementById('confirmModalMessage');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmOkBtn = document.getElementById('confirmOkBtn');

let confirmCallback = null;

function showConfirmModal(title, message, callback) {
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmCallback = callback;
    confirmModal.classList.add('show');
}

function hideConfirmModal() {
    confirmModal.classList.remove('show');
    confirmCallback = null;
}

confirmCancelBtn.addEventListener('click', hideConfirmModal);
confirmOkBtn.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
    }
    hideConfirmModal();
});
confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        hideConfirmModal();
    }
});

exportSettingsBtn.addEventListener('click', () => {
    ipcRenderer.send('export-settings');
});

importSettingsBtn.addEventListener('click', () => {
    ipcRenderer.send('import-settings');
});

ipcRenderer.on('settings-exported', (event, success) => {
    if (success) {
        showNotification('设置已导出', 'success');
    } else {
        showNotification('导出设置失败', 'error');
    }
});

ipcRenderer.on('settings-imported', (event, importedSettings) => {
    if (importedSettings) {
        showConfirmModal('导入设置', '导入的设置将覆盖当前设置，是否继续？', () => {
            ipcRenderer.send('apply-imported-settings', importedSettings);
        });
    } else {
        showNotification('导入设置失败，请检查文件格式', 'error');
    }
});

ipcRenderer.on('settings-applied', () => {
    showNotification('设置已导入', 'success');
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.json')) {
            ipcRenderer.send('import-settings-from-path', file.path);
        }
    }
});

const helpModal = document.getElementById('helpModal');
const helpModalTitle = document.getElementById('helpModalTitle');
const helpModalBody = document.getElementById('helpModalBody');
const helpModalClose = document.getElementById('helpModalClose');

//所有的功能帮助信息
const helpContent = {
    savePath: {
        title: '保存位置',
        content: '<p>设置下载文件的默认保存路径。所有下载的文件都会保存到这个目录中。</p><p>点击"浏览"按钮可以选择文件夹。</p>'
    },
    maxConcurrentTasks: {
        title: '任务并行数',
        content: '<p>同时进行的下载任务数量。增加此值可以同时下载更多视频，但会增加系统资源占用。</p><p>建议值：3-5</p>'
    },
    concurrency: {
        title: '并发数',
        content: '<p>单个下载任务的最大并发连接数。增加此值可以提高下载速度，但更高的值可能会触发服务器监控机制。</p><p>该配置选项不会影响"直链下载"模式。</p><p>建议值：8-16</p>'
    },
    forceIpv4: {
        title: 'IPV4/IPV6',
        content: '<p>设置网络连接时使用的IP版本。</p><p><strong>默认：</strong>系统自动选择<br><strong>强制IPV4：</strong>只使用IPv4地址<br><strong>强制IPV6：</strong>只使用IPv6地址</p><p>如果遇到连接问题，可以尝试切换IP版本。</p>'
    },
    progressFreezeRetry: {
        title: '进度冻结重试',
        content: '<p>当下载进度在设定时间内没有变化时，自动中断并重试下载。</p><p>适用于下载大文件时可能出现的进度卡住问题。</p><p>默认关闭。开启后默认冻结时间为180秒，可设置范围：10-3600秒</p>'
    },
    requestInterval: {
        title: '请求间隔',
        content: '<p>连续请求之间的等待时间（秒）。增加此值可以避免被服务器监控机制检测。</p><p>建议值：0.5-2秒</p>'
    },
    retries: {
        title: '重试次数',
        content: '<p>下载失败时的重试次数。当下载失败时，会自动重试指定次数。</p><p>默认值：5，最小值：0</p>'
    },
    bufferSize: {
        title: '缓冲区',
        content: '<p>下载缓冲区大小（KB）。增加此值可以提高下载性能，但会增加内存占用。</p><p>默认值：1024 KB，最小值：0</p>'
    },
    rateLimit: {
        title: '限速',
        content: '<p>限制下载速度。格式：<code>50K</code>、<code>1M</code> 等。</p><p>示例：<code>50K</code> 表示50KB/s，<code>1M</code> 表示1MB/s</p>'
    },
    proxy: {
        title: '代理',
        content: '<p>通过代理服务器进行下载。支持HTTP/HTTPS/SOCKS代理。</p><p>示例：<br><code>http://127.0.0.1:8080</code><br><code>socks5://127.0.0.1:1080</code></p>'
    },
    theme: {
        title: '主题',
        content: '<p>选择应用的外观主题。</p><p><strong>深色</strong>：默认且为深色。<br><strong>浅色</strong>：稍微亮亿点点</p>'
    },
    primaryColor: {
        title: '主题色',
        content: '<p>可以选择预设颜色或使用取色器自定义。</p><p>主题色会影响按钮、进度条等元素的显示。</p>'
    },
    backgroundImage: {
        title: '背景图',
        content: '<p>导入一张背景图片后，应用整体将切换为液态玻璃UI。</p><p>支持 PNG、JPG、WebP 等常见图片格式，导入的图片会被复制到应用目录中保存。</p>'
    },
    backgroundBlur: {
        title: '模糊程度',
        content: '<p>调整液态玻璃UI的模糊强度。</p><p>数值越大，玻璃表面越模糊，背景越柔和。范围：0-40，默认：10。</p>'
    },
    notificationDuration: {
        title: '通知显示时长',
        content: '<p>设置通知消息的显示时间（秒）。</p><p>范围：1-10秒，默认：3秒</p>'
    },
    playlistItems: {
        title: '筛选',
        content: '<p>指定要下载的播放列表项目。可以下载列表中的特定视频。</p><p>格式说明：<br><code>1</code> - 下载第1个视频<br><code>1,3,5</code> - 下载第1、3、5个视频<br><code>1-5</code> - 下载第1到第5个视频<br><code>1,3,5-10</code> - 组合使用</p><p>留空则下载整个播放列表。</p>'
    },
    outputDefault: {
        title: '默认输出',
        content: '<p>选择"默认"时，将保持原始格式输出，不再强制格式转换或编码(无视视频编码偏好以及输出格式偏好)，这可能会使任务速度更快。</p><p>选择默认时有时候可能会得到webm等不常用格式或者遇到<strong> 播放器不支持文件的编码的问题 </strong>(例如Windows10的默认播放器无法播放b站的h265编码的视频)。</p>'
    },
    denoRuntimeEnabled: {
        title: 'Deno运行时',
        content: '<p>是否启用Deno运行时。Deno运行时也许可以解决有时候Youtube下载抽风的问题</p><p>默认启用</p>'
    },
    systemNotificationOnComplete: {
        title: '完成时系统通知',
        content: '<p>开启后，每当有任务完成时，将通过Windows系统通知中心推送通知。</p><p>关闭后仅显示应用内的通知。</p><p>可能会因为权限问题无法通知。</p>'
    },
    cookiePool: {
        title: 'Cookie池',
        content: '<p>用于统一存放 Cookie txt 文件的目录，默认是系统文档文件夹下的 Mycookies。</p><p>在 Cookie 管理中导入的 Cookie 会复制到这里，您也可以在设置中切换到其他目录。</p><p>更换目录后，旧目录中的文件不会自动移动，需要时请手动处理。</p>'
    },
    rememberCookie: {
        title: '记住Cookie',
        content: '<p>开启后，当您在高级选项中选择了Cookie文件后，下次启动应用将自动回填该路径。</p><p>如果该Cookie是Cookie池中的一项，下次优先以名称恢复。</p><p>关闭后则不记忆，每次需要重新选择。启动时若记住的Cookie文件已不存在，将提示您重新配置。</p>'
    },
    rememberUserAgent: {
        title: '记住User-Agent',
        content: '<p>开启后，当您在高级选项中配置了User-Agent后，下次启动应用将自动回填该值。</p><p>关闭后则不记忆，每次需要重新输入。</p>'
    },
    closeBehavior: {
        title: '关闭时行为',
        content: '<p>选择点击右上角关闭按钮时的行为。</p><p><strong>最小化到系统托盘</strong>：窗口将隐藏到任务栏通知区域，单击托盘图标或菜单可恢复窗口；右键托盘图标可直接打开输出文件夹或彻底退出。</p><p><strong>关闭FetchIT（默认）</strong>：直接退出应用。</p>'
    },
    openOutputOnClose: {
        title: '关闭时同时打开输出位置',
        content: '<p>开启后，点击关闭按钮执行关闭或托盘最小化的同时，将自动打开当前配置的输出文件夹。</p><p>关闭后则仅执行关闭行为本身。</p>'
    }
};

document.querySelectorAll('.help-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const helpKey = btn.dataset.help;
        const content = helpContent[helpKey];
        
        if (content) {
            helpModalTitle.textContent = content.title;
            helpModalBody.innerHTML = content.content;
            helpModal.classList.add('show');
        }
    });
});

helpModalClose.addEventListener('click', () => {
    helpModal.classList.remove('show');
});

helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
        helpModal.classList.remove('show');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal.classList.contains('show')) {
        helpModal.classList.remove('show');
    }
});
let currentCookieName = '';
let pendingImportPath = '';
let pendingImportMode = '';
let currentCookiePoolPath = '';
let pendingRenameName = '';
let pendingImportFormat = 'general';

const advancedBtn = document.getElementById('advancedBtn');
const closeAdvancedBtn = document.getElementById('closeAdvancedBtn');
const advancedOptions = document.getElementById('advancedOptions');
const advancedCookiesEnabled = document.getElementById('advancedCookiesEnabled');
const advancedCookiesTrigger = document.getElementById('advancedCookiesTrigger');
const advancedCookiesTriggerValue = document.getElementById('advancedCookiesTriggerValue');
const advancedCookiesPath = document.getElementById('advancedCookiesPath');
const cookieSelectionGrid = document.getElementById('cookieSelectionListArea');

const cookiePreviewModalOverlay = document.getElementById('cookiePreviewModalOverlay');
const cookiePreviewModal = document.getElementById('cookiePreviewModal');
const cookiePreviewModalClose = document.getElementById('cookiePreviewModalClose');
const cookiePreviewModalTitle = document.getElementById('cookiePreviewModalTitle');
const cookiePreviewModalSuffix = document.getElementById('cookiePreviewModalSuffix');
const cookiePreviewModalPre = document.getElementById('cookiePreviewModalPre');

const cookieSelectModalOverlay = document.getElementById('cookieSelectModalOverlay');
const cookieSelectModal = document.getElementById('cookieSelectModal');
const cookieSelectModalClose = document.getElementById('cookieSelectModalClose');
const cookieSelectNoneBtn = document.getElementById('cookieSelectNoneBtn');

const cookieManagerBtn = document.getElementById('cookieManagerBtn');
const cookieManagerModal = document.getElementById('cookieManagerModal');
const cookieManagerOverlay = document.getElementById('cookieManagerOverlay');
const cookieManagerClose = document.getElementById('cookieManagerCloseBtn');
const addCookieBtn = document.getElementById('addCookieBtn');
const cookieListArea = document.getElementById('cookieListArea');

const cookieNameOverlay = document.getElementById('cookieNameOverlay');
const cookieNameModal = document.getElementById('cookieNameModal');
const cookieNameInput = document.getElementById('cookieNameInput');
const cookieContentInput = document.getElementById('cookieContentInput');
const cookieNameCancel = document.getElementById('cookieNameCancelBtn');
const cookieNameConfirm = document.getElementById('cookieNameConfirmBtn');
const cookieNameError = document.getElementById('cookieNameError');
const cookieNameHeader = document.getElementById('cookieNameHeader');
const cookieFormatOptions = Array.from(document.querySelectorAll('.cookie-format-option'));

const cookieMethodOverlay = document.getElementById('cookieMethodOverlay');
const cookieMethodModal = document.getElementById('cookieMethodModal');
const cookieMethodFileBtn = document.getElementById('cookieMethodFileBtn');
const cookieMethodTextBtn = document.getElementById('cookieMethodTextBtn');
const cookieMethodCancelBtn = document.getElementById('cookieMethodCancelBtn');
const extractCookieBtn = document.getElementById('extractCookieBtn');

const cookieExtractOverlay = document.getElementById('cookieExtractOverlay');
const cookieExtractModal = document.getElementById('cookieExtractModal');
const cookieExtractUrlInput = document.getElementById('cookieExtractUrlInput');
const cookieExtractError = document.getElementById('cookieExtractError');
const cookieExtractCancelBtn = document.getElementById('cookieExtractCancelBtn');
const cookieExtractConfirmBtn = document.getElementById('cookieExtractConfirmBtn');

const cookieRenameOverlay = document.getElementById('cookieRenameOverlay');
const cookieRenameModal = document.getElementById('cookieRenameModal');
const cookieRenameInput = document.getElementById('cookieRenameInput');
const cookieRenameError = document.getElementById('cookieRenameError');
const cookieRenameCancelBtn = document.getElementById('cookieRenameCancelBtn');
const cookieRenameConfirmBtn = document.getElementById('cookieRenameConfirmBtn');

const advancedUserAgentEnabled = document.getElementById('advancedUserAgentEnabled');
const advancedUserAgentValue = document.getElementById('advancedUserAgentValue');

function openCookieManager() {
    cookieManagerModal.classList.add('show');
    cookieManagerOverlay.classList.add('show');
    ipcRenderer.send('list-cookies');
}

function closeCookieManager() {
    cookieManagerModal.classList.remove('show');
    cookieManagerOverlay.classList.remove('show');
}

if (cookieManagerBtn) cookieManagerBtn.addEventListener('click', openCookieManager);
if (cookieManagerClose) cookieManagerClose.addEventListener('click', closeCookieManager);
if (cookieManagerOverlay) cookieManagerOverlay.addEventListener('click', closeCookieManager);

function openCookiePreview(name, content, title) {
    if (!cookiePreviewModal) return;
    const baseTitle = title ? `${title} - Cookie 预览` : 'Cookie 预览';
    if (cookiePreviewModalTitle) {
        cookiePreviewModalTitle.childNodes.forEach((n, idx) => {
            if (idx === 0 && n.nodeType === 3) n.nodeValue = baseTitle;
        });
        if (cookiePreviewModalSuffix) {
            cookiePreviewModalSuffix.textContent = name ? ` — ${name}` : '';
        }
    }
    if (cookiePreviewModalPre) {
        cookiePreviewModalPre.textContent = (typeof content === 'string' ? content : '') || '';
        cookiePreviewModalPre.scrollTop = 0;
    }
    cookiePreviewModal.classList.add('show');
    if (cookiePreviewModalOverlay) cookiePreviewModalOverlay.classList.add('show');
}

function closeCookiePreview() {
    if (cookiePreviewModal) cookiePreviewModal.classList.remove('show');
    if (cookiePreviewModalOverlay) cookiePreviewModalOverlay.classList.remove('show');
}

if (cookiePreviewModalClose) cookiePreviewModalClose.addEventListener('click', closeCookiePreview);
if (cookiePreviewModalOverlay) cookiePreviewModalOverlay.addEventListener('click', closeCookiePreview);

function openCookieSelectModal() {
    if (!cookieSelectModal) return;
    cookieSelectModal.classList.add('show');
    if (cookieSelectModalOverlay) cookieSelectModalOverlay.classList.add('show');
    ipcRenderer.send('list-cookies');
}

function closeCookieSelectModal() {
    if (cookieSelectModal) cookieSelectModal.classList.remove('show');
    if (cookieSelectModalOverlay) cookieSelectModalOverlay.classList.remove('show');
}

if (cookieSelectModalClose) cookieSelectModalClose.addEventListener('click', closeCookieSelectModal);
if (cookieSelectModalOverlay) cookieSelectModalOverlay.addEventListener('click', closeCookieSelectModal);

function openCookieMethodModal() {
    if (!cookieMethodModal) return;
    cookieMethodModal.classList.add('show');
    if (cookieMethodOverlay) cookieMethodOverlay.classList.add('show');
}

function closeCookieMethodModal() {
    if (cookieMethodModal) cookieMethodModal.classList.remove('show');
    if (cookieMethodOverlay) cookieMethodOverlay.classList.remove('show');
}

function serializeCookiesToNetscape(cookies) {
    const recognition = recognizeCookiePlatform(cookies);
    const platform = recognition && recognition.platform;
    const lines = ['# Netscape HTTP Cookie File'];
    (cookies || []).forEach((c) => {
        const domain = resolveCookieDomain(c, platform, '');
        const includeSub = domain.startsWith('.');
        const flag = includeSub ? 'TRUE' : 'FALSE';
        const secure = c.secure ? 'TRUE' : 'FALSE';
        const expires = c.expires ? Math.floor(Number(c.expires) || 0) : 0;
        const prefix = c.httpOnly ? '#HttpOnly_' : '';
        lines.push(prefix + domain + '\t' + flag + '\t' + (c.path || '/') + '\t' + secure + '\t' + expires + '\t' + (c.name || '') + '\t' + (c.value == null ? '' : c.value));
    });
    return lines.join('\n') + '\n';
}

function convertCookieContent(content, format) {
    const text = String(content == null ? '' : content);
    if (format === 'netscape') return text;
    const result = parseCookieText(text);
    const cookies = result && result.ok && result.cookies && result.cookies.length ? result.cookies : null;
    if (!cookies) return null;
    return serializeCookiesToNetscape(cookies);
}

function setPendingImportFormat(format) {
    pendingImportFormat = format;
    cookieFormatOptions.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.format === format);
    });
}

cookieFormatOptions.forEach((btn) => {
    btn.addEventListener('click', () => setPendingImportFormat(btn.dataset.format));
});

function openNameModal(mode) {
    pendingImportMode = mode;
    pendingImportPath = '';
    setPendingImportFormat('netscape');
    cookieNameInput.value = '';
    cookieNameError.textContent = '';
    if (cookieContentInput) cookieContentInput.value = '';

    if (mode === 'text') {
        if (cookieContentInput) cookieContentInput.style.display = '';
        if (cookieNameHeader) cookieNameHeader.textContent = '手动输入 Cookie';
    } else {
        if (cookieContentInput) cookieContentInput.style.display = 'none';
        if (cookieNameHeader) cookieNameHeader.textContent = '为Cookie命名';
    }

    cookieNameModal.classList.add('show');
    cookieNameOverlay.classList.add('show');

    if (mode === 'text') {
        setTimeout(() => cookieNameInput.focus(), 50);
    } else {
        ipcRenderer.send('select-cookies-file');
    }
}

if (addCookieBtn) {
    addCookieBtn.addEventListener('click', () => {
        openCookieMethodModal();
    });
}

if (cookieMethodFileBtn) {
    cookieMethodFileBtn.addEventListener('click', () => {
        closeCookieMethodModal();
        openNameModal('file');
    });
}

if (cookieMethodTextBtn) {
    cookieMethodTextBtn.addEventListener('click', () => {
        closeCookieMethodModal();
        openNameModal('text');
    });
}

if (cookieMethodCancelBtn) cookieMethodCancelBtn.addEventListener('click', closeCookieMethodModal);
if (cookieMethodOverlay) cookieMethodOverlay.addEventListener('click', closeCookieMethodModal);

function openCookieExtractModal() {
    if (!cookieExtractModal) return;
    cookieExtractModal.classList.add('show');
    cookieExtractOverlay.classList.add('show');
    cookieExtractUrlInput.value = '';
    cookieExtractError.textContent = '';
    setTimeout(() => cookieExtractUrlInput.focus(), 50);
}

function closeCookieExtractModal() {
    cookieExtractModal.classList.remove('show');
    cookieExtractOverlay.classList.remove('show');
}

function openRenameModal(name) {
    if (!cookieRenameModal) return;
    pendingRenameName = name;
    cookieRenameInput.value = name;
    cookieRenameError.textContent = '';
    cookieRenameModal.classList.add('show');
    cookieRenameOverlay.classList.add('show');
    setTimeout(() => { cookieRenameInput.focus(); cookieRenameInput.select(); }, 50);
}

function closeRenameModal() {
    cookieRenameModal.classList.remove('show');
    cookieRenameOverlay.classList.remove('show');
    pendingRenameName = '';
    cookieRenameError.textContent = '';
}

if (extractCookieBtn) {
    extractCookieBtn.addEventListener('click', openCookieExtractModal);
}

if (cookieExtractCancelBtn) cookieExtractCancelBtn.addEventListener('click', closeCookieExtractModal);
if (cookieExtractOverlay) cookieExtractOverlay.addEventListener('click', closeCookieExtractModal);

if (cookieExtractConfirmBtn) {
    cookieExtractConfirmBtn.addEventListener('click', () => {
        const url = (cookieExtractUrlInput.value || '').trim();
        if (!url) {
            cookieExtractError.textContent = '请输入站点地址';
            return;
        }
        cookieExtractError.textContent = '';
        closeCookieExtractModal();
        ipcRenderer.send('start-cookie-extract', url);
    });
}

ipcRenderer.on('cookie-extract-error', (_e, message) => {
    showNotification(message || '无法打开提取窗口', 'error');
});

if (cookieRenameCancelBtn) cookieRenameCancelBtn.addEventListener('click', closeRenameModal);
if (cookieRenameOverlay) cookieRenameOverlay.addEventListener('click', closeRenameModal);

if (cookieRenameConfirmBtn) {
    cookieRenameConfirmBtn.addEventListener('click', () => {
        const name = (cookieRenameInput.value || '').trim();
        if (!name) {
            cookieRenameError.textContent = '请输入名称';
            return;
        }
        if (!/^[\w\u4e00-\u9fa5.\- ()]+$/.test(name)) {
            cookieRenameError.textContent = '名称仅支持中英文、数字、下划线、点号、短横线、空格和圆括号';
            return;
        }
        cookieRenameError.textContent = '';
        ipcRenderer.send('rename-cookie-file', { oldName: pendingRenameName, newName: name });
    });
}

ipcRenderer.on('rename-cookie-file-result', (_e, result) => {
    if (!result) return;
    if (result.ok) {
        closeRenameModal();
        ipcRenderer.send('list-cookies');
        return;
    }
    switch (result.error) {
        case 'invalid-name':
            cookieRenameError.textContent = '名称不合法（最多 64 字，不可包含 \\ / : * ? " < > |）';
            break;
        case 'exists':
            cookieRenameError.textContent = `Cookie「${result.name || ''}」已存在，请换一个名称`;
            break;
        case 'not-found':
            cookieRenameError.textContent = '原 Cookie 文件不存在';
            break;
        default:
            cookieRenameError.textContent = '重命名失败，请重试';
    }
});

ipcRenderer.on('cookie-import-file-selected', (_e, filePath) => {
    if (!filePath) return;
    pendingImportPath = filePath;
    const path = require('path');
    const base = path.basename(filePath, '.txt');
    cookieNameInput.value = base;
    cookieNameError.textContent = '';
    cookieNameInput.focus();
    cookieNameInput.select();
});

function hideNameModal() {
    cookieNameModal.classList.remove('show');
    cookieNameOverlay.classList.remove('show');
    pendingImportPath = '';
    pendingImportMode = '';
    if (cookieContentInput) cookieContentInput.value = '';
    cookieNameError.textContent = '';
}

if (cookieNameCancel) cookieNameCancel.addEventListener('click', hideNameModal);
if (cookieNameOverlay) cookieNameOverlay.addEventListener('click', hideNameModal);

if (cookieNameConfirm) {
    cookieNameConfirm.addEventListener('click', () => {
        const name = (cookieNameInput.value || '').trim();
        if (!name) {
            cookieNameError.textContent = '请为 Cookie 命名';
            return;
        }
        if (!/^[\w\u4e00-\u9fa5.\- ()]+$/.test(name)) {
            cookieNameError.textContent = '名称仅支持中英文、数字、下划线、点号、短横线、空格和圆括号';
            return;
        }
        cookieNameError.textContent = '';

        if (pendingImportMode === 'text') {
            const content = cookieContentInput ? cookieContentInput.value : '';
            if (!content.trim()) {
                cookieNameError.textContent = '请输入 Cookie 内容';
                return;
            }
            const converted = convertCookieContent(content, pendingImportFormat);
            if (converted == null) {
                cookieNameError.textContent = '无法解析该格式的 Cookie 内容';
                return;
            }
            ipcRenderer.send('add-cookie-text', {
                name: name,
                content: converted
            });
        } else {
            if (!pendingImportPath) {
                cookieNameError.textContent = '尚未选择要导入的 TXT 文件';
                return;
            }
            if (pendingImportFormat === 'netscape') {
                ipcRenderer.send('add-cookie-file', {
                    srcPath: pendingImportPath,
                    name: name
                });
                return;
            }
            let content;
            try {
                const fs = require('fs');
                content = fs.readFileSync(pendingImportPath, 'utf8');
            } catch (_) {
                cookieNameError.textContent = '读取源文件失败';
                return;
            }
            const converted = convertCookieContent(content, pendingImportFormat);
            if (converted == null) {
                cookieNameError.textContent = '无法解析该格式的 Cookie 内容';
                return;
            }
            ipcRenderer.send('add-cookie-text', {
                name: name,
                content: converted
            });
        }
    });
}

ipcRenderer.on('add-cookie-file-result', (_e, result) => {
    if (!result) return;
    if (result.ok) {
        hideNameModal();
        ipcRenderer.send('list-cookies');
        return;
    }
    switch (result.error) {
        case 'invalid-name':
            cookieNameError.textContent = '名称不合法（最多 64 字，不可包含 \\ / : * ? " < > |）';
            break;
        case 'empty-content':
            cookieNameError.textContent = 'Cookie 内容不能为空';
            break;
        case 'src-missing':
            cookieNameError.textContent = '源 TXT 文件不存在，请重新选择';
            break;
        case 'exists':
            cookieNameError.textContent = `Cookie「${result.name || ''}」已存在，请换一个名称`;
            break;
        case 'copy-failed':
            cookieNameError.textContent = '保存到 Cookie 池失败，请检查目录权限或磁盘空间';
            break;
        default:
            cookieNameError.textContent = '导入失败，请重试';
    }
});

ipcRenderer.on('cookies-list-changed', () => {
    ipcRenderer.send('list-cookies');
});

ipcRenderer.on('cookie-pool-path', (_e, poolPath) => {
    currentCookiePoolPath = poolPath;
});

ipcRenderer.on('cookies-list', (_e, list) => {
    renderCookieList(list);
    renderCookieSelectionPanel(list);
});

function renderCookieList(list) {
    if (!cookieListArea) return;
    cookieListArea.innerHTML = '';
    const baseList = list || [];
    if (baseList.length === 0) {
        cookieListArea.innerHTML = `
            <div class="cookie-empty-state">
                <div class="cookie-empty-icon">
                    <svg width="36" height="36" viewBox="0 0 24 24" style="display:block;color:var(--primary-color);"><use href="#icon-cookie"/></svg>
                </div>
                <div class="cookie-empty-title">还没有导入任何 Cookie</div>
                <div class="cookie-empty-hint">点击右上角「添加 Cookie」选择导入方式</div>
            </div>
        `;
        return;
    }
    baseList.forEach(item => {
        const card = document.createElement('div');
        card.className = 'cookie-card';
        card.innerHTML = `
            <button class="cookie-card-rename" title="重命名">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="cookie-card-delete" title="删除">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div class="cookie-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" style="display:block;color:inherit;"><use href="#icon-cookie"/></svg>
            </div>
            <div class="cookie-card-name">${escapeHTML(item.name)}</div>
        `;
        const renameBtn = card.querySelector('.cookie-card-rename');
        if (renameBtn) {
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openRenameModal(item.name);
            });
        }
        const delBtn = card.querySelector('.cookie-card-delete');
        if (delBtn) {
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showConfirmModal(
                    '删除 Cookie',
                    `删除 Cookie「${item.name}」后文件无法恢复，确认要继续吗？`,
                    () => ipcRenderer.send('delete-cookie-file', item.name)
                );
            });
        }
        card.addEventListener('click', (e) => {
            if (e.target.closest('.cookie-card-delete')) return;
            ipcRenderer.once('cookie-content', (_, payload) => {
                if (payload && payload.name === item.name) {
                    openCookiePreview(payload.name, payload.content || '');
                } else if (payload && payload.error) {
                    openCookiePreview(item.name, '【读取失败】文件可能已不存在或无法访问');
                }
            });
            ipcRenderer.send('read-cookie-content', item.name);
        });
        cookieListArea.appendChild(card);
    });
}

function renderCookieSelectionPanel(list) {
    if (!cookieSelectionGrid) return;
    cookieSelectionGrid.innerHTML = '';
    const baseList = list || [];
    if (baseList.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cookie-sel-empty';
        empty.innerHTML = '<div class="cookie-sel-empty-title">Cookie 池为空</div><div class="cookie-sel-empty-hint">先到标题栏「Cookie 管理」中导入 TXT 吧</div>';
        cookieSelectionGrid.appendChild(empty);
        return;
    }
    baseList.forEach(item => {
        const card = document.createElement('div');
        card.className = 'cookie-sel-card' + (item.name === currentCookieName ? ' active' : '');
        card.innerHTML = `
            <div class="cookie-sel-label">${escapeHTML(item.name)}</div>
        `;
        card.addEventListener('click', () => {
            currentCookieName = item.name;
            advancedCookiesEnabled.checked = true;
            if (advancedCookiesPath && currentCookiePoolPath) {
                const path = require('path');
                advancedCookiesPath.value = path.join(currentCookiePoolPath, item.name + '.txt');
            }
            if (cookieSelectionGrid) {
                cookieSelectionGrid.querySelectorAll('.cookie-sel-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            }
            applyCookieTriggerLabel();
            saveAdvancedMemoryCookie();
            updateAdvancedInputStates();
            closeCookieSelectModal();
        });
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            ipcRenderer.once('cookie-content', (_, payload) => {
                if (payload && payload.name === item.name) {
                    openCookiePreview(payload.name, payload.content || '', '选择 Cookie');
                } else if (payload && payload.error) {
                    openCookiePreview(item.name, '【读取失败】文件可能已不存在或无法访问', '选择 Cookie');
                }
            });
            ipcRenderer.send('read-cookie-content', item.name);
        });
        cookieSelectionGrid.appendChild(card);
    });
}

function applyCookieTriggerLabel() {
    if (!advancedCookiesTrigger) return;
    if (!advancedCookiesEnabled.checked || !currentCookieName) {
        advancedCookiesTriggerValue.textContent = '不使用 Cookie';
        return;
    }
    advancedCookiesTriggerValue.textContent = currentCookieName;
}

function hideCookieSelectionPanel() {
    closeCookieSelectModal();
}

if (advancedCookiesTrigger) {
    advancedCookiesTrigger.addEventListener('click', () => {
        openCookieSelectModal();
    });
}

if (cookieSelectNoneBtn) {
    cookieSelectNoneBtn.addEventListener('click', () => {
        currentCookieName = '';
        advancedCookiesEnabled.checked = false;
        if (advancedCookiesPath) advancedCookiesPath.value = '';
        applyCookieTriggerLabel();
        saveAdvancedMemoryCookie();
        updateAdvancedInputStates();
        closeCookieSelectModal();
    });
}

advancedBtn.addEventListener('click', () => {
    advancedOptions.classList.add('show');
});

closeAdvancedBtn.addEventListener('click', () => {
    advancedOptions.classList.remove('show');
});

ipcRenderer.on('cookies-file-selected', (event, path) => {
    advancedCookiesPath.value = path;
    persistAdvancedMemory();
});

function updateAdvancedInputStates() {
    if (advancedCookiesPath) advancedCookiesPath.disabled = !advancedCookiesEnabled.checked;
    if (advancedCookiesTrigger) advancedCookiesTrigger.disabled = !advancedCookiesEnabled.checked;
    if (advancedUserAgentValue) advancedUserAgentValue.disabled = !advancedUserAgentEnabled.checked;
}

function saveAdvancedMemoryCookie() {
    if (!rememberCookie) return;
    if (advancedCookiesEnabled.checked && currentCookieName) {
        ipcRenderer.send('update-advanced-memory', {
            cookieName: currentCookieName,
            cookiePath: ''
        });
    } else if (advancedCookiesEnabled.checked && advancedCookiesPath && advancedCookiesPath.value) {
        ipcRenderer.send('update-advanced-memory', {
            cookieName: '',
            cookiePath: advancedCookiesPath.value
        });
    } else {
        ipcRenderer.send('update-advanced-memory', {
            cookieName: '',
            cookiePath: ''
        });
    }
}

function persistAdvancedMemory() {
    saveAdvancedMemoryCookie();
    if (rememberUserAgent) {
        ipcRenderer.send('update-advanced-memory', {
            userAgent: advancedUserAgentEnabled.checked ? advancedUserAgentValue.value : ''
        });
    }
}

updateAdvancedInputStates();

advancedCookiesEnabled.addEventListener('change', () => {
    updateAdvancedInputStates();
    persistAdvancedMemory();
});

advancedUserAgentEnabled.addEventListener('change', () => {
    updateAdvancedInputStates();
    persistAdvancedMemory();
});

advancedUserAgentValue.addEventListener('change', persistAdvancedMemory);
advancedUserAgentValue.addEventListener('blur', persistAdvancedMemory);

ipcRenderer.on('settings-data', (event, settings) => {
    if (settings.cookiePool) {
        currentCookiePoolPath = settings.cookiePool;
    }
    if (rememberCookie && (settings.lastCookieName || settings.lastCookiePath)) {
        if (settings.lastCookieName) {
            const fs = require('fs');
            const path = require('path');
            const expected = path.join(currentCookiePoolPath || '', settings.lastCookieName + '.txt');
            if (fs.existsSync(expected)) {
                currentCookieName = settings.lastCookieName;
                advancedCookiesEnabled.checked = true;
                if (advancedCookiesPath) advancedCookiesPath.value = expected;
            } else if (settings.lastCookiePath && fs.existsSync(settings.lastCookiePath)) {
                advancedCookiesEnabled.checked = true;
                if (advancedCookiesPath) advancedCookiesPath.value = settings.lastCookiePath;
            }
            applyCookieTriggerLabel();
        } else if (settings.lastCookiePath) {
            const fs = require('fs');
            if (fs.existsSync(settings.lastCookiePath)) {
                advancedCookiesEnabled.checked = true;
                if (advancedCookiesPath) advancedCookiesPath.value = settings.lastCookiePath;
                applyCookieTriggerLabel();
            }
        }
        updateAdvancedInputStates();
    } else {
        applyCookieTriggerLabel();
    }
    if (rememberUserAgent && settings.lastUserAgent) {
        advancedUserAgentEnabled.checked = true;
        advancedUserAgentValue.value = settings.lastUserAgent;
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (cookieNameModal.classList.contains('show')) {
        hideNameModal();
    } else if (cookieExtractModal && cookieExtractModal.classList.contains('show')) {
        closeCookieExtractModal();
    } else if (cookieRenameModal && cookieRenameModal.classList.contains('show')) {
        closeRenameModal();
    } else if (cookieMethodModal && cookieMethodModal.classList.contains('show')) {
        closeCookieMethodModal();
    } else if (cookiePreviewModal.classList.contains('show')) {
        closeCookiePreview();
    } else if (cookieSelectModal.classList.contains('show')) {
        closeCookieSelectModal();
    } else if (cookieManagerModal.classList.contains('show')) {
        closeCookieManager();
    }
});

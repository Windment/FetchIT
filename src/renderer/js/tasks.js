const { clipboard } = require('electron');

let errorCount = 0;
let errorList = [];

const normalModeBtn = document.getElementById('normalModeBtn');
const listModeBtn = document.getElementById('listModeBtn');
const directModeBtn = document.getElementById('directModeBtn');
const decryptModeBtn = document.getElementById('decryptModeBtn');
const addBtn = document.getElementById('addBtn');
const cancelAllBtn = document.getElementById('cancelAllBtn');
const presetCard = document.getElementById('presetCard');
const urlInput = document.getElementById('urlInput');
const pasteBtn = document.getElementById('pasteBtn');
const confirmBtn = document.getElementById('confirmBtn');
const cancelPresetBtn = document.getElementById('cancelPresetBtn');
const tasksContainer = document.getElementById('tasksContainer');
const tasksEmpty = document.getElementById('tasksEmpty');
const queueNumber = document.getElementById('queueNumber');
const errorNumber = document.getElementById('errorNumber');
const errorPanel = document.getElementById('errorPanel');
const errorListContainer = document.getElementById('errorList');
const presetOptions = document.querySelector('.preset-options');
const playlistItemsContainer = document.getElementById('playlistItemsContainer');
const formatTrigger = document.getElementById('formatTrigger');
const thumbnailTrigger = document.getElementById('thumbnailTrigger');
const codecTrigger = document.getElementById('codecTrigger');
const formatTriggerValue = document.getElementById('formatTriggerValue');
const thumbnailTriggerValue = document.getElementById('thumbnailTriggerValue');
const codecTriggerValue = document.getElementById('codecTriggerValue');
const formatPanel = document.getElementById('formatPanel');
const thumbnailPanel = document.getElementById('thumbnailPanel');
const codecPanel = document.getElementById('codecPanel');
const codecCustomPanel = document.getElementById('codecCustomPanel');
const qualityPanel = document.getElementById('qualityPanel');
const formatBackBtn = document.getElementById('formatBackBtn');
const thumbnailBackBtn = document.getElementById('thumbnailBackBtn');
const codecBackBtn = document.getElementById('codecBackBtn');
const qualityBackBtn = document.getElementById('qualityBackBtn');
const qualityTrigger = document.getElementById('qualityTrigger');
const qualityTriggerValue = document.getElementById('qualityTriggerValue');
const qualityResolution = document.getElementById('qualityResolution');
const qualityFps = document.getElementById('qualityFps');
const qualityAudio = document.getElementById('qualityAudio');
const qualityCustomPanel = document.getElementById('qualityCustomPanel');
const selectionOverlay = document.getElementById('selectionOverlay');
const selectionDialog = document.getElementById('selectionDialog');

const playlistSelectModalOverlay = document.getElementById('playlistSelectModalOverlay');
const playlistSelectModal = document.getElementById('playlistSelectModal');
const playlistSelectCloseBtn = document.getElementById('playlistSelectCloseBtn');
const playlistSelectCancelBtn = document.getElementById('playlistSelectCancelBtn');
const playlistSelectConfirmBtn = document.getElementById('playlistSelectConfirmBtn');
const playlistSelectAllBtn = document.getElementById('playlistSelectAllBtn');
const playlistInvertBtn = document.getElementById('playlistInvertBtn');
const playlistSelectCount = document.getElementById('playlistSelectCount');
const playlistIndexToggle = document.getElementById('playlistIndexToggle');
const playlistSelectList = document.getElementById('playlistSelectList');
const playlistSelectTitle = document.getElementById('playlistSelectTitle');
const playlistSearchInput = document.getElementById('playlistSearchInput');

const listItemsCache = {};
const listMetaCache = {};
let currentSelectTaskId = null;
let groupToggles = {};

function createGroupHeader(name, total) {
    const header = document.createElement('div');
    header.className = 'playlist-group';

    const label = document.createElement('span');
    label.className = 'playlist-group-name';
    label.textContent = name || '其他';

    const countSpan = document.createElement('span');
    countSpan.className = 'playlist-group-count';
    countSpan.textContent = `已选 ${total}/${total} 集`;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'playlist-group-toggle';
    toggle.textContent = '取消全选';

    header.appendChild(label);
    header.appendChild(countSpan);
    header.appendChild(toggle);

    const entry = { items: [], countEl: countSpan, toggleEl: toggle, total };
    groupToggles[name] = entry;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const allSelected = entry.items.every(el => el.classList.contains('selected'));
        entry.items.forEach(el => el.classList.toggle('selected', !allSelected));
        updatePlaylistSelectCount();
    });

    return header;
}

let currentFormat = 'original';
let currentThumbnailFormat = 'none';
let currentCodecPreference = 'default';
let currentCustomVideoCodec = 'avc';
let currentCustomAudioCodec = 'aac';
let currentQuality = 'best';
let currentQualityResolution = '';
let currentQualityFps = '';
let currentQualityAudio = '';
let selectionCloseTimer = null;
let playlistCloseTimer = null;

[formatPanel, thumbnailPanel, codecPanel, qualityPanel].forEach((panel) => {
    if (panel && selectionDialog) selectionDialog.appendChild(panel);
});

function showSelectionPanel(panel) {
    clearTimeout(selectionCloseTimer);
    if (selectionDialog) selectionDialog.classList.remove('closing');
    if (selectionOverlay) selectionOverlay.classList.remove('closing');
    [formatPanel, thumbnailPanel, codecPanel, qualityPanel].forEach((p) => p && p.classList.remove('show'));
    panel.classList.add('show');
    if (selectionDialog) selectionDialog.classList.add('show');
    if (selectionOverlay) selectionOverlay.classList.add('show');
}

function hideSelectionPanel() {
    if (!selectionDialog || !selectionDialog.classList.contains('show')) return;
    selectionDialog.classList.add('closing');
    if (selectionOverlay) selectionOverlay.classList.add('closing');
    clearTimeout(selectionCloseTimer);
    selectionCloseTimer = setTimeout(() => {
        [formatPanel, thumbnailPanel, codecPanel, qualityPanel].forEach((p) => p && p.classList.remove('show'));
        if (selectionDialog) selectionDialog.classList.remove('show', 'closing');
        if (selectionOverlay) selectionOverlay.classList.remove('show', 'closing');
    }, 220);
}

formatTrigger.addEventListener('click', () => showSelectionPanel(formatPanel));
thumbnailTrigger.addEventListener('click', () => showSelectionPanel(thumbnailPanel));
codecTrigger.addEventListener('click', () => showSelectionPanel(codecPanel));
qualityTrigger.addEventListener('click', () => showSelectionPanel(qualityPanel));

formatBackBtn.addEventListener('click', hideSelectionPanel);
thumbnailBackBtn.addEventListener('click', hideSelectionPanel);
codecBackBtn.addEventListener('click', hideSelectionPanel);
qualityBackBtn.addEventListener('click', hideSelectionPanel);
if (selectionOverlay) selectionOverlay.addEventListener('click', hideSelectionPanel);

document.querySelectorAll('#formatPanel .selection-item').forEach(item => {
    item.addEventListener('click', () => {
        currentFormat = item.dataset.format;
        formatTriggerValue.textContent = item.querySelector('.selection-name').textContent;
        document.querySelectorAll('#formatPanel .selection-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        hideSelectionPanel();
    });
});

document.querySelectorAll('#thumbnailPanel .selection-item').forEach(item => {
    item.addEventListener('click', () => {
        currentThumbnailFormat = item.dataset.thumbnail;
        thumbnailTriggerValue.textContent = item.querySelector('.selection-name').textContent;
        document.querySelectorAll('#thumbnailPanel .selection-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        hideSelectionPanel();
    });
});

document.querySelectorAll('#codecPanel .codec-option input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            document.querySelectorAll('#codecPanel .codec-option input[type="checkbox"]').forEach(cb => {
                if (cb !== checkbox) cb.checked = false;
            });
            currentCodecPreference = checkbox.value;
            codecTriggerValue.textContent = checkbox.parentElement.querySelector('.codec-name').textContent;
            if (codecCustomPanel) {
                codecCustomPanel.classList.toggle('show', checkbox.value === 'custom');
            }
        } else {
            checkbox.checked = true;
        }
    });
});

if (codecCustomPanel) {
    codecCustomPanel.querySelectorAll('.codec-custom-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.closest('.codec-custom-group');
            if (!group) return;
            group.querySelectorAll('.codec-custom-btn').forEach(b => b.classList.toggle('active', b === btn));
            if (group.dataset.group === 'video') {
                currentCustomVideoCodec = btn.dataset.codec;
            } else {
                currentCustomAudioCodec = btn.dataset.codec;
            }
        });
    });
}

function updateQualityTriggerValue() {
    if (currentQuality === 'custom') {
        const parts = [];
        if (currentQualityResolution) parts.push(`分辨率 ${currentQualityResolution}`);
        if (currentQualityFps) parts.push(`FPS ${currentQualityFps}`);
        if (currentQualityAudio) parts.push(`音质 ${currentQualityAudio}K`);
        qualityTriggerValue.textContent = parts.length ? parts.join(' + ') : '自定义';
    } else {
        const radio = document.querySelector('#qualityPanel .quality-option input[type="radio"][value="' + currentQuality + '"]');
        if (radio) {
            qualityTriggerValue.textContent = radio.parentElement.querySelector('.quality-name').textContent;
        }
    }
}

function clearQualityPresets() {
    document.querySelectorAll('#qualityPanel .quality-preset-btn[data-res]').forEach(b => b.classList.remove('active'));
}

function clearFpsPresets() {
    document.querySelectorAll('#qualityPanel .quality-preset-btn[data-fps]').forEach(b => b.classList.remove('active'));
}

function clearAudioPresets() {
    document.querySelectorAll('#qualityPanel .quality-preset-btn[data-audio]').forEach(b => b.classList.remove('active'));
}

document.querySelectorAll('#qualityPanel .quality-option input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.checked) {
            currentQuality = radio.value;
            if (radio.value === 'custom') {
                if (qualityCustomPanel) qualityCustomPanel.classList.add('show');
                document.querySelectorAll('#qualityPanel .quality-presets').forEach(g => g.classList.remove('open'));
            } else {
                if (qualityCustomPanel) qualityCustomPanel.classList.remove('show');
                currentQualityResolution = '';
                if (qualityResolution) qualityResolution.value = '';
                currentQualityFps = '';
                if (qualityFps) qualityFps.value = '';
                currentQualityAudio = '';
                if (qualityAudio) qualityAudio.value = '';
                clearQualityPresets();
                clearFpsPresets();
                clearAudioPresets();
            }
            updateQualityTriggerValue();
        }
    });
});

qualityResolution.addEventListener('input', (e) => {
    currentQualityResolution = e.target.value.trim();
    if (currentQualityResolution) clearQualityPresets();
    updateQualityTriggerValue();
});

qualityFps.addEventListener('input', (e) => {
    currentQualityFps = e.target.value.trim();
    if (currentQualityFps) clearFpsPresets();
    updateQualityTriggerValue();
});

qualityAudio.addEventListener('input', (e) => {
    currentQualityAudio = e.target.value.trim();
    if (currentQualityAudio) clearAudioPresets();
    updateQualityTriggerValue();
});

document.querySelectorAll('#qualityPanel .quality-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.res !== undefined) {
            currentQualityResolution = btn.dataset.res;
            qualityResolution.value = btn.dataset.res;
            clearQualityPresets();
            btn.classList.add('active');
        } else if (btn.dataset.fps !== undefined) {
            currentQualityFps = btn.dataset.fps;
            qualityFps.value = btn.dataset.fps;
            clearFpsPresets();
            btn.classList.add('active');
        } else if (btn.dataset.audio !== undefined) {
            currentQualityAudio = btn.dataset.audio;
            qualityAudio.value = btn.dataset.audio;
            clearAudioPresets();
            btn.classList.add('active');
        }
        updateQualityTriggerValue();
    });
});

document.querySelectorAll('#qualityPanel .quality-presets-header').forEach(header => {
    header.addEventListener('click', () => {
        const group = header.closest('.quality-presets');
        if (group) group.classList.toggle('open');
    });
});

function openPlaylistSelect(taskId) {
    const items = listItemsCache[taskId];
    if (!items) return;
    currentSelectTaskId = taskId;
    playlistSelectList.innerHTML = '';
    groupToggles = {};
    if (playlistSearchInput) playlistSearchInput.value = '';

    const meta = listMetaCache[taskId] || {};
    const unit = meta.kind === 'music' ? '首' : '集';
    if (playlistSelectTitle) {
        const name = meta.title || '';
        playlistSelectTitle.textContent = name
            ? `${name} · 共${items.length}${unit}`
            : `选择要下载的集数（共${items.length}${unit}）`;
        playlistSelectTitle.title = name || '';
    }

    playlistSelectList.classList.toggle('music', meta.kind === 'music');

    const groupOrder = [];
    const groupCounts = {};
    items.forEach((item) => {
        const group = item.group || '';
        if (!(group in groupCounts)) {
            groupCounts[group] = 0;
            groupOrder.push(group);
        }
        groupCounts[group]++;
    });
    const useGroups = groupOrder.length > 1;

    let lastGroup = null;

    items.forEach((item, index) => {
        const group = item.group || '';

        if (useGroups && group !== lastGroup) {
            playlistSelectList.appendChild(createGroupHeader(group, groupCounts[group]));
            lastGroup = group;
        }

        const itemDiv = document.createElement('div');
        const lockedVip = meta.vipLocked && item.vip;
        itemDiv.className = (lockedVip || item.preview) ? 'playlist-item' : 'playlist-item selected';
        itemDiv.dataset.index = index;

        if (item.thumbnail) {
            const img = document.createElement('img');
            img.className = 'playlist-item-cover';
            img.src = item.thumbnail;
            itemDiv.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'playlist-item-cover placeholder';
            placeholder.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
            itemDiv.appendChild(placeholder);
        }

        const titleSpan = document.createElement('span');
        titleSpan.className = 'playlist-item-title';
        titleSpan.textContent = item.title ? `${index + 1}. ${item.title}` : `${index + 1}.`;
        itemDiv.appendChild(titleSpan);

        if (item.vip) {
            const vipSpan = document.createElement('span');
            vipSpan.className = 'playlist-item-vip';
            vipSpan.textContent = 'VIP';
            vipSpan.title = '会员歌曲，需要登录并开通会员才能下载';
            itemDiv.appendChild(vipSpan);
        }

        const checkSpan = document.createElement('span');
        checkSpan.className = 'playlist-item-check';
        checkSpan.textContent = '✓';
        itemDiv.appendChild(checkSpan);

        itemDiv.addEventListener('click', () => {
            itemDiv.classList.toggle('selected');
            updatePlaylistSelectCount();
        });

        playlistSelectList.appendChild(itemDiv);

        if (useGroups && groupToggles[group]) {
            groupToggles[group].items.push(itemDiv);
        }
    });

    updatePlaylistSelectCount();
    clearTimeout(playlistCloseTimer);
    playlistSelectModal.classList.remove('closing');
    playlistSelectModalOverlay.classList.remove('closing');
    playlistSelectModal.classList.add('show');
    playlistSelectModalOverlay.classList.add('show');
}

function closePlaylistSelect() {
    currentSelectTaskId = null;
    if (!playlistSelectModal.classList.contains('show')) return;
    playlistSelectModal.classList.add('closing');
    playlistSelectModalOverlay.classList.add('closing');
    clearTimeout(playlistCloseTimer);
    playlistCloseTimer = setTimeout(() => {
        playlistSelectModal.classList.remove('show', 'closing');
        playlistSelectModalOverlay.classList.remove('show', 'closing');
    }, 220);
}

function updatePlaylistSelectCount() {
    const selectedCount = playlistSelectList.querySelectorAll('.playlist-item.selected').length;
    playlistSelectCount.textContent = `已选 ${selectedCount} 项`;

    Object.keys(groupToggles).forEach((name) => {
        const entry = groupToggles[name];
        if (!entry) return;
        const selected = entry.items.filter(el => el.classList.contains('selected')).length;
        if (entry.countEl) {
            entry.countEl.textContent = `已选 ${selected}/${entry.total} 集`;
        }
        if (entry.toggleEl) {
            entry.toggleEl.textContent = selected === entry.items.length ? '取消全选' : '全选';
        }
    });
}

function getSelectedUrls() {
    const selected = [];
    const items = listItemsCache[currentSelectTaskId] || [];
    playlistSelectList.querySelectorAll('.playlist-item.selected').forEach(itemDiv => {
        const index = parseInt(itemDiv.dataset.index);
        if (items[index]) {
            selected.push(items[index].url);
        }
    });
    return selected;
}

function markListTaskFiltering(taskId) {
    const card = tasksContainer.querySelector(`[data-task-id="${taskId}"]`);
    if (card && card.classList.contains('list-task-card')) {
        card.classList.remove('is-selectable');
        card.classList.add('is-filtering');
        const infoDiv = card.querySelector('.list-task-info');
        if (infoDiv) {
            const title = infoDiv.textContent.split('：')[0];
            infoDiv.textContent = `${title}：筛选中...`;
        }
    }
}

playlistSelectCloseBtn.addEventListener('click', closePlaylistSelect);
playlistSelectCancelBtn.addEventListener('click', closePlaylistSelect);
playlistSelectModalOverlay.addEventListener('click', closePlaylistSelect);

playlistSelectAllBtn.addEventListener('click', () => {
    playlistSelectList.querySelectorAll('.playlist-item').forEach(item => item.classList.add('selected'));
    updatePlaylistSelectCount();
});

playlistInvertBtn.addEventListener('click', () => {
    playlistSelectList.querySelectorAll('.playlist-item').forEach(item => item.classList.toggle('selected'));
    updatePlaylistSelectCount();
});

if (playlistSearchInput) {
    playlistSearchInput.addEventListener('input', () => {
        const keyword = playlistSearchInput.value.trim().toLowerCase();
        playlistSelectList.querySelectorAll('.playlist-item').forEach(itemDiv => {
            const titleEl = itemDiv.querySelector('.playlist-item-title');
            const title = (titleEl ? titleEl.textContent : '').toLowerCase();
            itemDiv.style.display = (!keyword || title.includes(keyword)) ? '' : 'none';
        });
        Object.keys(groupToggles).forEach((name) => {
            const entry = groupToggles[name];
            if (!entry || !entry.countEl) return;
            const header = entry.countEl.closest('.playlist-group');
            if (!header) return;
            const hasVisible = entry.items.some(el => el.style.display !== 'none');
            header.style.display = hasVisible ? '' : 'none';
        });
    });
}

playlistSelectConfirmBtn.addEventListener('click', () => {
    const selectedUrls = getSelectedUrls();
    if (selectedUrls.length === 0) {
        showNotification('请至少选择一集', 'error');
        return;
    }
    if (currentSelectTaskId) {
        ipcRenderer.send('confirm-list-selection', {
            id: currentSelectTaskId,
            selectedUrls: selectedUrls,
            addIndexPrefix: playlistIndexToggle ? playlistIndexToggle.checked : false
        });
        markListTaskFiltering(currentSelectTaskId);
    }
    closePlaylistSelect();
});

normalModeBtn.addEventListener('click', () => {
    currentMode = 'normal';
    normalModeBtn.classList.add('active');
    listModeBtn.classList.remove('active');
    directModeBtn.classList.remove('active');
    decryptModeBtn.classList.remove('active');
    urlInput.placeholder = '输入链接，一行一个';
    errorPanel.classList.remove('show');
});

listModeBtn.addEventListener('click', () => {
    currentMode = 'list';
    listModeBtn.classList.add('active');
    normalModeBtn.classList.remove('active');
    directModeBtn.classList.remove('active');
    decryptModeBtn.classList.remove('active');
    urlInput.placeholder = '输入播放列表链接';
    errorPanel.classList.remove('show');
});

directModeBtn.addEventListener('click', () => {
    currentMode = 'direct';
    directModeBtn.classList.add('active');
    normalModeBtn.classList.remove('active');
    listModeBtn.classList.remove('active');
    decryptModeBtn.classList.remove('active');
    urlInput.placeholder = '输入直链下载链接，一行一个';
    errorPanel.classList.remove('show');
});

addBtn.addEventListener('click', () => {
    if (currentMode === 'decrypt') {
        showDecryptPanel();
    } else {
        showPresetCard();
    }
});

cancelAllBtn.addEventListener('click', () => {
    ipcRenderer.send('cancel-all-tasks');
});

pasteBtn.addEventListener('click', async () => {
    try {
        const text = await clipboard.readText();
        const links = extractLinks(text);
        const newContent = links.join('\n');
        const existing = urlInput.value;
        if (existing.trim()) {
            urlInput.value = (existing.endsWith('\n') ? existing : existing + '\n') + newContent;
        } else {
            urlInput.value = newContent;
        }
    } catch (err) {
    }
});

urlInput.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

urlInput.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

urlInput.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                const links = extractLinks(text);
                urlInput.value = links.join('\n');
            };
            reader.readAsText(file);
        }
    }
});

cancelPresetBtn.addEventListener('click', () => {
    hidePresetCard();
});

confirmBtn.addEventListener('click', () => {
    const urls = urlInput.value.trim().split('\n').filter(url => url.trim());

    if (urls.length === 0) {
        showNotification('请输入至少一个链接', 'error');
        return;
    }

    if (currentMode === 'list' && urls.length > 1) {
        showNotification('列表模式只支持单个链接', 'error');
        return;
    }

    const cookiesEnabled = advancedCookiesEnabled.checked;
    const cookiesPath = advancedCookiesPath.value;
    const userAgentEnabled = advancedUserAgentEnabled.checked;
    const userAgentValue = advancedUserAgentValue.value;

    if (currentMode === 'direct') {
        const directSegments = document.getElementById('directSegments').value;
        const directUserAgent = document.getElementById('directUserAgent').value;
        const directCookie = document.getElementById('directCookie').value;
        const directReferer = document.getElementById('directReferer').value;

        urls.forEach(url => {
            const taskData = {
                url: url.trim(),
                type: 'direct',
                mode: currentMode,
                segments: directSegments,
                userAgent: directUserAgent,
                cookie: directCookie,
                referer: directReferer
            };

            ipcRenderer.send('add-download-task', taskData);
        });
        showNotification(`添加了${urls.length}个直链的任务`, 'success');
    } else {
        const format = currentFormat;
        const thumbnailFormat = currentThumbnailFormat;
        const saveThumbnailChecked = thumbnailFormat !== 'none';
        const codecPreference = currentCodecPreference;
        const videoCodec = currentCustomVideoCodec;
        const audioCodec = currentCustomAudioCodec;
        const qualityPreference = currentQuality;
        const qualityResolutionValue = (currentQuality === 'custom') ? currentQualityResolution : '';
        const qualityFpsValue = (currentQuality === 'custom') ? currentQualityFps : '';
        const qualityAudioValue = (currentQuality === 'custom') ? currentQualityAudio : '';
        const listSelectMode = currentMode === 'list'
            ? (document.querySelector('input[name="listSelectMode"]:checked')?.value || 'all')
            : 'all';

        urls.forEach(url => {
            const taskData = {
                url: url.trim(),
                type: 'video',
                format: format,
                saveThumbnail: saveThumbnailChecked,
                thumbnailFormat: saveThumbnailChecked ? thumbnailFormat : null,
                codecPreference: codecPreference,
                videoCodec: videoCodec,
                audioCodec: audioCodec,
                qualityPreference: qualityPreference,
                qualityResolution: qualityResolutionValue,
                qualityFps: qualityFpsValue,
                qualityAudio: qualityAudioValue,
                mode: currentMode,
                listSelectMode: listSelectMode,
                cookies: {
                    enabled: cookiesEnabled,
                    path: cookiesPath
                },
                customHeaders: {
                    enabled: userAgentEnabled,
                    value: userAgentEnabled ? `User-Agent: ${userAgentValue}` : ''
                }
            };

            ipcRenderer.send('add-download-task', taskData);
        });
        showNotification(`添加了${urls.length}个任务`, 'success');
    }

    hidePresetCard();
});

function showPresetCard() {
    presetCard.classList.add('show');
    urlInput.value = '';
    urlInput.focus();

    normalModeBtn.disabled = true;
    listModeBtn.disabled = true;
    directModeBtn.disabled = true;
    decryptModeBtn.disabled = true;
    document.getElementById('queueCount').classList.add('disabled');
    document.getElementById('errorCount').classList.add('disabled');

    formatPanel.classList.remove('show');
    thumbnailPanel.classList.remove('show');
    codecPanel.classList.remove('show');
    qualityPanel.classList.remove('show');
    hideSelectionPanel();

    const isDirect = currentMode === 'direct';
    const isList = currentMode === 'list';
    presetOptions.classList.toggle('is-hidden', isDirect);
    playlistItemsContainer.classList.toggle('is-hidden', !isList);
    document.getElementById('directHint').classList.toggle('show', isDirect);
    document.getElementById('directOptions').classList.toggle('show', isDirect);
    document.getElementById('advancedBtn').classList.toggle('is-hidden', isDirect);
}

function hidePresetCard() {
    presetCard.classList.remove('show');

    normalModeBtn.disabled = false;
    listModeBtn.disabled = false;
    directModeBtn.disabled = false;
    decryptModeBtn.disabled = false;
    document.getElementById('queueCount').classList.remove('disabled');
    document.getElementById('errorCount').classList.remove('disabled');
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.id;
    card.dataset.url = task.url || '';

    if (task.type !== 'direct') {
        const coverDiv = document.createElement('div');
        coverDiv.className = 'task-cover';

        const coverImg = document.createElement('img');
        coverImg.src = '';
        coverImg.alt = '封面';
        coverDiv.appendChild(coverImg);

        const placeholder = document.createElement('div');
        placeholder.className = 'task-cover-placeholder';
        placeholder.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        coverDiv.appendChild(placeholder);

        card.appendChild(coverDiv);
    }

    const progressBg = document.createElement('div');
    progressBg.className = 'task-progress-bg';
    progressBg.style.width = '0%';

    const progressBar = document.createElement('div');
    progressBar.className = 'task-progress-bar';
    progressBar.style.width = '0%';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'task-info';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'task-title';
    titleDiv.textContent = task.title || 'Loading...';
    infoDiv.appendChild(titleDiv);

    if (task.type !== 'direct') {
        const authorDiv = document.createElement('div');
        authorDiv.className = 'task-author';
        authorDiv.textContent = task.author || '';
        infoDiv.appendChild(authorDiv);

        const durationDiv = document.createElement('div');
        durationDiv.className = 'task-duration';
        durationDiv.textContent = task.duration || '';
        infoDiv.appendChild(durationDiv);
    }

    const sizeDiv = document.createElement('div');
    sizeDiv.className = 'task-size';
    sizeDiv.textContent = '';
    infoDiv.appendChild(sizeDiv);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'task-meta';
    const statusDiv = document.createElement('span');
    statusDiv.className = 'task-status task-status-queued';
    statusDiv.innerHTML = '<span class="task-status-dot"></span><span class="task-status-text">等待中</span>';
    metaDiv.appendChild(statusDiv);

    const progressText = document.createElement('span');
    progressText.className = 'task-progress-text';
    progressText.textContent = '';
    metaDiv.appendChild(progressText);

    if (task.type === 'direct') {
        const etaDiv = document.createElement('div');
        etaDiv.className = 'task-eta';
        etaDiv.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 3h14"></path>
                <path d="M5 21h14"></path>
                <path d="M6 3v2a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
                <path d="M6 21v-2a6 6 0 0 1 6-6 6 6 0 0 1 6 6v2"></path>
            </svg>
            <span></span>
        `;
        metaDiv.appendChild(etaDiv);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'task-close';
    closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.addEventListener('click', () => {
        removeTask(task.id);
    });

    card.appendChild(progressBg);
    card.appendChild(progressBar);
    card.appendChild(infoDiv);
    card.appendChild(metaDiv);
    card.appendChild(closeBtn);

    return card;
}

function createListTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'list-task-card';
    card.dataset.taskId = task.id;
    card.dataset.url = task.url || '';
    card.dataset.listSelectMode = task.listSelectMode || 'all';

    const progressBg = document.createElement('div');
    progressBg.className = 'task-progress-bg';
    progressBg.style.width = '0%';

    const progressBar = document.createElement('div');
    progressBar.className = 'task-progress-bar';
    progressBar.style.width = '0%';

    const body = document.createElement('div');
    body.className = 'list-task-body';

    const coverDiv = document.createElement('div');
    coverDiv.className = 'list-task-cover';
    const coverImg = document.createElement('img');
    coverImg.alt = '封面';
    coverDiv.appendChild(coverImg);
    body.appendChild(coverDiv);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'list-task-info';
    infoDiv.textContent = task.title || (task.listSelectMode === 'manual' ? '解析列表中...' : 'Loading...');
    infoDiv.dataset.totalVideos = task.totalVideos || '';
    body.appendChild(infoDiv);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'task-close';
    closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.addEventListener('click', () => {
        removeTask(task.id);
    });

    card.appendChild(progressBg);
    card.appendChild(progressBar);
    card.appendChild(body);
    card.appendChild(closeBtn);

    if (task.cover) {
        setListTaskCover(card, task.cover);
    }

    if (task.listSelectMode === 'manual') {
        card.classList.add('is-selectable');
        card.addEventListener('click', (e) => {
            if (e.target.closest('.task-close')) return;
            if (card.classList.contains('is-filtering')) return;
            openPlaylistSelect(task.id);
        });
    }

    return card;
}

function setListTaskCover(card, coverUrl, kind) {
    if (!card || !coverUrl) return;
    const coverDiv = card.querySelector('.list-task-cover');
    if (!coverDiv) return;
    const coverImg = coverDiv.querySelector('img');
    if (!coverImg) return;
    coverImg.src = coverUrl;
    coverDiv.classList.toggle('is-audio', kind === 'music');
    coverDiv.classList.add('show');
}

function addTaskCard(task) {
    let card;
    if (task.mode === 'list') {
        card = createListTaskCard(task);
    } else {
        card = createTaskCard(task);
    }
    tasksContainer.appendChild(card);
    updateAddButton();
    updateQueueCount();
}

function removeTask(taskId) {
    ipcRenderer.send('remove-task', taskId);
}

function removeTaskCard(taskId) {
    const card = tasksContainer.querySelector(`[data-task-id="${taskId}"]`);
    if (card) {
        card.classList.add('removing');
        setTimeout(() => {
            card.remove();
            delete listItemsCache[taskId];
            delete listMetaCache[taskId];
            updateAddButton();
            updateQueueCount();
        }, 300);
    }
}

function updateTaskProgress(taskId, progress, downloaded, total) {
    const card = tasksContainer.querySelector(`[data-task-id="${taskId}"]`);
    if (card) {
        const progressBg = card.querySelector('.task-progress-bg');
        if (progressBg) {
            progressBg.style.width = progress + '%';
        }

        const progressBar = card.querySelector('.task-progress-bar');
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }

        const progressText = card.querySelector('.task-progress-text');
        if (progressText) {
            progressText.textContent = progress > 0 ? Math.round(progress) + '%' : '';
        }

        const statusDiv = card.querySelector('.task-status');
        if (statusDiv && progress > 0) {
            statusDiv.className = 'task-status task-status-downloading';
            statusDiv.innerHTML = '<span class="task-status-dot"></span><span class="task-status-text">下载中</span>';
        }

        const sizeDiv = card.querySelector('.task-size');
        if (sizeDiv && downloaded && total) {
            sizeDiv.textContent = `${downloaded} / ${total}`;
        }

        if (progress > 0) {
            if (card.classList.contains('list-task-card')) {
                const infoDiv = card.querySelector('.list-task-info');
                if (infoDiv && (!infoDiv.textContent || infoDiv.textContent === 'Loading...')) {
                    infoDiv.textContent = card.dataset.url || '下载中';
                }
            } else {
                const titleDiv = card.querySelector('.task-title');
                if (titleDiv && (!titleDiv.textContent || titleDiv.textContent === 'Loading...')) {
                    titleDiv.textContent = card.dataset.url || '下载中';
                    const coverDiv = card.querySelector('.task-cover');
                    if (coverDiv && !coverDiv.classList.contains('show')) {
                        coverDiv.classList.add('temp');
                    }
                }
            }
        }
    }
}

function updateTaskEta(taskId, eta) {
    const card = tasksContainer.querySelector(`[data-task-id="${taskId}"]`);
    if (card) {
        const etaDiv = card.querySelector('.task-eta');
        if (etaDiv) {
            const span = etaDiv.querySelector('span');
            if (span) {
                span.textContent = eta;
            }
        }
    }
}

function updateListTaskProgress(taskId, downloaded, total) {
    const card = tasksContainer.querySelector(`[data-task-id="${taskId}"]`);
    if (card) {
        const infoDiv = card.querySelector('.list-task-info');
        if (infoDiv) {
            const title = infoDiv.textContent.split('：')[0];
            infoDiv.textContent = `${title}：已下载 ${downloaded}/${total} 集`;
        }

        const progress = total > 0 ? (downloaded / total) * 100 : 0;
        const progressBg = card.querySelector('.task-progress-bg');
        if (progressBg) {
            progressBg.style.width = progress + '%';
        }

        const progressBar = card.querySelector('.task-progress-bar');
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
    }
}

function updateAddButton() {
    const taskCards = tasksContainer.querySelectorAll('.task-card, .list-task-card');
    hasTasks = taskCards.length > 0;

    if (hasTasks) {
        cancelAllBtn.classList.remove('is-hidden');
        if (tasksEmpty) tasksEmpty.classList.add('hidden');
    } else {
        cancelAllBtn.classList.add('is-hidden');
        if (tasksEmpty) tasksEmpty.classList.remove('hidden');
    }
}

function updateQueueCount() {
    ipcRenderer.send('get-queue-count');
}

function renderErrorList() {
    errorListContainer.innerHTML = '';

    if (errorList.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'error-empty';
        emptyMessage.textContent = '暂无失败任务';
        errorListContainer.appendChild(emptyMessage);
        return;
    }

    errorList.forEach((error, index) => {
        const errorItem = document.createElement('div');
        errorItem.className = 'error-item';

        const errorHeader = document.createElement('div');
        errorHeader.className = 'error-item-header';

        const errorTitle = document.createElement('div');
        errorTitle.className = 'error-item-title';
        errorTitle.textContent = error.title || error.url;

        const errorActions = document.createElement('div');
        errorActions.className = 'error-item-actions';

        const errorToggle = document.createElement('button');
        errorToggle.className = 'error-item-toggle';
        errorToggle.title = '查看详情';
        errorToggle.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;
        errorToggle.addEventListener('click', () => {
            const details = errorItem.querySelector('.error-item-details');
            const svg = errorToggle.querySelector('svg');
            if (details.classList.contains('show')) {
                details.classList.remove('show');
                errorToggle.title = '查看详情';
                svg.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
            } else {
                details.classList.add('show');
                errorToggle.title = '隐藏详情';
                svg.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>';
            }
        });

        const copyBtn = document.createElement('button');
        copyBtn.className = 'error-item-copy';
        copyBtn.title = '复制错误信息';
        copyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(error.originalError || error.error || '异常中断').then(() => {
                showNotification('错误信息已复制到剪贴板', 'success');
            }).catch(err => {
                showNotification('复制失败', 'error');
            });
        });

        errorActions.appendChild(errorToggle);
        errorActions.appendChild(copyBtn);

        errorHeader.appendChild(errorTitle);
        errorHeader.appendChild(errorActions);

        const errorDetails = document.createElement('div');
        errorDetails.className = 'error-item-details';

        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = error.error || '异常中断';

        errorDetails.appendChild(errorMessage);

        errorItem.appendChild(errorHeader);
        errorItem.appendChild(errorDetails);

        errorListContainer.appendChild(errorItem);
    });
}

function updateErrorCount() {
    errorNumber.textContent = errorCount;
    document.getElementById('errorCount').classList.toggle('error-state', errorCount > 0);
}

function getErrorDisplayMessage(error) {
    if (error.includes('is not a valid URL')) {
        return '无效或不规范的链接';
    }
    if (error.includes('become a premium member')) {
        return '需要传入带有对应平台VIP的cookies';
    }
    if (error.includes('Unsupported URL:') || error.includes('Invalid data found when processing input')) {
        return '该链接暂不支持';
    }
    if (error.includes('Read timed out') || error.includes('connect timeout=')) {
        return '连接超时';
    }
    if (error.includes('Unable to download webpage: HTTP Error 404: Not Found')) {
        return '页面不存在';
    }
    return error || '异常中断';
}

function addError(error) {
    error.originalError = error.error;
    error.error = getErrorDisplayMessage(error.error);
    errorList.push(error);
    errorCount++;
    updateErrorCount();
}

function clearErrors() {
    errorList = [];
    errorCount = 0;
    updateErrorCount();
    renderErrorList();
}

document.getElementById('errorCount').addEventListener('click', () => {
    if (errorPanel.classList.contains('show')) {
        errorPanel.classList.remove('show');
    } else {
        errorPanel.classList.add('show');
        renderErrorList();
    }
});

document.getElementById('clearErrorsBtn').addEventListener('click', clearErrors);
document.getElementById('refreshErrorsBtn').addEventListener('click', renderErrorList);

ipcRenderer.on('task-added', (event, task) => {
    addTaskCard(task);
});

ipcRenderer.on('task-removed', (event, taskId) => {
    removeTaskCard(taskId);
});

ipcRenderer.on('task-progress', (event, data) => {
    updateTaskProgress(data.id, data.progress, data.downloaded, data.total);
});

ipcRenderer.on('task-eta', (event, data) => {
    updateTaskEta(data.id, data.eta);
});

ipcRenderer.on('task-list-progress', (event, data) => {
    updateListTaskProgress(data.id, data.downloaded, data.total);
});

ipcRenderer.on('task-completed', (event, taskId) => {
    removeTaskCard(taskId);
    ipcRenderer.send('flash-frame');
    if (systemNotificationOnComplete && Notification.permission === 'granted') {
        new Notification('FetchIT', { body: '下载任务已完成', silent: true });
    }
});

ipcRenderer.on('task-failed', (event, data) => {
    const { taskId, error, title, url } = data;
    removeTaskCard(taskId);
    addError({ taskId, error, title, url });
});

ipcRenderer.on('all-tasks-cancelled', () => {
    tasksContainer.innerHTML = '';
    for (const key in listItemsCache) {
        delete listItemsCache[key];
    }
    for (const key in listMetaCache) {
        delete listMetaCache[key];
    }
    currentSelectTaskId = null;
    updateAddButton();
    updateQueueCount();
});

ipcRenderer.on('show-notification', (event, message) => {
    showNotification(message);
});

ipcRenderer.on('queue-count', (event, count) => {
    queueNumber.textContent = count;
});

ipcRenderer.on('playlist-parsed', (event, data) => {
    listItemsCache[data.id] = data.items;
    listMetaCache[data.id] = {
        title: data.title || '',
        cover: data.cover || '',
        kind: data.kind || 'video',
        vipLocked: !!data.vipLocked
    };
    const card = tasksContainer.querySelector(`[data-task-id="${data.id}"]`);
    if (card && card.classList.contains('list-task-card')) {
        if (data.title) card.dataset.listTitle = data.title;
        if (data.kind) card.dataset.listKind = data.kind;
        setListTaskCover(card, data.cover, data.kind);
        const infoDiv = card.querySelector('.list-task-info');
        if (infoDiv) {
            if (card.dataset.listSelectMode === 'manual') {
                const unit = data.kind === 'music' ? '首' : '集';
                infoDiv.textContent = `${data.title}：点击筛选 ${data.items.length} ${unit}`;
            } else if (data.skippedVip > 0) {
                const unit = data.kind === 'music' ? '首' : '集';
                infoDiv.textContent = `${data.title}：共${data.items.length}${unit}，已跳过 ${data.skippedVip} 个会员条目（未配置 cookies）`;
            }
        }
    }
});

ipcRenderer.on('update-task-info', (event, data) => {
    const card = tasksContainer.querySelector(`[data-task-id="${data.id}"]`);
    if (card) {
        if (card.classList.contains('list-task-card')) {
            if (data.title) card.dataset.listTitle = data.title;
            if (data.kind) card.dataset.listKind = data.kind;
            if (data.vipLocked !== undefined && listMetaCache[data.id]) {
                listMetaCache[data.id].vipLocked = !!data.vipLocked;
            }
            setListTaskCover(card, data.cover, data.kind);
            const infoDiv = card.querySelector('.list-task-info');
            if (infoDiv) {
                const title = data.title || 'Loading...';
                if (card.dataset.listSelectMode === 'manual') {
                    infoDiv.textContent = `${title}：等待筛选`;
                } else if (data.totalVideos) {
                    infoDiv.textContent = `${title}：原列表包含${data.totalVideos}个项目`;
                } else {
                    infoDiv.textContent = title;
                }
            }
        } else {
            const titleDiv = card.querySelector('.task-title');
            const authorDiv = card.querySelector('.task-author');
            const durationDiv = card.querySelector('.task-duration');
            const coverDiv = card.querySelector('.task-cover');
            const coverImg = card.querySelector('.task-cover img');

            if (coverDiv) coverDiv.classList.remove('temp');
            if (titleDiv) titleDiv.textContent = data.title || 'Loading...';
            if (authorDiv) authorDiv.textContent = data.author || '';
            if (durationDiv) durationDiv.textContent = data.duration || '';
            if (coverImg && data.thumbnail) {
                coverImg.src = data.thumbnail;
                coverDiv.classList.add('show');
            }
        }
    }
});

updateQueueCount();
updateErrorCount();

const decryptPanel = document.getElementById('decryptPanel');
const decryptDropzone = document.getElementById('decryptDropzone');
const decryptCount = document.getElementById('decryptCount');
const decryptConfirmBtn = document.getElementById('decryptConfirmBtn');
const decryptCancelBtn = document.getElementById('decryptCancelBtn');

let selectedDecryptFiles = [];
let decryptCardMap = {};

function decryptBaseName(p) {
    return p.split(/[\\/]/).pop();
}

function updateDecryptCount() {
    decryptCount.textContent = `已选择 ${selectedDecryptFiles.length} 个文件`;
}

function addDecryptFilesByPath(paths) {
    paths.forEach((p) => {
        selectedDecryptFiles.push({ name: decryptBaseName(p), path: p });
    });
    updateDecryptCount();
}

function showDecryptPanel() {
    decryptPanel.classList.add('show');
    selectedDecryptFiles = [];
    updateDecryptCount();
    decryptDropzone.classList.remove('dragover');

    normalModeBtn.disabled = true;
    listModeBtn.disabled = true;
    directModeBtn.disabled = true;
    decryptModeBtn.disabled = true;
    document.getElementById('queueCount').classList.add('disabled');
    document.getElementById('errorCount').classList.add('disabled');
}

function hideDecryptPanel() {
    decryptPanel.classList.remove('show');

    normalModeBtn.disabled = false;
    listModeBtn.disabled = false;
    directModeBtn.disabled = false;
    decryptModeBtn.disabled = false;
    document.getElementById('queueCount').classList.remove('disabled');
    document.getElementById('errorCount').classList.remove('disabled');
}

function createDecryptCard(id, filename) {
    const card = document.createElement('div');
    card.className = 'decrypt-card';
    card.dataset.decryptId = id;

    const name = document.createElement('div');
    name.className = 'decrypt-card-name';
    name.textContent = filename;

    const status = document.createElement('div');
    status.className = 'decrypt-card-status';
    status.innerHTML = '<div class="decrypt-spinner"></div>';

    card.appendChild(name);
    card.appendChild(status);

    tasksContainer.appendChild(card);
    if (tasksEmpty) tasksEmpty.classList.add('hidden');

    decryptCardMap[id] = card;
}

function resolveDecryptCard(id, success) {
    const card = decryptCardMap[id];
    if (!card) return;

    const status = card.querySelector('.decrypt-card-status');
    if (success) {
        card.classList.add('success');
        status.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else {
        card.classList.add('fail');
        status.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    }

    setTimeout(() => {
        removeDecryptCard(id);
    }, 3000);
}

function removeDecryptCard(id) {
    const card = decryptCardMap[id];
    if (!card) return;

    delete decryptCardMap[id];
    card.classList.add('removing');
    setTimeout(() => {
        card.remove();
        const hasTaskCards = tasksContainer.querySelectorAll('.task-card, .list-task-card').length > 0;
        if (Object.keys(decryptCardMap).length === 0 && !hasTaskCards && tasksEmpty) {
            tasksEmpty.classList.remove('hidden');
        }
    }, 300);
}

decryptModeBtn.addEventListener('click', () => {
    currentMode = 'decrypt';
    decryptModeBtn.classList.add('active');
    normalModeBtn.classList.remove('active');
    listModeBtn.classList.remove('active');
    directModeBtn.classList.remove('active');
    errorPanel.classList.remove('show');
});

decryptDropzone.addEventListener('click', () => {
    ipcRenderer.send('select-decrypt-files');
});

decryptDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    decryptDropzone.classList.add('dragover');
});

decryptDropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    decryptDropzone.classList.remove('dragover');
});

decryptDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    decryptDropzone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        for (const file of files) {
            selectedDecryptFiles.push({ name: file.name, path: file.path || file.name });
        }
        updateDecryptCount();
    }
});

decryptConfirmBtn.addEventListener('click', () => {
    if (selectedDecryptFiles.length === 0) {
        showNotification('请先导入文件', 'error');
        return;
    }

    const stamp = Date.now();
    const files = selectedDecryptFiles.map((f, i) => ({ id: 'd' + stamp + '-' + i, path: f.path, name: f.name }));
    files.forEach((f) => createDecryptCard(f.id, f.name));
    ipcRenderer.send('decrypt-files', files);

    hideDecryptPanel();
    selectedDecryptFiles = [];
    updateDecryptCount();
});

decryptCancelBtn.addEventListener('click', () => {
    hideDecryptPanel();
});

ipcRenderer.on('decrypt-files-selected', (event, paths) => {
    addDecryptFilesByPath(paths);
});

ipcRenderer.on('decrypt-result', (event, data) => {
    resolveDecryptCard(data.id, data.success);
});

const settingsModal = document.getElementById('settingsModal');
const aboutModal = document.getElementById('aboutModal');
const aboutModalOverlay = document.getElementById('aboutModalOverlay');

function closeAboutModal() {
    aboutModal.classList.remove('show');
    aboutModalOverlay.classList.remove('show');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
    }

    if (e.key === ' ' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && !presetCard.classList.contains('show') && !decryptPanel.classList.contains('show') && !hasTasks) {
        e.preventDefault();
        if (currentMode === 'decrypt') {
            showDecryptPanel();
        } else {
            showPresetCard();
        }
    }

    if (e.key === 'Escape') {
        if (typeof selectionDialog !== 'undefined' && selectionDialog && selectionDialog.classList.contains('show')) {
            e.preventDefault();
            hideSelectionPanel();
            return;
        }
    }

    if (e.key === 'Escape' && presetCard.classList.contains('show')) {
        e.preventDefault();
        hidePresetCard();
    }

    if (e.key === 'Escape' && decryptPanel.classList.contains('show')) {
        e.preventDefault();
        hideDecryptPanel();
    }

    if (e.key === 'Escape' && errorPanel.classList.contains('show')) {
        e.preventDefault();
        errorPanel.classList.remove('show');
    }

    if (e.key === 'Escape' && settingsModal.classList.contains('show')) {
        e.preventDefault();
        settingsModal.classList.remove('show');
        document.getElementById('settingsModalOverlay').classList.remove('show');
    }

    if (e.key === 'Escape' && aboutModal && aboutModal.classList.contains('show')) {
        e.preventDefault();
        closeAboutModal();
    }

    if (e.key === 'Delete' && hasTasks) {
        e.preventDefault();
        ipcRenderer.send('cancel-all-tasks');
    }
});

document.getElementById('openFolderBtn').addEventListener('click', () => {
    ipcRenderer.send('open-output-folder');
});

document.getElementById('settingsBtn').addEventListener('click', () => {
    settingsModal.classList.add('show');
    document.getElementById('settingsModalOverlay').classList.add('show');
});

document.getElementById('settingsModalOverlay').addEventListener('click', () => {
    settingsModal.classList.remove('show');
    document.getElementById('settingsModalOverlay').classList.remove('show');
});

document.getElementById('aboutBtn').addEventListener('click', () => {
    aboutModal.classList.add('show');
    aboutModalOverlay.classList.add('show');
});

document.getElementById('aboutModalClose').addEventListener('click', closeAboutModal);
aboutModalOverlay.addEventListener('click', closeAboutModal);

document.querySelectorAll('.about-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.about-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.about-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`.about-tab-content[data-tab-content="${target}"]`).classList.add('active');
    });
});

document.getElementById('minimizeBtn').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

document.getElementById('closeBtn').addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

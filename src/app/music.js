const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ctx = require('./context');

// 音乐解锁：使用 Deno 运行 utils/um-deno/decrypt.ts（Unlock Music 源码改造版）
const denoPath = ctx.denoPath;
const umDenoScriptPath = ctx.umDenoScriptPath;

// deno run --allow-read --allow-write --allow-net decrypt.ts <input> [outputDir]
function buildDecryptCommand(inputFile, outputDir) {
    return {
        cmd: denoPath,
        args: [
            'run',
            '--allow-read',
            '--allow-write',
            '--allow-net',
            umDenoScriptPath,
            inputFile,
            outputDir
        ]
    };
}

function notify(name, status, error) {
    if (!ctx.mainWindow || ctx.mainWindow.isDestroyed()) return;
    ctx.mainWindow.webContents.send('music-decrypt-item', { name, status, error });
}

// 渲染层拖入加密音乐文件后调用：逐个用 Deno + um-deno 解锁，输出到 FetchIT 输出目录
ipcMain.on('decrypt-music-files', (event, filePaths) => {
    if (!ctx.mainWindow) return;
    const outputDir = ctx.settings && ctx.settings.savePath;
    if (!outputDir) return;

    if (!fs.existsSync(denoPath)) {
        ctx.mainWindow.webContents.send('music-decrypt-missing', denoPath);
        return;
    }
    if (!fs.existsSync(umDenoScriptPath)) {
        ctx.mainWindow.webContents.send('music-decrypt-missing', umDenoScriptPath);
        return;
    }
    ctx.ensureDirectoryExists(outputDir);

    filePaths.forEach((file) => {
        const { cmd, args } = buildDecryptCommand(file, outputDir);
        const proc = spawn(cmd, args, { windowsHide: true });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('error', (err) => {
            notify(path.basename(file), 'failed', err.message);
        });
        proc.on('close', (code) => {
            // 解析 deno 脚本输出的 JSON 行（取最后一行，避免日志干扰）
            const lines = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
            const last = lines[lines.length - 1] || '';
            let payload = null;
            try { payload = JSON.parse(last); } catch (_) { /* 忽略 */ }

            if (code === 0 && payload && payload.status === 'done') {
                notify(path.basename(file), 'done');
            } else {
                const reason = (payload && payload.error) || stderr.trim() || ('exit code ' + code);
                notify(path.basename(file), 'failed', reason);
            }
        });
    });
});

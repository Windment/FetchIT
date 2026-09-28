const { ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const ctx = require('./context');
const bilibili = require('./bilibili');
const netease = require('./netease');
const mgtv = require('./mgtv');
const folders = require('./folders');
const { createLineReader } = require('./output');

const listResolvers = [
    { name: 'bilibili', resolve: bilibili.resolveBilibiliList },
    { name: 'netease', resolve: netease.resolveNeteaseList },
    { name: 'mgtv', resolve: mgtv.resolveMgtvList }
];

const FREEZE_RETRY_MAX = 5;

function killProcessTree(proc) {
    if (!proc || proc.exitCode !== null || proc.signalCode) return;
    try {
        if (process.platform === 'win32') {
            exec(`taskkill /pid ${proc.pid} /T /F`, () => {});
        } else {
            try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) {
                proc.kill('SIGKILL');
            }
        }
    } catch (e) {
        try { proc.kill(); } catch (e2) {}
    }
}

function killTaskProcesses(task) {
    if (task.processes && task.processes.length) {
        task.processes.forEach(p => killProcessTree(p));
    } else if (task.process) {
        killProcessTree(task.process);
    }
}

function checkAllTasksDone() {
    if (ctx.completedTasks + ctx.failedTasks === ctx.totalTasks && ctx.totalTasks > 0) {
        if (ctx.failedTasks === 0) {
            ctx.mainWindow.webContents.send('show-notification', '任务完成');
        } else {
            ctx.mainWindow.webContents.send('show-notification', `任务完成，有${ctx.failedTasks}个异常`);
        }
        ctx.completedTasks = 0;
        ctx.failedTasks = 0;
        ctx.totalTasks = 0;
    }
}

ipcMain.on('add-download-task', (event, taskData) => {
    const taskId = Date.now().toString();
    const task = {
        id: taskId,
        ...taskData,
        status: 'pending',
        progress: 0,
        downloadedVideos: 0,
        totalVideos: 1,
        processes: []
    };

    ctx.downloadTasks.push(task);
    ctx.totalTasks++;
    event.reply('task-added', task);

    if (task.mode === 'list') {
        parsePlaylist(task).catch((e) => {
            failPlaylist(task, '解析列表失败');
        });
    } else {
        fetchVideoInfo(task);
        processQueue();
    }
});

ipcMain.on('fetch-video-info', (event, url) => {
    fetchVideoInfoByUrl(url);
});

ipcMain.on('cancel-all-tasks', (event) => {
    ctx.downloadTasks.forEach(task => {
        task.status = 'cancelled';
        killTaskProcesses(task);
    });
    ctx.downloadTasks = [];
    ctx.activeDownloads = 0;
    event.reply('all-tasks-cancelled');
});

ipcMain.on('remove-task', (event, taskId) => {
    const taskIndex = ctx.downloadTasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
        const task = ctx.downloadTasks[taskIndex];
        task.status = 'cancelled';
        killTaskProcesses(task);
        ctx.downloadTasks.splice(taskIndex, 1);
        event.reply('task-removed', taskId);
    }
});

ipcMain.on('confirm-list-selection', (event, data) => {
    const task = ctx.downloadTasks.find(t => t.id === data.id);
    if (task) {
        task.selectedUrls = data.selectedUrls || [];
        task.addIndexPrefix = !!data.addIndexPrefix;
        task.totalVideos = task.selectedUrls.length;
        task.status = 'pending';
        processQueue();
    }
});

ipcMain.on('get-queue-count', (event) => {
    const queueCount = ctx.downloadTasks.filter(t => t.status === 'pending').length;
    event.reply('queue-count', queueCount);
});

function processQueue() {
    const pendingTasks = ctx.downloadTasks.filter(t => t.status === 'pending');

    if (pendingTasks.length === 0) return;

    const availableSlots = ctx.settings.maxConcurrentTasks - ctx.activeDownloads;
    if (availableSlots <= 0) return;

    const listTasks = pendingTasks.filter(t => t.mode === 'list');
    const normalTasks = pendingTasks.filter(t => t.mode !== 'list');

    if (listTasks.length > 0) {
        startListDownload(listTasks[0]);
        return;
    }

    const tasksToStart = normalTasks.slice(0, availableSlots);

    tasksToStart.forEach(task => {
        startDownload(task);
    });
}

function startDownload(task) {
    task.status = 'downloading';
    ctx.activeDownloads++;

    if (task.type === 'direct') {
        startDirectDownload(task);
    } else {
        let args = buildYtdlpArgs(task, ctx.ffmpegPath);

        task.lastProgressTime = Date.now();
        task.progress = 0;

        const process = spawn(ctx.ytdlpPath, args, {
            cwd: ctx.settings.savePath
        });

        task.process = process;

        const freezeCheckInterval = setInterval(() => {
            if (task.status !== 'downloading' || !ctx.settings.progressFreezeRetry?.enabled) return;

            const elapsed = (Date.now() - (task.lastProgressTime || Date.now())) / 1000;
            const freezeThreshold = ctx.settings.progressFreezeRetry?.value || 180;
            if (elapsed <= freezeThreshold) return;

            clearInterval(freezeCheckInterval);
            task.freezeRetrying = (task.retryCount || 0) < FREEZE_RETRY_MAX;
            killProcessTree(task.process);
        }, 5000);

        let errorOutput = '';

        const stdoutReader = createLineReader((line) => parseProgress(task, line));
        const stderrReader = createLineReader((line) => {
            errorOutput += line + '\n';
            parseProgress(task, line);
        });

        process.stdout.on('data', (data) => stdoutReader.write(data));

        process.stderr.on('data', (data) => stderrReader.write(data));

        process.on('close', (code) => {
            clearInterval(freezeCheckInterval);
            stdoutReader.flush();
            stderrReader.flush();
            ctx.activeDownloads = Math.max(0, ctx.activeDownloads - 1);

            if (task.freezeRetrying) {
                task.freezeRetrying = false;
                task.status = 'pending';
                task.retryCount = (task.retryCount || 0) + 1;
                if (ctx.mainWindow) {
                    ctx.mainWindow.webContents.send('task-retry', { id: task.id, retryCount: task.retryCount });
                }
                processQueue();
                return;
            }

            if (code === 0) {
                task.status = 'completed';
                ctx.completedTasks++;
                if (ctx.mainWindow) {
                    ctx.mainWindow.webContents.send('task-completed', task.id);
                }
            } else {
                task.status = 'failed';
                ctx.failedTasks++;
                if (ctx.mainWindow) {
                    ctx.mainWindow.webContents.send('task-failed', {
                        taskId: task.id,
                        error: errorOutput,
                        title: task.title,
                        url: task.url
                    });
                }
            }

            ctx.downloadTasks = ctx.downloadTasks.filter(t => t.id !== task.id);

            checkAllTasksDone();

            processQueue();
        });
    }
}

function startListDownload(task) {
    task.selectedUrls = Array.isArray(task.selectedUrls) ? task.selectedUrls : [];

    if (task.selectedUrls.length === 0) {
        const skippedVip = (task.listItems || []).filter((item) => item.vip).length;
        failPlaylist(task, skippedVip > 0
            ? `没有可下载的条目：${skippedVip} 项都需要会员，请先在高级设置里配置该平台的 cookies`
            : '没有可下载的条目');
        return;
    }

    task.outputDir = prepareCollectionDir(task);

    task.status = 'downloading';
    task.downloadedVideos = 0;
    task.totalVideos = task.selectedUrls.length;
    task.subQueue = [...task.selectedUrls];
    task.activeSubTasks = 0;
    task.completedSubTasks = 0;
    task.failedSubTasks = 0;
    task.processes = [];

    const initialCount = Math.min(1, task.subQueue.length);
    for (let i = 0; i < initialCount; i++) {
        startListSubTask(task);
    }
}

function prepareCollectionDir(task) {
    if (ctx.settings.collectionFolderEnabled === false) return '';

    try {
        const dir = folders.resolveCollectionDir(
            ctx.settings.savePath,
            task.title,
            task.url,
            ctx.collectionFoldersFile
        );
        return dir;
    } catch (e) {
        return '';
    }
}

function startListSubTask(task) {
    if (task.status !== 'downloading') return;

    const videoUrl = task.subQueue.shift();
    if (!videoUrl) {
        maybeFinishListTask(task);
        return;
    }

    task.activeSubTasks++;
    ctx.activeDownloads++;

    const itemIndex = task.itemIndexMap ? task.itemIndexMap.get(videoUrl) : undefined;
    const filePrefix = task.addIndexPrefix
        ? folders.buildEpisodePrefix(itemIndex, task.totalVideos)
        : '';

    const subTask = { ...task, mode: 'normal', url: videoUrl, filePrefix };
    const args = buildYtdlpArgs(subTask, ctx.ffmpegPath);

    const proc = spawn(ctx.ytdlpPath, args, {
        cwd: ctx.settings.savePath
    });
    task.processes.push(proc);

    let errorOutput = '';

    let lastOutputAt = Date.now();
    const freezeCheck = setInterval(() => {
        if (task.status !== 'downloading' || !ctx.settings.progressFreezeRetry?.enabled) return;
        const threshold = ctx.settings.progressFreezeRetry?.value || 180;
        if ((Date.now() - lastOutputAt) / 1000 <= threshold) return;
        clearInterval(freezeCheck);
        task.frozenItems = (task.frozenItems || 0) + 1;
        killProcessTree(proc);
    }, 5000);

    const stdoutReader = createLineReader((line) => {
        lastOutputAt = Date.now();
        const fileNameMatch = line.match(/\[.*\]\s*Downloading\s*\"([^\"]+)\"/);
        if (fileNameMatch && !task.title) {
            task.title = fileNameMatch[1];
            if (ctx.mainWindow) {
                ctx.mainWindow.webContents.send('update-task-info', {
                    id: task.id,
                    title: task.title
                });
            }
        }
    });

    const stderrReader = createLineReader((line) => {
        lastOutputAt = Date.now();
        errorOutput += line + '\n';
    });

    proc.stdout.on('data', (data) => stdoutReader.write(data));

    proc.stderr.on('data', (data) => stderrReader.write(data));

    proc.on('close', (code) => {
        clearInterval(freezeCheck);
        stdoutReader.flush();
        stderrReader.flush();
        task.activeSubTasks--;
        task.processes = task.processes.filter(p => p !== proc);

        ctx.activeDownloads = Math.max(0, ctx.activeDownloads - 1);

        if (task.status === 'cancelled') {
            return;
        }

        if (code === 0) {
            task.completedSubTasks++;
        } else {
            task.failedSubTasks++;
        }
        task.downloadedVideos = task.completedSubTasks + task.failedSubTasks;

        if (ctx.mainWindow) {
            ctx.mainWindow.webContents.send('task-list-progress', {
                id: task.id,
                downloaded: task.downloadedVideos,
                total: task.totalVideos
            });
        }

        if (task.subQueue.length > 0) {
            startListSubTask(task);
        }
        maybeFinishListTask(task);
        processQueue();
    });
}

function maybeFinishListTask(task) {
    if (task.status !== 'downloading') return;
    if (task.activeSubTasks > 0 || task.subQueue.length > 0) return;

    if (task.failedSubTasks === 0) {
        task.status = 'completed';
        ctx.completedTasks++;
        if (ctx.mainWindow) {
            ctx.mainWindow.webContents.send('task-completed', task.id);
        }
    } else {
        task.status = 'failed';
        ctx.failedTasks++;
        if (ctx.mainWindow) {
            ctx.mainWindow.webContents.send('task-failed', {
                taskId: task.id,
                error: `有 ${task.failedSubTasks} 个视频下载失败`,
                title: task.title,
                url: task.url
            });
        }
    }

    ctx.downloadTasks = ctx.downloadTasks.filter(t => t.id !== task.id);

    checkAllTasksDone();
}

function startDirectDownload(task) {
    const segments = task.segments || 64;
    const args = [
        '-x', '128',
        '-s', segments.toString(),
        '--conf-path', path.join(ctx.utilsPath, 'aria2.conf'),
        '-d', ctx.settings.savePath
    ];

    if (ctx.settings.forceIpv4 === 'ipv4') {
        args.push('--ipv4');
    } else if (ctx.settings.forceIpv4 === 'ipv6') {
        args.push('--ipv6');
    }

    if (task.userAgent) {
        args.push('--header', `User-Agent: ${task.userAgent}`);
    }

    if (task.cookie) {
        args.push('--header', `Cookie: ${task.cookie}`);
    }

    if (task.referer) {
        args.push('--referer', task.referer);
    }

    args.push(task.url);

    const process = spawn(ctx.aria2cPath, args);

    task.process = process;

    let errorOutput = '';

    const stdoutReader = createLineReader((line) => parseDirectProgress(task, line));
    const stderrReader = createLineReader((line) => {
        errorOutput += line + '\n';
        parseDirectProgress(task, line);
    });

    process.stdout.on('data', (data) => stdoutReader.write(data));

    process.stderr.on('data', (data) => stderrReader.write(data));

    process.on('close', (code) => {
        stdoutReader.flush();
        stderrReader.flush();
        ctx.activeDownloads--;

        if (code === 0 && task.status !== 'completed') {
            task.status = 'completed';
            ctx.completedTasks++;
            if (ctx.mainWindow) {
                ctx.mainWindow.webContents.send('task-completed', task.id);
            }
        } else if (code !== 0 && task.status !== 'failed') {
            task.status = 'failed';
            ctx.failedTasks++;
            if (ctx.mainWindow) {
                ctx.mainWindow.webContents.send('task-failed', {
                    taskId: task.id,
                    error: errorOutput,
                    title: task.title || task.url,
                    url: task.url
                });
            }
        }

        ctx.downloadTasks = ctx.downloadTasks.filter(t => t.id !== task.id);

        checkAllTasksDone();

        processQueue();
    });
}

function parseDirectProgress(task, output) {
    const progressMatch = output.match(/\[(#[0-9a-fA-F]+)\s+([0-9.]+[KMG]iB)\/([0-9.]+[KMG]iB)\((\d+\.?\d*)%\)/);
    if (progressMatch) {
        const progress = parseFloat(progressMatch[4]);
        const downloaded = progressMatch[2];
        const total = progressMatch[3];

        if (progress > 0 && ctx.mainWindow) {
            task.progress = progress;
            task.downloaded = downloaded;
            task.total = total;
            ctx.mainWindow.webContents.send('task-progress', { id: task.id, progress: task.progress, downloaded: downloaded, total: total });
        }
    }

    const etaMatch = output.match(/ETA:([^\]]+)/);
    if (etaMatch) {
        task.eta = etaMatch[1];
        if (ctx.mainWindow) {
            ctx.mainWindow.webContents.send('task-eta', { id: task.id, eta: task.eta });
        }
    }

    const fileNameMatch = output.match(/\[.*\]\s*Downloading\s*\"([^\"]+)\"/);
    if (fileNameMatch && !task.title) {
        task.title = fileNameMatch[1];
        if (ctx.mainWindow) {
            ctx.mainWindow.webContents.send('update-task-info', {
                id: task.id,
                title: task.title
            });
        }
    }

    const completedMatch = output.includes('Download complete:');
    if (completedMatch && task.status !== 'completed') {
        task.status = 'completed';
        ctx.completedTasks++;
        if (ctx.mainWindow) {
            ctx.mainWindow.webContents.send('task-completed', task.id);
        }

        checkAllTasksDone();
    }
}

function buildCommonArgs(task) {
    const args = [];

    args.push('--encoding', 'utf-8');

    if (ctx.settings.forceIpv4 === 'ipv4') {
        args.push('--force-ipv4');
    } else if (ctx.settings.forceIpv4 === 'ipv6') {
        args.push('--force-ipv6');
    }

    if (task.cookies && task.cookies.enabled && task.cookies.path) {
        args.push('--cookies', task.cookies.path);
    }

    if (ctx.settings.proxy.enabled && ctx.settings.proxy.value) {
        args.push('--proxy', ctx.settings.proxy.value);
    }

    if (task.customHeaders && task.customHeaders.enabled && task.customHeaders.value) {
        args.push('--add-header', task.customHeaders.value);
    }

    return args;
}

function buildYtdlpArgs(task, ffmpegPath) {
    let args = [];

    args.push('--ffmpeg-location', ffmpegPath);
    args.push('--concurrent-fragments', ctx.settings.concurrency.toString());
    args.push('--no-warning');

    args.push(...buildCommonArgs(task));

    if (ctx.settings.requestInterval > 0) {
        args.push('--sleep-interval', ctx.settings.requestInterval.toString());
    }

    if (ctx.settings.retries !== undefined && ctx.settings.retries >= 0) {
        args.push('--retries', ctx.settings.retries.toString());
    }

    if (ctx.settings.bufferSize !== undefined && ctx.settings.bufferSize >= 0) {
        args.push('--buffer-size', ctx.settings.bufferSize.toString() + 'K');
    }

    if (ctx.settings.rateLimit.enabled) {
        args.push('--limit-rate', ctx.settings.rateLimit.value);
    }

    const url = task.url;
    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('m.youtube.com')) {
        args.push('--remote-components', 'ejs:github');
        if (ctx.settings.denoRuntimeEnabled) {
            const denoPath = path.join(ctx.utilsPath, 'deno' + (process.platform === 'win32' ? '.exe' : ''));
            args.push('--js-runtimes', `deno:${denoPath}`);
        } else {
            args.push('--no-js-runtimes');
        }
    }

    args.push('--no-playlist');

    const fileName = (task.filePrefix || '') + '%(title)s.%(ext)s';
    if (task.outputDir) {
        args.push('--output', path.join(task.outputDir, fileName));
    } else {
        args.push('--output', fileName);
    }

    if (task.saveThumbnail) {
        args.push('--write-thumbnail');
        args.push('--convert-thumbnails', task.thumbnailFormat || 'jpg');
    }

    const format = task.format;
    const codecPref = task.codecPreference || 'default';
    const videoCodec = task.videoCodec || 'avc';
    const audioCodec = task.audioCodec || 'aac';
    const qualityPref = task.qualityPreference || 'best';
    const qualityRes = task.qualityResolution || '';
    const qualityFps = task.qualityFps || '';
    const qualityAudio = task.qualityAudio || '';

    let codecSort = '';
    if (codecPref === 'compatible') {
        codecSort = '+codec:avc:aac';
    } else if (codecPref === 'custom') {
        codecSort = `+codec:${videoCodec}:${audioCodec}`;
    }

    if (format !== 'original') {
        const audioFormats = ['mp3', 'm4a', 'wav', 'flac'];
        if (audioFormats.includes(format.toLowerCase())) {
            args.push('-x', '--audio-format', format.toLowerCase());
        } else {
            if (codecSort) args.push('--format-sort', codecSort);
            args.push('--remux-video', format.toLowerCase());
        }
    } else {
        if (codecSort) args.push('--format-sort', codecSort);
    }

    if (qualityPref === 'worst') {
        args.push('-f', 'worstvideo+worstaudio/worst*');
    } else if (qualityPref === 'custom') {
        const sortKeys = [];
        if (qualityRes) sortKeys.push(`res~${qualityRes}`);
        if (qualityFps) sortKeys.push(`fps~${qualityFps}`);
        if (qualityAudio) sortKeys.push(`abr~${qualityAudio}`);
        if (sortKeys.length) args.push('-S', sortKeys.join(','));
    }

    args.push(task.url);

    return args;
}

function parseProgress(task, output) {
    const progressMatch = output.match(/\[download\]\s*(\d+\.?\d*)%/);
    if (progressMatch) {
        const progress = parseFloat(progressMatch[1]);
        if (progress > 0 && ctx.mainWindow) {
            const now = Date.now();
            if (task.progress !== progress) {
                task.progress = progress;
                task.lastProgressTime = now;
                ctx.mainWindow.webContents.send('task-progress', { id: task.id, progress: task.progress });
            }
        }
    }
}

function fetchVideoInfo(task) {
    const args = [
        '--dump-json',
        '--no-playlist',
        ...buildCommonArgs(task),
        task.url
    ];

    const process = spawn(ctx.ytdlpPath, args);

    let output = '';

    const stdoutReader = createLineReader((line) => {
        output += line + '\n';
    });

    process.stdout.on('data', (data) => stdoutReader.write(data));

    process.on('close', (code) => {
        stdoutReader.flush();
        if (code === 0 && output.trim()) {
            try {
                const info = JSON.parse(output);
                const videoInfo = {
                    id: task.id,
                    title: info.title || '',
                    author: info.uploader || info.channel || '',
                    duration: formatDuration(info.duration) || '',
                    thumbnail: info.thumbnail || ''
                };
                ctx.mainWindow.webContents.send('update-task-info', videoInfo);
            } catch (e) {
            }
        }
    });
}

async function parsePlaylist(task) {
    const cookiePath = task.cookies && task.cookies.enabled ? task.cookies.path : '';

    let result = null;

    for (const resolver of listResolvers) {
        try {
            const resolved = await resolver.resolve(task.url, cookiePath);
            if (resolved && resolved.items && resolved.items.length) {
                result = resolved;
                break;
            }
        } catch (e) {
        }
    }

    if (result) {
        handlePlaylistParsed(task, result);
        return;
    }

    parsePlaylistWithYtdlp(task);
}

function failPlaylist(task, message) {
    if (!ctx.downloadTasks.some(t => t.id === task.id)) return;

    task.status = 'failed';
    ctx.failedTasks++;
    if (ctx.mainWindow) {
        ctx.mainWindow.webContents.send('task-failed', {
            taskId: task.id,
            error: message,
            title: task.title,
            url: task.url
        });
    }
    ctx.downloadTasks = ctx.downloadTasks.filter(t => t.id !== task.id);
    checkAllTasksDone();
    processQueue();
}

function handlePlaylistParsed(task, { title, cover, kind, vipLocked, items }) {
    task.listItems = items;
    task.totalVideos = items.length;
    task.title = title || task.title || '播放列表';
    task.listKind = kind || 'video';
    task.vipLocked = !!vipLocked;
    if (cover) task.cover = cover;

    task.itemIndexMap = new Map();
    items.forEach((item, index) => {
        if (item && item.url && !task.itemIndexMap.has(item.url)) {
            task.itemIndexMap.set(item.url, index);
        }
    });

    if (!items.length) {
        failPlaylist(task, '列表中未找到可下载的视频');
        return;
    }

    const skippedVip = task.vipLocked ? items.filter((item) => item.vip).length : 0;

    if (ctx.mainWindow) {
        ctx.mainWindow.webContents.send('update-task-info', {
            id: task.id,
            title: task.title,
            cover: task.cover || '',
            kind: task.listKind,
            vipLocked: task.vipLocked,
            totalVideos: items.length
        });
        ctx.mainWindow.webContents.send('playlist-parsed', {
            id: task.id,
            title: task.title,
            cover: task.cover || '',
            kind: task.listKind,
            vipLocked: task.vipLocked,
            skippedVip: skippedVip,
            items: items
        });
    }

    if (task.listSelectMode === 'manual') {
        task.status = 'pending-selection';
        return;
    }

    if (skippedVip > 0 && ctx.mainWindow) {
        ctx.mainWindow.webContents.send('show-notification',
            `已跳过 ${skippedVip} 个会员条目（未配置该平台 cookies）`);
    }

    task.selectedUrls = items
        .filter((item) => !(task.vipLocked && item.vip))
        .map((item) => item.url);
    processQueue();
}

function parsePlaylistWithYtdlp(task) {
    const args = [
        '--dump-json',
        '--flat-playlist',
        ...buildCommonArgs(task),
        task.url
    ];

    const process = spawn(ctx.ytdlpPath, args);

    let output = '';
    let errorOutput = '';

    const stdoutReader = createLineReader((line) => {
        output += line + '\n';
    });

    const stderrReader = createLineReader((line) => {
        errorOutput += line + '\n';
    });

    process.stdout.on('data', (data) => stdoutReader.write(data));

    process.stderr.on('data', (data) => stderrReader.write(data));

    process.on('close', (code) => {
        stdoutReader.flush();
        stderrReader.flush();

        if (code !== 0 || !output.trim()) {
            failPlaylist(task, '解析列表失败');
            return;
        }

        try {
            const lines = output.trim().split('\n');
            const items = [];
            let playlistTitle = '';
            let playlistThumbnail = '';

            lines.forEach(line => {
                try {
                    const entry = JSON.parse(line);
                    const url = entry.url || entry.webpage_url || entry.original_url || '';
                    const title = entry.title || '';
                    const thumbnail = extractThumbnail(entry);
                    if (!playlistThumbnail && thumbnail) {
                        playlistThumbnail = thumbnail;
                    }
                    if (url) {
                        items.push({ url, title, thumbnail });
                    }
                    if (!playlistTitle) {
                        playlistTitle = entry.playlist_title || entry.title || '';
                    }
                } catch (e) {}
            });

            items.forEach(item => {
                if (!item.thumbnail) {
                    item.thumbnail = playlistThumbnail;
                }
            });

            handlePlaylistParsed(task, {
                title: playlistTitle || task.title || '播放列表',
                cover: playlistThumbnail,
                items: items
            });
        } catch (e) {
            failPlaylist(task, '解析列表失败');
        }
    });
}

function extractThumbnail(entry) {
    if (entry.thumbnail) return entry.thumbnail;
    if (entry.thumbnails && entry.thumbnails.length) {
        const last = entry.thumbnails[entry.thumbnails.length - 1];
        return last.url || '';
    }
    return '';
}

function fetchVideoInfoByUrl(url) {
    const args = [
        '--dump-json',
        '--no-playlist',
        url
    ];

    const process = spawn(ctx.ytdlpPath, args);

    let output = '';

    const stdoutReader = createLineReader((line) => {
        output += line + '\n';
    });

    process.stdout.on('data', (data) => stdoutReader.write(data));

    process.on('close', (code) => {
        stdoutReader.flush();
        if (code === 0 && output.trim()) {
            try {
                const info = JSON.parse(output);
                const videoInfo = {
                    title: info.title || '',
                    author: info.uploader || info.channel || '',
                    duration: formatDuration(info.duration) || '',
                    thumbnail: info.thumbnail || ''
                };
            } catch (e) {
            }
        }
    });
}

function formatDuration(seconds) {
    if (!seconds) return '';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

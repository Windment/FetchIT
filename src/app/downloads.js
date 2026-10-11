const { ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const log = require('./logger');
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

//容量统一按 MB（兆字节）换算，兼容二进制（KiB/MiB）与十进制（KB/MB）单位
const SIZE_UNITS_MB = {
    'B': 1 / 1000000,
    'KB': 1 / 1000,
    'MB': 1,
    'GB': 1000,
    'TB': 1000000,
    'KiB': 1024 / 1000000,
    'MiB': 1.048576,
    'GiB': 1073.741824,
    'TiB': 1099511.627776
};

function toMB(value, unit) {
    const factor = SIZE_UNITS_MB[unit];
    if (!factor) return 0;
    return (parseFloat(value) || 0) * factor;
}

function killProcessTree(proc) {
    if (!proc || proc.exitCode !== null || proc.signalCode) return;
    try {
        if (process.platform === 'win32') {
            exec(`taskkill /pid ${proc.pid} /T /F`, (err) => {
                if (err) {
                    try { proc.kill(); } catch (e) {}
                }
            });
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
            log.info('downloads', `全部任务完成（共 ${ctx.totalTasks} 个）`);
        } else {
            ctx.mainWindow.webContents.send('show-notification', `任务完成，有${ctx.failedTasks}个异常`);
            log.warn('downloads', `全部任务完成，但有 ${ctx.failedTasks} 个异常（共 ${ctx.totalTasks} 个）`);
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
    log.info('downloads', `添加任务 #${taskId}（模式：${task.mode}）：${task.url || ''}`);
    event.reply('task-added', task);

    if (task.mode === 'list') {
        parsePlaylist(task).catch((e) => {
            log.error('downloads', `任务 #${taskId} 列表解析异常：`, e);
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
    log.warn('downloads', `用户取消全部任务（${ctx.downloadTasks.length} 个）`);
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
        log.info('downloads', `删除任务 #${taskId}（${task.title || task.url || ''}）`);
        event.reply('task-removed', taskId);
    }
});

ipcMain.on('pause-task', (event, taskId) => {
    const task = ctx.downloadTasks.find(t => t.id === taskId);
    if (!task || task.status !== 'downloading') {
        if (task && task.status === 'pending') {
            task.status = 'paused';
            sendTaskStatus(task, 'paused');
            log.info('downloads', `任务 #${taskId} 已在队列中暂停`);
        }
        return;
    }
    task.status = 'paused';
    task.currentItemSpeedMBs = 0;
    task.freezeRetrying = false;
    killTaskProcesses(task);
    sendTaskStatus(task, 'paused');
    sendTaskProgress(task);
    log.info('downloads', `任务 #${taskId} 已暂停（${task.title || task.url || ''}）`);
});

ipcMain.on('resume-task', (event, taskId) => {
    const task = ctx.downloadTasks.find(t => t.id === taskId);
    if (!task || task.status !== 'paused') return;

    log.info('downloads', `任务 #${taskId} 继续下载（${task.title || task.url || ''}）`);
    if (task.mode === 'list' && Array.isArray(task.subQueue)) {
        task.status = 'downloading';
        task.activeSubTasks = Math.max(0, task.activeSubTasks || 0);
        const start = Math.min(1, task.subQueue.length);
        for (let i = 0; i < start; i++) {
            startListSubTask(task);
        }
        sendTaskStatus(task, 'downloading');
        sendTaskProgress(task);
        return;
    }

    task.status = 'pending';
    task.progress = task.progress || 0;
    sendTaskStatus(task, 'pending');
    processQueue();
});

ipcMain.on('confirm-list-selection', (event, data) => {
    const task = ctx.downloadTasks.find(t => t.id === data.id);
    if (task) {
        task.selectedUrls = data.selectedUrls || [];
        task.addIndexPrefix = !!data.addIndexPrefix;
        task.totalVideos = task.selectedUrls.length;
        task.status = 'pending';
        task.completedSizeMB = 0;
        task.currentItemTotalMB = 0;
        task.currentItemSpeedMBs = 0;
        log.info('downloads', `任务 #${task.id} 确认选择 ${task.selectedUrls.length} 项，开始下载`);
        processQueue();
    }
});

ipcMain.on('get-queue-count', (event) => {
    const queueCount = ctx.downloadTasks.filter(t => t.status === 'pending').length;
    event.reply('queue-count', queueCount);
});

function sendTaskStatus(task, status) {
    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('task-status', { id: task.id, status });
    }
}

function sendTaskProgress(task) {
    if (!ctx.mainWindow || ctx.mainWindow.isDestroyed()) return;
    if (task.mode === 'list') {
        const totalMB = (task.completedSizeMB || 0) + (task.currentItemTotalMB || 0);
        ctx.mainWindow.webContents.send('task-list-progress', {
            id: task.id,
            downloaded: task.downloadedVideos || 0,
            total: task.totalVideos || 0,
            //整体进度 = (已完成集数 + 当前集的分数进度) / 总集数，保证进度条实时推进
            progress: computeListOverallProgress(task),
            downloadedMB: round2(task.downloadedSizeMB || 0),
            totalMB: round2(totalMB),
            speedMBs: round2(task.currentItemSpeedMBs || 0),
            currentItemProgress: round2(task.currentItemProgress || 0)
        });
    } else {
        ctx.mainWindow.webContents.send('task-progress', {
            id: task.id,
            progress: task.progress || 0,
            downloadedMB: round2(task.downloadedMB || 0),
            totalMB: round2(task.totalMB || 0),
            speedMBs: round2(task.speedMBs || 0)
        });
    }
}

//列表任务整体进度：每个分集贡献 1/total，当前分集按字节进度折算其中一部分
function computeListOverallProgress(task) {
    const total = task.totalVideos || 0;
    if (total <= 0) return 0;
    const downloaded = task.downloadedVideos || 0;
    const currentFrac = Math.max(0, Math.min(1, (task.currentItemProgress || 0) / 100));
    return Math.min(100, ((downloaded + currentFrac) / total) * 100);
}

function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

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
        task.progress = task.progress || 0;
        task.downloadedMB = 0;
        task.totalMB = 0;
        task.speedMBs = 0;

        log.info('downloads', `任务 #${task.id} 开始下载（yt-dlp）`);
        log.debug('downloads', `任务 #${task.id} yt-dlp 参数：${args.join(' ')}`);

        const process = spawn(ctx.ytdlpPath, args, {
            cwd: ctx.settings.savePath
        });

        task.process = process;

        const freezeCheckInterval = setInterval(() => {
            if (task.status !== 'downloading' || !ctx.settings.progressFreezeRetry?.enabled) return;

            const elapsed = (Date.now() - (task.lastProgressTime || Date.now())) / 1000;
            const freezeThreshold = ctx.settings.progressFreezeRetry?.value || 180;
            if (elapsed <= freezeThreshold) return;

            log.warn('downloads', `任务 #${task.id} 进度冻结超过 ${freezeThreshold} 秒，自动重试`);
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

        process.on('error', (err) => {
            log.error('downloads', `任务 #${task.id} yt-dlp 进程启动失败：`, err);
        });

        process.on('close', (code) => {
            clearInterval(freezeCheckInterval);
            stdoutReader.flush();
            stderrReader.flush();

            //暂停/删除时不判定为失败，也不重复计数
            if (task.status === 'paused' || task.status === 'cancelled') {
                task.freezeRetrying = false;
                ctx.activeDownloads = Math.max(0, ctx.activeDownloads - 1);
                return;
            }

            ctx.activeDownloads = Math.max(0, ctx.activeDownloads - 1);

            if (task.freezeRetrying) {
                task.freezeRetrying = false;
                task.status = 'pending';
                task.retryCount = (task.retryCount || 0) + 1;
                log.info('downloads', `任务 #${task.id} 第 ${task.retryCount} 次冻结重试`);
                if (ctx.mainWindow) {
                    ctx.mainWindow.webContents.send('task-retry', { id: task.id, retryCount: task.retryCount });
                }
                processQueue();
                return;
            }

            if (code === 0) {
                task.status = 'completed';
                ctx.completedTasks++;
                log.info('downloads', `任务 #${task.id} 下载完成：${task.title || task.url || ''}`);
                if (ctx.mainWindow) {
                    ctx.mainWindow.webContents.send('task-completed', task.id);
                }
            } else {
                task.status = 'failed';
                ctx.failedTasks++;
                log.error('downloads', `任务 #${task.id} 下载失败（退出码 ${code}）：${task.title || task.url || ''}\n${log.maskSensitive(errorOutput.slice(-2000))}`);
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
    task.completedSizeMB = 0;
    task.currentItemTotalMB = 0;
    task.currentItemSpeedMBs = 0;
    task.processes = [];

    log.info('downloads', `列表任务 #${task.id} 开始：共 ${task.totalVideos} 集（${task.title || ''}）`);

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
        log.warn('downloads', `任务 #${task.id} 分集目录创建失败：`, e);
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

    log.debug('downloads', `列表任务 #${task.id} 下载分集：${videoUrl}`);

    const proc = spawn(ctx.ytdlpPath, args, {
        cwd: ctx.settings.savePath
    });
    task.processes.push(proc);

    let errorOutput = '';
    let subLastTotalMB = 0;

    let lastOutputAt = Date.now();
    const freezeCheck = setInterval(() => {
        if (task.status !== 'downloading' || !ctx.settings.progressFreezeRetry?.enabled) return;
        const threshold = ctx.settings.progressFreezeRetry?.value || 180;
        if ((Date.now() - lastOutputAt) / 1000 <= threshold) return;
        log.warn('downloads', `列表任务 #${task.id} 分集进度冻结，跳过当前项`);
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
        const subProgress = parseYtdlpLine(line);
        if (subProgress) {
            if (subProgress.totalMB) {
                subLastTotalMB = subProgress.totalMB;
                task.currentItemTotalMB = subProgress.totalMB;
            }
            if (subProgress.speedMBs !== undefined) {
                task.currentItemSpeedMBs = subProgress.speedMBs;
            }
            if (subProgress.progress !== undefined) {
                task.currentItemProgress = subProgress.progress;
            }
            task.downloadedSizeMB = (task.completedSizeMB || 0) +
                (subProgress.totalMB ? subProgress.totalMB * (subProgress.progress || 0) / 100 : 0);
            sendTaskProgress(task);
        }
    });

    const stderrReader = createLineReader((line) => {
        lastOutputAt = Date.now();
        errorOutput += line + '\n';
    });

    proc.stdout.on('data', (data) => stdoutReader.write(data));

    proc.stderr.on('data', (data) => stderrReader.write(data));

    proc.on('error', (err) => {
        log.error('downloads', `列表任务 #${task.id} 分集进程启动失败：`, err);
    });

    proc.on('close', (code) => {
        clearInterval(freezeCheck);
        stdoutReader.flush();
        stderrReader.flush();
        task.activeSubTasks--;
        task.processes = task.processes.filter(p => p !== proc);

        ctx.activeDownloads = Math.max(0, ctx.activeDownloads - 1);

        if (task.status === 'cancelled' || task.status === 'paused') {
            return;
        }

        if (code === 0) {
            task.completedSubTasks++;
            task.completedSizeMB = (task.completedSizeMB || 0) + subLastTotalMB;
            log.debug('downloads', `列表任务 #${task.id} 分集完成（累计 ${task.completedSubTasks}/${task.totalVideos}）`);
        } else {
            task.failedSubTasks++;
            log.warn('downloads', `列表任务 #${task.id} 分集失败（退出码 ${code}）：${videoUrl}\n${log.maskSensitive(errorOutput.slice(-1500))}`);
        }
        task.downloadedVideos = task.completedSubTasks + task.failedSubTasks;
        task.currentItemTotalMB = 0;
        task.currentItemSpeedMBs = 0;
        task.currentItemProgress = 0;
        task.downloadedSizeMB = task.completedSizeMB || 0;

        if (ctx.mainWindow) {
            sendTaskProgress(task);
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
        log.info('downloads', `列表任务 #${task.id} 全部完成：${task.title || ''}（共 ${task.totalVideos} 集）`);
        if (ctx.mainWindow) {
            ctx.mainWindow.webContents.send('task-completed', task.id);
        }
    } else {
        task.status = 'failed';
        ctx.failedTasks++;
        log.warn('downloads', `列表任务 #${task.id} 结束：${task.failedSubTasks}/${task.totalVideos} 个分集失败`);
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
        '-c',
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

    log.info('downloads', `任务 #${task.id} 开始下载（aria2c 直链，${segments} 线程）`);

    const process = spawn(ctx.aria2cPath, args);

    task.process = process;
    task.downloadedMB = 0;
    task.totalMB = 0;
    task.speedMBs = 0;

    let errorOutput = '';

    const stdoutReader = createLineReader((line) => parseDirectProgress(task, line));
    const stderrReader = createLineReader((line) => {
        errorOutput += line + '\n';
        parseDirectProgress(task, line);
    });

    process.stdout.on('data', (data) => stdoutReader.write(data));

    process.stderr.on('data', (data) => stderrReader.write(data));

    process.on('error', (err) => {
        log.error('downloads', `任务 #${task.id} aria2c 进程启动失败：`, err);
    });

    process.on('close', (code) => {
        stdoutReader.flush();
        stderrReader.flush();

        if (task.status === 'paused' || task.status === 'cancelled') {
            ctx.activeDownloads = Math.max(0, ctx.activeDownloads - 1);
            return;
        }

        ctx.activeDownloads = Math.max(0, ctx.activeDownloads - 1);

        if (code === 0 && task.status !== 'completed') {
            task.status = 'completed';
            ctx.completedTasks++;
            log.info('downloads', `直链任务 #${task.id} 下载完成：${task.title || task.url || ''}`);
            if (ctx.mainWindow) {
                ctx.mainWindow.webContents.send('task-completed', task.id);
            }
        } else if (code !== 0 && task.status !== 'failed') {
            task.status = 'failed';
            ctx.failedTasks++;
            log.error('downloads', `直链任务 #${task.id} 下载失败（退出码 ${code}）\n${log.maskSensitive(errorOutput.slice(-2000))}`);
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

function parseYtdlpLine(output) {
    const progressMatch = output.match(/\[download\]\s*(\d+\.?\d*)%\s+of\s+(?:~\s*)?([\d.]+)([KMGT]i?B)(?:\s+at\s+([\d.]+)([KMGT]i?B)\/s)?/);
    if (!progressMatch) {
        const plainMatch = output.match(/\[download\]\s*(\d+\.?\d*)%/);
        if (plainMatch) {
            return { progress: parseFloat(plainMatch[1]) };
        }
        return null;
    }
    return {
        progress: parseFloat(progressMatch[1]),
        totalMB: toMB(progressMatch[2], progressMatch[3]),
        speedMBs: progressMatch[4] ? toMB(progressMatch[4], progressMatch[5]) : undefined
    };
}

function parseDirectProgress(task, output) {
    const progressMatch = output.match(/\[(#[0-9a-fA-F]+)\s+([0-9.]+[KMG]i?B)\/([0-9.]+[KMG]i?B)\((\d+\.?\d*)%\)/);
    if (progressMatch) {
        const progress = parseFloat(progressMatch[4]);
        const sizeMatch = progressMatch[2].match(/^([\d.]+)([KMG]i?B)$/);
        const totalMatch = progressMatch[3].match(/^([\d.]+)([KMG]i?B)$/);

        if (progress > 0 && ctx.mainWindow) {
            task.progress = progress;
            task.downloadedMB = sizeMatch ? toMB(sizeMatch[1], sizeMatch[2]) : 0;
            task.totalMB = totalMatch ? toMB(totalMatch[1], totalMatch[2]) : 0;
            ctx.mainWindow.webContents.send('task-progress', {
                id: task.id,
                progress: task.progress,
                downloadedMB: round2(task.downloadedMB),
                totalMB: round2(task.totalMB),
                speedMBs: round2(task.speedMBs || 0)
            });
        }
    }

    const speedMatch = output.match(/DL:([0-9.]+)([KMG]?i?B)(?:\/s)?/);
    if (speedMatch && ctx.mainWindow) {
        task.speedMBs = toMB(speedMatch[1], speedMatch[2]);
        ctx.mainWindow.webContents.send('task-progress', {
            id: task.id,
            progress: task.progress || 0,
            downloadedMB: round2(task.downloadedMB || 0),
            totalMB: round2(task.totalMB || 0),
            speedMBs: round2(task.speedMBs)
        });
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
        log.info('downloads', `直链任务 #${task.id} 下载完成：${task.title || task.url || ''}`);
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
    const parsed = parseYtdlpLine(output);
    if (parsed && parsed.progress > 0 && ctx.mainWindow) {
        const now = Date.now();
        if (task.progress !== parsed.progress) {
            task.progress = parsed.progress;
            task.lastProgressTime = now;
            if (parsed.totalMB) {
                task.totalMB = parsed.totalMB;
                task.downloadedMB = parsed.totalMB * (parsed.progress / 100);
            }
            if (parsed.speedMBs !== undefined) {
                task.speedMBs = parsed.speedMBs;
            }
            ctx.mainWindow.webContents.send('task-progress', {
                id: task.id,
                progress: task.progress,
                downloadedMB: round2(task.downloadedMB || 0),
                totalMB: round2(task.totalMB || 0),
                speedMBs: round2(task.speedMBs || 0)
            });
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
                log.warn('downloads', `任务 #${task.id} 视频信息解析失败：`, e);
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
            log.debug('downloads', `列表解析器 ${resolver.name} 未命中：`, e && e.message);
        }
    }

    if (result) {
        log.info('downloads', `列表解析成功（${result.source || 'yt-dlp'}）：${result.title || ''}，共 ${result.items.length} 项`);
        handlePlaylistParsed(task, result);
        return;
    }

    parsePlaylistWithYtdlp(task);
}

function failPlaylist(task, message) {
    if (!ctx.downloadTasks.some(t => t.id === task.id)) return;

    task.status = 'failed';
    ctx.failedTasks++;
    log.error('downloads', `列表任务 #${task.id} 失败：${message}`);
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
        log.warn('downloads', `任务 #${task.id} 跳过 ${skippedVip} 个会员条目`);
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

    log.debug('downloads', `任务 #${task.id} 使用 yt-dlp 解析列表`);

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
            log.error('downloads', `任务 #${task.id} yt-dlp 列表解析失败（退出码 ${code}）\n${log.maskSensitive(errorOutput.slice(-1000))}`);
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
            log.error('downloads', `任务 #${task.id} 列表数据解析异常：`, e);
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
                log.debug('downloads', `链接信息预解析成功：${videoInfo.title || ''}`);
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

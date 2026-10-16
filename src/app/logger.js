'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

//级别
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const LEVEL_TAG = {
    debug: 'DEBUG',
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR'
};

//敏感字段脱敏
const SENSITIVE_KEY_RE = new RegExp(
    '(' +
    [
        'SESSDATA', 'bili_jct', 'DedeUserID__ckMd5', 'sid_tt', 'sessionid[^\\s;=&]*', 'session',
        'token[^\\s;=&]*', 'auth_token', 'ct0', 'z_c0', 'SUBP?', 'api[_-]?key', 'apikey',
        'password', 'passwd', 'pwd', 'secret[^\\s;=&]*', 'credential[^\\s;=&]*',
        'passport_csrf_token', 'csrf[^\\s;=&]*', 'cookie', 'set-cookie', 'authorization'
    ].join('|') +
    ')\\s*(=|:)\\s*([^\\s;&,\'"\\r\\n]+)',
    'gi'
);

const MIN_LEVEL = LEVELS[(process.env.FETCHIT_LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;

let logFilePath = '';
let fileWriteQueue = Promise.resolve();

function pad(n, width = 2) {
    return String(n).padStart(width, '0');
}

function sessionStamp() {
    const d = new Date();
    return (
        d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        '_' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds())
    );
}

const SESSION_STAMP = sessionStamp();

function defaultLogDir() {
    const baseDir = app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '../../');
    return path.join(baseDir, 'logs');
}

function setLogDir(dir) {
    if (!dir || typeof dir !== 'string') return;
    try {
        fs.mkdirSync(dir, { recursive: true });
        logFilePath = path.join(dir, SESSION_STAMP + '.log');
    } catch (e) {
        logFilePath = '';
    }
}

setLogDir(defaultLogDir());

function maskSensitive(text) {
    return String(text == null ? '' : text).replace(SENSITIVE_KEY_RE, (m, key, sep, value) => {
        const visible = value.length > 4 ? value.slice(0, 2) + '***' : '***';
        return key + sep + visible;
    });
}

function formatValue(value) {
    if (value == null) return '';
    if (value instanceof Error) {
        return value.stack || (value.name + ': ' + value.message);
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (e) {
            return String(value);
        }
    }
    return String(value);
}

function timestamp() {
    const d = new Date();
    return (
        d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
        '.' + pad(d.getMilliseconds(), 3)
    );
}

function write(level, moduleName, args) {
    if (LEVELS[level] < MIN_LEVEL) return;
    if (!logFilePath) return;

    const plain = args.map(formatValue).filter((s) => s !== '').join(' ');
    const message = maskSensitive(plain);
    const tag = LEVEL_TAG[level] || LEVEL_TAG.info;
    const line = '[' + timestamp() + '] [' + tag + '] [' + moduleName + '] ' + message + '\n';

    fileWriteQueue = fileWriteQueue
        .then(() => fs.promises.appendFile(logFilePath, line, 'utf8'))
        .catch(() => {});
}

const logger = {
    maskSensitive,
    getLogFilePath: () => logFilePath,
    setLogDir,
    debug: (mod, ...args) => write('debug', mod, args),
    info: (mod, ...args) => write('info', mod, args),
    warn: (mod, ...args) => write('warn', mod, args),
    error: (mod, ...args) => write('error', mod, args)
};

module.exports = logger;

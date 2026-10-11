'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

//日志级别
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const LEVEL_STYLE = {
    debug: { tag: 'DEBUG', color: '\x1b[90m' },
    info: { tag: 'INFO ', color: '\x1b[36m' },
    warn: { tag: 'WARN ', color: '\x1b[33m' },
    error: { tag: 'ERROR', color: '\x1b[31m' }
};
const RESET = '\x1b[0m';
const MODULE_COLOR = '\x1b[35m';

//敏感字段脱敏：cookie/token/密码等键值对，值只保留前 2 个字符
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

let logDirReady = false;
let logDir = '';

function ensureLogDir() {
    if (logDirReady) return;
    try {
        logDir = path.join(app.getPath('userData'), 'logs');
        fs.mkdirSync(logDir, { recursive: true });
    } catch (e) {
        logDir = '';
    }
    logDirReady = true;
}

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
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return (
        d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
        '.' + pad(d.getMilliseconds(), 3)
    );
}

function write(level, moduleName, args) {
    if (LEVELS[level] < MIN_LEVEL) return;

    const plain = args.map(formatValue).filter((s) => s !== '').join(' ');
    const message = maskSensitive(plain);
    const meta = LEVEL_STYLE[level] || LEVEL_STYLE.info;
    const time = timestamp();

    //命令行实时输出（带颜色）
    console.log(
        `${RESET}[${time}] ${meta.color}[${meta.tag}]${RESET} ${MODULE_COLOR}[${moduleName}]${RESET} ${message}`
    );

    //文件留档（无颜色，方便排查）
    try {
        ensureLogDir();
        if (logDir) {
            const file = path.join(logDir, 'fetchit-' + time.slice(0, 10) + '.log');
            fs.appendFile(file, `[${time}] [${meta.tag.trim()}] [${moduleName}] ${message}\n`, 'utf8', () => {});
        }
    } catch (e) {}
}

const logger = {
    maskSensitive,
    debug: (mod, ...args) => write('debug', mod, args),
    info: (mod, ...args) => write('info', mod, args),
    warn: (mod, ...args) => write('warn', mod, args),
    error: (mod, ...args) => write('error', mod, args)
};

module.exports = logger;

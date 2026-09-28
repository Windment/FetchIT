'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const querystring = require('querystring');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function httpRequest(targetUrl, options = {}) {
    const {
        method = 'GET',
        headers = {},
        cookie = '',
        referer = '',
        body = null,
        redirects = 5,
        timeout = 15000
    } = options;

    return new Promise((resolve, reject) => {
        let urlObj;
        try {
            urlObj = new URL(targetUrl);
        } catch (e) {
            reject(new Error('invalid url'));
            return;
        }

        const mod = urlObj.protocol === 'http:' ? http : https;
        const finalHeaders = Object.assign({
            'User-Agent': UA,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9'
        }, referer ? { Referer: referer } : {}, cookie ? { Cookie: cookie } : {}, headers);

        if (body !== null && finalHeaders['Content-Length'] === undefined) {
            finalHeaders['Content-Length'] = Buffer.byteLength(body);
        }

        const req = mod.request({
            protocol: urlObj.protocol,
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'http:' ? 80 : 443),
            path: urlObj.pathname + urlObj.search,
            method,
            headers: finalHeaders
        }, (res) => {
            const status = res.statusCode || 0;

            if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
                res.resume();
                let next;
                try {
                    next = new URL(res.headers.location, urlObj).toString();
                } catch (e) {
                    reject(new Error('bad redirect'));
                    return;
                }
                httpRequest(next, Object.assign({}, options, { redirects: redirects - 1 }))
                    .then(resolve, reject);
                return;
            }

            const chunks = [];
            let size = 0;
            res.on('data', (chunk) => {
                size += chunk.length;
                if (size > MAX_BODY_BYTES) {
                    res.destroy();
                    return;
                }
                chunks.push(chunk);
            });
            res.on('end', () => {
                resolve({
                    status,
                    headers: res.headers,
                    url: urlObj.toString(),
                    body: Buffer.concat(chunks).toString('utf8')
                });
            });
            res.on('error', reject);
        });

        req.setTimeout(timeout, () => {
            req.destroy(new Error('request timeout'));
        });
        req.on('error', reject);
        if (body !== null) req.write(body);
        req.end();
    });
}

function httpGet(url, options = {}) {
    return httpRequest(url, Object.assign({}, options, { method: 'GET' }));
}

function httpPostForm(url, form, options = {}) {
    const body = querystring.stringify(form);
    return httpRequest(url, Object.assign({}, options, {
        method: 'POST',
        body,
        headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, options.headers || {})
    }));
}

async function getJson(url, options = {}) {
    const res = await httpGet(url, options);
    if (res.status !== 200) throw new Error('HTTP ' + res.status);
    return JSON.parse(res.body);
}

async function postFormJson(url, form, options = {}) {
    const res = await httpPostForm(url, form, options);
    if (res.status !== 200) throw new Error('HTTP ' + res.status);
    return JSON.parse(res.body);
}

function normalizeImage(url) {
    if (!url) return '';
    const value = String(url).trim();
    if (value.startsWith('//')) return 'https:' + value;
    if (value.startsWith('http://')) return 'https://' + value.slice(7);
    return value;
}

function formatDuration(seconds) {
    const total = Math.floor(Number(seconds) || 0);
    if (total <= 0) return '';
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function extractCookieHeader(text, domains) {
    const pairs = [];
    const lines = String(text).split(/\r?\n/);
    let matchedNetscape = false;

    lines.forEach((line) => {
        let trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.startsWith('#HttpOnly_')) {
            trimmed = trimmed.slice('#HttpOnly_'.length);
        } else if (trimmed.startsWith('#')) {
            return;
        }

        const parts = trimmed.split('\t');
        if (parts.length >= 7) {
            matchedNetscape = true;
            const domain = parts[0].toLowerCase();
            if (domains.some((d) => domain.indexOf(d) !== -1)) {
                pairs.push(`${parts[5]}=${parts[6]}`);
            }
        }
    });

    if (!matchedNetscape) {
        String(text).split(/[;\n]/).forEach((chunk) => {
            const item = chunk.trim();
            if (!item || item.indexOf('=') === -1) return;
            const eq = item.indexOf('=');
            const name = item.slice(0, eq).trim();
            const value = item.slice(eq + 1).trim();
            if (!name || /[\s"'<>]/.test(name)) return;
            pairs.push(`${name}=${value}`);
        });
    }

    return pairs.join('; ');
}

function readCookie(cookiePath, domains) {
    if (!cookiePath) return '';
    try {
        if (!fs.existsSync(cookiePath)) return '';
        return extractCookieHeader(fs.readFileSync(cookiePath, 'utf8'), domains);
    } catch (e) {
        return '';
    }
}

module.exports = {
    UA,
    httpRequest,
    httpGet,
    httpPostForm,
    getJson,
    postFormJson,
    normalizeImage,
    formatDuration,
    extractCookieHeader,
    readCookie
};

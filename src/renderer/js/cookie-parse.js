const COOKIE_PLATFORM_DEFS = [
    {
        id: 'bilibili',
        label: '哔哩哔哩',
        domains: ['.bilibili.com'],
        match: (names) => names.has('SESSDATA') || names.has('bili_jct') || names.has('DedeUserID'),
        required: [
            { name: 'SESSDATA', desc: '登录凭证（核心）' },
            { name: 'bili_jct', desc: 'CsrfToken' },
            { name: 'DedeUserID', desc: '账号 UID' }
        ],
        optional: [
            { name: 'buvid3', desc: '设备指纹（缺失时导入会自动向 B 站申请）' },
            { name: 'buvid4', desc: '设备指纹（缺失时导入会自动向 B 站申请）' },
            { name: 'DedeUserID__ckMd5', desc: 'UID 校验值' },
            { name: 'sid', desc: '会话 ID' }
        ]
    },
    {
        id: 'youtube',
        label: 'YouTube',
        domains: ['.youtube.com'],
        match: (names) => {
            const hits = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-1PSID', '__Secure-3PSID', 'LOGIN_INFO']
                .filter((k) => names.has(k)).length;
            return hits >= 2 || names.has('LOGIN_INFO');
        },
        required: [{ name: 'SID', desc: '登录凭证（核心）' }],
        optional: [{ name: 'HSID', desc: '登录校验' }, { name: 'SSID', desc: '登录校验' }, { name: 'LOGIN_INFO', desc: '登录信息' }]
    },
    {
        id: 'douyin',
        label: '抖音',
        domains: ['.douyin.com'],
        match: (names) => names.has('sid_tt')
            || (['sessionid', 'sessionid_ss'].some((k) => names.has(k))
                && ['ttwid', 'odin_tt', 'uid_tt', 'passport_csrf_token', 'passport_csrf_token_default'].some((k) => names.has(k))),
        required: [{ name: 'sessionid', desc: '登录凭证（核心）' }],
        optional: [{ name: 'ttwid', desc: '设备指纹' }, { name: 'passport_csrf_token', desc: 'CsrfToken' }]
    },
    {
        id: 'xiaohongshu',
        label: '小红书',
        domains: ['.xiaohongshu.com'],
        match: (names) => names.has('web_session') || (names.has('a1') && names.has('webId')),
        required: [{ name: 'web_session', desc: '登录凭证（核心）' }],
        optional: [{ name: 'a1', desc: '设备指纹' }, { name: 'webId', desc: '会话标识' }]
    },
    {
        id: 'zhihu',
        label: '知乎',
        domains: ['.zhihu.com'],
        match: (names) => names.has('z_c0') || (names.has('d_c0') && names.has('q_c1')),
        required: [{ name: 'z_c0', desc: '登录凭证（核心）' }],
        optional: [{ name: 'd_c0', desc: '设备指纹' }]
    },
    {
        id: 'weibo',
        label: '微博',
        domains: ['.weibo.com'],
        match: (names) => ['SUB', 'SUBP', 'SSOLoginState'].some((k) => names.has(k)),
        required: [{ name: 'SUB', desc: '登录凭证（核心）' }],
        optional: [{ name: 'SUBP', desc: '登录凭证副本' }]
    },
    {
        id: 'twitter',
        label: 'X / Twitter',
        domains: ['.x.com'],
        match: (names) => names.has('auth_token') && (names.has('ct0') || names.has('twid')),
        required: [{ name: 'auth_token', desc: '登录凭证（核心）' }],
        optional: [{ name: 'ct0', desc: 'CsrfToken' }]
    },
    {
        id: 'generic',
        label: '未识别平台',
        domains: [],
        match: () => false,
        required: [],
        optional: []
    }
];

const COOKIE_ATTRIBUTE_RE = /^(path|domain|expires|max-age|samesite|secure|httponly|priority|comment|version|hostonly|session|storeid|size|created|lastaccessed|partitionkey|partitionkeyops|partitioned)$/i;

function getCookiePlatformById(id) {
    return COOKIE_PLATFORM_DEFS.find((p) => p.id === id) || COOKIE_PLATFORM_DEFS[COOKIE_PLATFORM_DEFS.length - 1];
}

function cleanCookieName(name) {
    const n = String(name == null ? '' : name).trim();
    if (!n || n.length > 128) return '';
    if (!/^[^=;,\s"'<>*]+$/.test(n)) return '';
    return n;
}

function cleanCookieValue(value) {
    return String(value == null ? '' : value).replace(/[\t\r\n]/g, '').trim();
}

function normalizeExpires(value) {
    const n = Number(value);
    if (!isFinite(n) || n <= 0) return 0;
    return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
}

function toBool(value) {
    if (typeof value === 'boolean') return value;
    const s = String(value == null ? '' : value).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
}

function dedupeByName(list) {
    const map = new Map();
    list.forEach((item) => {
        if (item && item.name) map.set(item.name, item);
    });
    return Array.from(map.values());
}

function parseJsonText(text) {
    let json = null;
    try { json = JSON.parse(text); } catch (_) { return null; }
    if (json && typeof json === 'object' && typeof json.cookie === 'string') {
        const list = parsePairString(json.cookie);
        return list.length ? list : null;
    }
    let arr = null;
    if (Array.isArray(json)) arr = json;
    else if (json && Array.isArray(json.cookies)) arr = json.cookies;
    if (!arr || !arr.length) return null;

    const list = [];
    arr.forEach((item) => {
        if (item == null) return;
        if (typeof item === 'string') {
            parsePairString(item).forEach((c) => list.push(c));
            return;
        }
        const name = cleanCookieName(item.name);
        if (!name) return;
        list.push({
            name,
            value: cleanCookieValue(item.value),
            domain: String(item.domain || '').trim(),
            path: String(item.path || '/').trim() || '/',
            secure: toBool(item.secure),
            httpOnly: toBool(item.httpOnly),
            expires: normalizeExpires(item.expires != null ? item.expires : item.expirationDate)
        });
    });
    const out = dedupeByName(list);
    return out.length ? out : null;
}

function isNetscapeRow(cols) {
    if (cols.length < 7) return false;
    if (cols[1] !== 'TRUE' && cols[1] !== 'FALSE') return false;
    return /^\d+$/.test(cols[4]) && !!cols[0];
}

function parseNetscapeText(text) {
    const list = [];
    text.split('\n').forEach((rawLine) => {
        let line = rawLine;
        if (!line.trim()) return;
        if (line.startsWith('#')) {
            if (line.startsWith('#HttpOnly_')) line = line.slice('#HttpOnly_'.length);
            else return;
        }
        const cols = line.split('\t').map((s) => s.trim());
        if (!isNetscapeRow(cols)) return;
        const name = cleanCookieName(cols[5]);
        if (!name) return;
        list.push({
            name,
            value: cleanCookieValue(cols[6]),
            domain: cols[0],
            path: cols[2] || '/',
            secure: cols[3].toUpperCase() === 'TRUE',
            httpOnly: false,
            expires: normalizeExpires(cols[4])
        });
    });
    return dedupeByName(list);
}

function parseTableText(text) {
    const list = [];
    text.split('\n').forEach((line) => {
        if (!line.trim()) return;
        const cols = line.split('\t').map((s) => s.trim());
        if (cols.length < 2) return;
        if (isNetscapeRow(cols)) {
            const name = cleanCookieName(cols[5]);
            if (!name) return;
            list.push({
                name,
                value: cleanCookieValue(cols[6]),
                domain: cols[0],
                path: cols[2] || '/',
                secure: cols[3].toUpperCase() === 'TRUE',
                expires: normalizeExpires(cols[4])
            });
            return;
        }
        if (/^(name|名称)$/i.test(cols[0])) return;
        const name = cleanCookieName(cols[0]);
        if (!name || cols[0].includes('=')) return;
        const domain = cols.length >= 3 && /\./.test(cols[2]) && !/^\d/.test(cols[2]) ? cols[2] : '';
        list.push({ name, value: cleanCookieValue(cols[1]), domain });
    });
    return dedupeByName(list);
}

function parsePairString(segment) {
    const list = [];
    String(segment == null ? '' : segment)
        .split(/[;\n]/)
        .forEach((chunk) => {
            let s = chunk.trim();
            if (!s) return;
            s = s.replace(/^(cookie|set-cookie)\s*:\s*/i, '').trim();
            const eq = s.indexOf('=');
            if (eq <= 0) return;
            const name = cleanCookieName(s.slice(0, eq));
            if (!name || COOKIE_ATTRIBUTE_RE.test(name)) return;
            list.push({ name, value: cleanCookieValue(s.slice(eq + 1)) });
        });
    return dedupeByName(list);
}

function finalize(cookies, format) {
    const clean = cookies.map((c) => ({
        name: c.name,
        value: c.value == null ? '' : String(c.value),
        domain: c.domain || '',
        path: c.path || '/',
        secure: !!c.secure,
        httpOnly: !!c.httpOnly,
        expires: c.expires || 0
    }));
    return {
        ok: true,
        format,
        cookies: clean,
        count: clean.length,
        header: buildCookieHeader(clean)
    };
}

function parseCookieText(input) {
    const text = String(input == null ? '' : input).replace(/\r\n?/g, '\n').trim();
    if (!text) return { ok: false, reason: 'empty' };

    if (text[0] === '[' || text[0] === '{') {
        const jsonCookies = parseJsonText(text);
        if (jsonCookies) return finalize(jsonCookies, 'json');
    }

    const firstLine = text.split('\n')[0].trim();
    const hasNetscapeRow = text.split('\n', 40).some((line) => isNetscapeRow(line.split('\t').map((s) => s.trim())));
    if (/^#\s*(Netscape\s+)?HTTP Cookie File/i.test(firstLine) || /^#HttpOnly_/i.test(firstLine) || hasNetscapeRow) {
        const netscapeCookies = parseNetscapeText(text);
        if (netscapeCookies.length) return finalize(netscapeCookies, 'netscape');
    }

    const headerMatch = text.match(/(?:^|\n)[ \t]*cookie[ \t]*:[ \t]*([^\n]*)/i);
    if (headerMatch && headerMatch[1] && headerMatch[1].includes('=')) {
        const headerCookies = parsePairString(headerMatch[1]);
        if (headerCookies.length) return finalize(headerCookies, 'header');
    }

    if (text.includes('\t')) {
        const tableCookies = parseTableText(text);
        if (tableCookies.length) return finalize(tableCookies, 'table');
    }

    const pairCookies = parsePairString(text);
    if (pairCookies.length) return finalize(pairCookies, 'pairs');

    return { ok: false, reason: 'invalid' };
}

function buildCookieHeader(cookies) {
    return (cookies || [])
        .filter((c) => c && c.name)
        .map((c) => `${c.name}=${c.value == null ? '' : c.value}`)
        .join('; ');
}

function recognizeCookiePlatform(cookies) {
    const list = cookies || [];
    const names = new Set(list.map((c) => c.name));
    const domains = list.map((c) => String(c.domain || '').toLowerCase()).filter(Boolean);

    let platform = COOKIE_PLATFORM_DEFS.find((p) => p.match(names)) || null;
    if (!platform) {
        platform = COOKIE_PLATFORM_DEFS.find((p) => p.domains.some((d) => domains.some((dm) => dm === d || dm.endsWith(d)))) || null;
    }
    if (!platform) platform = getCookiePlatformById('generic');

    const fields = (platform.required || []).map((f) => ({ ...f, present: names.has(f.name) }));
    const missing = fields.filter((f) => !f.present).map((f) => f.name);
    const hints = (platform.optional || [])
        .filter((f) => !names.has(f.name))
        .map((f) => ({ ...f, present: false }));

    return {
        platform,
        names,
        fields,
        missing,
        hints,
        recognized: platform.id !== 'generic'
    };
}

function resolveCookieDomain(cookie, platform, manualDomain) {
    let manual = String(manualDomain || '').trim().toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');
    if (manual) {
        if (!manual.startsWith('.') && manual.split('.').filter(Boolean).length <= 2) manual = '.' + manual;
        return manual;
    }

    const canonical = platform && platform.domains && platform.domains.length ? platform.domains[0] : '';
    const d = String((cookie && cookie.domain) || '').trim().toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');
    if (d && canonical) {
        const root = canonical.replace(/^\./, '');
        const bare = d.replace(/^\./, '');
        if (bare === root || bare.endsWith('.' + root)) return canonical;
    }
    if (d) return d;
    return canonical;
}

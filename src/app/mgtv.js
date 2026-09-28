'use strict';

const net = require('./net');

const REFERER = 'https://www.mgtv.com/';
const PAGE_SIZE = 100;
const MAX_PAGES = 30;

function isMgtvUrl(rawUrl) {
    try {
        const host = new URL(rawUrl).hostname.toLowerCase();
        return /(^|\.)mgtv\.com$/.test(host);
    } catch (e) {
        return false;
    }
}

function parseCollectionId(urlObj) {
    const path = urlObj.pathname || '';
    let m;

    if ((m = path.match(/\/h\/(\d+)/))) return m[1];
    if ((m = path.match(/\/b\/(\d+)/))) return m[1];

    const query = urlObj.searchParams.get('collection_id');
    if (query && /^\d+$/.test(query)) return query;

    return null;
}

function parseClock(text) {
    const parts = String(text || '').trim().split(':').map((n) => Number(n));
    if (!parts.length || parts.some((n) => !isFinite(n))) return 0;
    return parts.reduce((acc, value) => acc * 60 + value, 0);
}

function buildTitle(item, index) {
    const short = String(item.t2 || '').trim();
    if (short) return short;

    const label = String(item.t1 || '').trim();
    if (label) return label;

    const full = String(item.t3 || '').trim();
    if (full) return full;

    return `第${index + 1}集`;
}

async function fetchEpisodePage(collectionId, page, cookie) {
    return net.getJson(
        'https://pcweb.api.mgtv.com/episode/list' +
        `?collection_id=${collectionId}&page=${page}&size=${PAGE_SIZE}`,
        { cookie, referer: REFERER }
    );
}

async function resolveMgtvList(rawUrl, cookiePath) {
    const input = String(rawUrl || '').trim();
    if (!input || !isMgtvUrl(input)) return null;

    try {
        const urlObj = new URL(input);
        const collectionId = parseCollectionId(urlObj);
        if (!collectionId) return null;

        const cookie = net.readCookie(cookiePath, ['mgtv.com', 'hitv.com']);

        const first = await fetchEpisodePage(collectionId, 1, cookie);
        if (first.code !== 200 || !first.data) return null;

        const payload = first.data;
        const info = payload.info || {};
        const totalPages = Math.min(Number(payload.total_page) || 1, MAX_PAGES);

        const rawItems = Array.isArray(payload.list) ? payload.list.slice() : [];

        for (let page = 2; page <= totalPages; page++) {
            try {
                const next = await fetchEpisodePage(collectionId, page, cookie);
                if (next.code === 200 && next.data && Array.isArray(next.data.list)) {
                    rawItems.push(...next.data.list);
                }
            } catch (e) {
            }
        }

        const seen = new Set();
        const items = [];

        rawItems.forEach((item, index) => {
            if (!item || !item.url) return;
            const videoId = String(item.video_id || item.url);
            if (seen.has(videoId)) return;
            seen.add(videoId);

            items.push({
                url: `https://www.mgtv.com${item.url.startsWith('/') ? '' : '/'}${item.url}`,
                title: buildTitle(item, index),
                thumbnail: net.normalizeImage(item.img || ''),
                duration: net.formatDuration(parseClock(item.time)),
                vip: String(item.isvip) === '1'
            });
        });

        if (items.length === 0) return null;

        return {
            title: info.title || '芒果TV',
            cover: (items[0] && items[0].thumbnail) || '',
            kind: 'video',
            vipLocked: !cookie,
            items,
            source: 'mgtv'
        };
    } catch (e) {
        return null;
    }
}

module.exports = {
    resolveMgtvList,
    isMgtvUrl
};

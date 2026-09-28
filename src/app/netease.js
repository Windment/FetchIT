'use strict';

const net = require('./net');

const REFERER = 'https://music.163.com/';
const SONG_BATCH_SIZE = 100;
const MAX_TRACKS = 3000;

const SHORT_HOSTS = ['163cn.tv'];

function isNeteaseUrl(rawUrl) {
    try {
        const host = new URL(rawUrl).hostname.toLowerCase();
        return /(^|\.)music\.163\.com$/.test(host) || /(^|\.)163\.com$/.test(host) || SHORT_HOSTS.includes(host);
    } catch (e) {
        return false;
    }
}

function isShortHost(host) {
    return SHORT_HOSTS.includes(String(host || '').toLowerCase());
}

function getParam(urlObj, name) {
    const direct = urlObj.searchParams.get(name);
    if (direct) return direct;

    const hash = urlObj.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return null;

    try {
        return new URLSearchParams(hash.slice(qIndex + 1)).get(name);
    } catch (e) {
        return null;
    }
}

function parseTarget(urlObj) {
    const route = (urlObj.pathname || '') + (urlObj.hash || '');
    const id = getParam(urlObj, 'id');
    if (!id || !/^\d+$/.test(id)) return null;

    if (/\/playlist\b/.test(route) || /\/toplist\b/.test(route)) {
        return { type: 'playlist', id };
    }
    if (/\/song\b/.test(route)) {
        return { type: 'song', id };
    }
    return null;
}

async function fetchPlaylist(playlistId, cookie) {
    const data = await net.getJson(
        `https://music.163.com/api/v6/playlist/detail?id=${playlistId}&n=1000&s=0`,
        { cookie, referer: REFERER }
    );

    if (data.code !== 200 || !data.playlist) {
        throw new Error(data.message || data.msg || '歌单信息获取失败');
    }

    return data.playlist;
}

async function fetchSongDetails(ids, cookie) {
    const map = new Map();

    for (let i = 0; i < ids.length; i += SONG_BATCH_SIZE) {
        const batch = ids.slice(i, i + SONG_BATCH_SIZE);
        const payload = JSON.stringify(batch.map((id) => ({ id: Number(id) })));

        const data = await net.postFormJson(
            'https://music.163.com/api/v3/song/detail',
            { c: payload },
            { cookie, referer: REFERER }
        );

        (data.songs || []).forEach((song) => {
            if (song && song.id) map.set(String(song.id), song);
        });
    }

    return map;
}

function buildSongItem(song) {
    const artists = (song.ar || []).map((a) => a && a.name).filter(Boolean).join(' / ');
    const album = song.al || {};
    const name = song.name || '';
    const fee = Number(song.fee) || 0;

    return {
        url: `https://music.163.com/#/song?id=${song.id}`,
        title: artists ? `${name} - ${artists}` : name,
        thumbnail: net.normalizeImage(album.picUrl || ''),
        duration: net.formatDuration((Number(song.dt) || 0) / 1000),
        vip: fee === 1 || fee === 4
    };
}

async function resolveNeteaseList(rawUrl, cookiePath) {
    const input = String(rawUrl || '').trim();
    if (!input || !isNeteaseUrl(input)) return null;

    try {
        let urlObj = new URL(input);

        if (isShortHost(urlObj.hostname)) {
            const res = await net.httpGet(input, { redirects: 6, timeout: 12000, referer: REFERER });
            if (!res.url) return null;
            urlObj = new URL(res.url);
        }

        const target = parseTarget(urlObj);
        if (!target) return null;

        const cookie = net.readCookie(cookiePath, ['music.163.com', '163.com']);

        if (target.type === 'song') {
            const map = await fetchSongDetails([target.id], cookie);
            const song = map.get(String(target.id));
            if (!song) return null;
            return {
                title: song.name || '单曲',
                cover: net.normalizeImage((song.al || {}).picUrl || ''),
                kind: 'music',
                items: [buildSongItem(song)],
                source: 'netease-song'
            };
        }

        const playlist = await fetchPlaylist(target.id, cookie);
        const trackIds = (playlist.trackIds || []).map((t) => String(t.id)).filter(Boolean);

        if (trackIds.length === 0) return null;

        const known = new Map();
        (playlist.tracks || []).forEach((song) => {
            if (song && song.id) known.set(String(song.id), song);
        });

        const missing = trackIds.slice(0, MAX_TRACKS).filter((id) => !known.has(id));
        if (missing.length) {
            const fetched = await fetchSongDetails(missing, cookie);
            fetched.forEach((song, id) => known.set(id, song));
        }

        const items = [];
        trackIds.slice(0, MAX_TRACKS).forEach((id) => {
            const song = known.get(id);
            if (!song) return;
            items.push(buildSongItem(song));
        });

        if (items.length === 0) return null;

        return {
            title: playlist.name || '歌单',
            cover: net.normalizeImage(playlist.coverImgUrl || '') || (items[0] && items[0].thumbnail) || '',
            kind: 'music',
            items,
            source: 'netease-playlist'
        };
    } catch (e) {
        return null;
    }
}

module.exports = {
    resolveNeteaseList,
    isNeteaseUrl
};

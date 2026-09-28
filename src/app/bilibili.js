'use strict';

const net = require('./net');

const REFERER = 'https://www.bilibili.com/';
const MAX_PAGES = 30;

const SHORT_HOSTS = ['b23.tv', 'bili2233.cn', 'bili22.cn', 'bili33.cn'];

function log(...args) {
}

function logWarn(...args) {
}

function logError(...args) {
}

function checkCode(data, what) {
    if (data && data.code === 0) return true;
    logError(`${what} 失败：code=${data && data.code} message=${(data && (data.message || data.msg)) || '无'}`);
    return false;
}

function buildBangumiTitle(ep, index, fallbackLabel) {
    const raw = String(ep.title || '').trim();
    const longTitle = String(ep.long_title || '').trim();
    let label;

    if (/^\d+$/.test(raw)) {
        label = `第${raw}话`;
    } else if (/^第.+[话集期]$/.test(raw)) {
        label = raw;
    } else if (raw) {
        label = raw;
    } else {
        label = fallbackLabel || `第${index + 1}话`;
    }

    return longTitle ? `${label} ${longTitle}` : label;
}

function bangumiEpisodeUrl(ep) {
    const link = ep.link || ep.share_url || '';
    if (/^https?:\/\/[^/]*bilibili\.com\//.test(link)) return link;
    const epId = ep.ep_id || ep.id;
    if (epId) return `https://www.bilibili.com/bangumi/play/ep${epId}`;
    if (ep.bvid) return `https://www.bilibili.com/video/${ep.bvid}`;
    return '';
}

function isBilibiliUrl(rawUrl) {
    try {
        const host = new URL(rawUrl).hostname.toLowerCase();
        return /(^|\.)bilibili\.com$/.test(host) || SHORT_HOSTS.includes(host);
    } catch (e) {
        return false;
    }
}

function isShortHost(host) {
    return SHORT_HOSTS.includes(String(host || '').toLowerCase());
}

function expandShortPath(path) {
    const m = String(path || '').match(/\/(BV[0-9A-Za-z]{8,}|av\d+|ep\d+|ss\d+|md\d+)/i);
    if (!m) return null;
    const id = m[1];
    if (/^bv/i.test(id) || /^av/i.test(id)) return `https://www.bilibili.com/video/${id}`;
    if (/^ep/i.test(id) || /^ss/i.test(id)) return `https://www.bilibili.com/bangumi/play/${id.toLowerCase()}`;
    if (/^md/i.test(id)) return `https://www.bilibili.com/bangumi/media/${id.toLowerCase()}`;
    return null;
}

async function resolveShortLink(rawUrl) {
    const res = await net.httpGet(rawUrl, { redirects: 6, timeout: 12000, referer: REFERER });
    let finalUrl = res.url || rawUrl;

    if (isShortHost(new URL(finalUrl).hostname) && res.body) {
        const candidates = res.body.match(/https?:\/\/[^\s"'<>\\]+/g) || [];
        const found = candidates.find((item) => /bilibili\.com/.test(item));
        if (found) finalUrl = found.replace(/&amp;/g, '&');
    }

    return finalUrl;
}

function parseTarget(urlObj) {
    const path = urlObj.pathname || '';
    const sp = urlObj.searchParams;
    let m;

    if ((m = path.match(/\/bangumi\/play\/ep(\d+)/))) {
        return { type: 'bangumi', epId: m[1] };
    }
    if ((m = path.match(/\/bangumi\/play\/ss(\d+)/))) {
        return { type: 'bangumi', seasonId: m[1] };
    }
    if ((m = path.match(/\/bangumi\/media\/md(\d+)/i))) {
        return { type: 'bangumi', mediaId: m[1] };
    }

    if ((m = path.match(/^\/(\d+)\/channel\/collectiondetail/))) {
        const sid = sp.get('sid');
        if (sid) return { type: 'season', mid: m[1], seasonId: sid };
    }
    if ((m = path.match(/^\/(\d+)\/channel\/seriesdetail/))) {
        const sid = sp.get('sid');
        if (sid) return { type: 'series', mid: m[1], seriesId: sid };
    }
    if ((m = path.match(/^\/(\d+)\/lists\/(\d+)/))) {
        const type = (sp.get('type') || 'season').toLowerCase();
        return type === 'series'
            ? { type: 'series', mid: m[1], seriesId: m[2] }
            : { type: 'season', mid: m[1], seasonId: m[2] };
    }
    if ((m = path.match(/^\/(\d+)\/favlist/))) {
        const fid = sp.get('fid');
        if (fid) return { type: 'fav', mediaId: fid };
    }

    if ((m = path.match(/\/video\/(BV[0-9A-Za-z]+|av\d+)/i))) {
        return { type: 'video', id: m[1] };
    }

    if ((m = path.match(/\/list\/(\d+)/))) {
        const sid = sp.get('sid');
        if (sid) {
            const type = (sp.get('type') || 'season').toLowerCase();
            return type === 'series'
                ? { type: 'series', mid: m[1], seriesId: sid }
                : { type: 'season', mid: m[1], seasonId: sid };
        }
    }

    if ((m = path.match(/\/medialist\/play\/(\d+)/))) {
        const business = (sp.get('business') || '').toLowerCase();
        const bid = sp.get('business_id') || sp.get('id');
        if (bid) {
            if (business.indexOf('series') !== -1) return { type: 'series', mid: m[1], seriesId: bid };
            if (business.indexOf('fav') !== -1) return { type: 'fav', mediaId: bid };
            if (business.indexOf('collection') !== -1 || business.indexOf('season') !== -1) {
                return { type: 'season', mid: m[1], seasonId: bid };
            }
        }
    }
    if ((m = path.match(/\/medialist\/detail\/ml(\d+)/i))) {
        return { type: 'fav', mediaId: m[1] };
    }

    return null;
}

async function resolveBangumi(target, cookie) {
    const params = new URLSearchParams();
    if (target.epId) params.set('ep_id', target.epId);
    else if (target.seasonId) params.set('season_id', target.seasonId);
    else if (target.mediaId) params.set('media_id', target.mediaId);
    else return null;

    const requestUrl = `https://api.bilibili.com/pgc/view/web/season?${params.toString()}`;
    log(`请求番剧信息：${requestUrl}`);
    const data = await net.getJson(requestUrl, { cookie, referer: REFERER });

    if (!checkCode(data, '番剧信息获取') || !data.result) {
        throw new Error(data.message || '番剧信息获取失败');
    }

    const result = data.result;
    const seasonCover = net.normalizeImage(result.cover || '');
    const items = [];
    const seen = new Set();

    const pushItem = (url, title, thumbnail, duration, group, preview) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        items.push({ url, title, thumbnail, duration, group, preview });
    };

    (result.episodes || []).forEach((ep, index) => {
        pushItem(
            bangumiEpisodeUrl(ep),
            buildBangumiTitle(ep, index, `第${index + 1}话`),
            net.normalizeImage(ep.cover) || seasonCover,
            net.formatDuration((Number(ep.duration) || 0) / 1000),
            '正片'
        );
    });

    (result.section || []).forEach((section) => {
        const groupName = String(section.title || '').trim() || '其他视频';
        (section.episodes || []).forEach((ep, index) => {
            pushItem(
                bangumiEpisodeUrl(ep),
                buildBangumiTitle(ep, index, `${groupName} ${index + 1}`),
                net.normalizeImage(ep.cover) || seasonCover,
                net.formatDuration((Number(ep.duration) || 0) / 1000),
                groupName,
                true
            );
        });
    });

    if (items.length === 0) return null;

    log(`番剧解析成功：${result.title || result.season_title}，正片 ${(result.episodes || []).length} 集，附属 ${(result.section || []).length} 组，合计 ${items.length} 项`);

    return {
        title: result.title || result.season_title || '番剧',
        cover: seasonCover,
        kind: 'video',
        items,
        source: 'bilibili-bangumi'
    };
}

async function resolveUgcSeason(mid, seasonId, cookie) {
    const pageSize = 100;
    const items = [];
    let meta = null;

    log(`请求合集列表：mid=${mid} season_id=${seasonId}（cookie ${cookie ? '已带上' : '未带'}）`);

    for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
        const data = await net.getJson(
            'https://api.bilibili.com/x/polymer/web-space/seasons_archives_list' +
            `?mid=${mid}&season_id=${seasonId}&sort_reverse=false&page_num=${pageNum}&page_size=${pageSize}&web_location=333.1387`,
            {
                cookie,
                referer: `https://space.bilibili.com/${mid}/channel/collectiondetail?sid=${seasonId}`
            }
        );

        if (!checkCode(data, `合集列表第 ${pageNum} 页`)) {
            throw new Error(data.message || '合集解析失败');
        }

        const payload = data.data || {};
        meta = payload.meta || meta;
        const archives = payload.archives || [];

        archives.forEach((archive) => {
            if (!archive || !archive.bvid) return;
            items.push({
                url: `https://www.bilibili.com/video/${archive.bvid}`,
                title: archive.title || '',
                thumbnail: net.normalizeImage(archive.pic),
                duration: net.formatDuration(archive.duration)
            });
        });

        const total = (payload.page && payload.page.total) || items.length;
        if (archives.length === 0 || items.length >= total) break;
    }

    const title = (meta && (meta.name || meta.title)) || '合集';

    if (items.length === 0) {
        logWarn(`合集列表为空：mid=${mid} season_id=${seasonId}（可能是私密合集，或需要 cookie）`);
        return null;
    }

    log(`合集解析成功：${title}，共 ${items.length} 项`);

    return {
        title,
        cover: net.normalizeImage((meta && meta.cover) || '') || (items[0] && items[0].thumbnail) || '',
        kind: 'video',
        items,
        source: 'bilibili-season'
    };
}

async function resolveSeries(mid, seriesId, cookie) {
    const referer = `https://space.bilibili.com/${mid}/channel/seriesdetail?sid=${seriesId}`;
    let title = '列表';
    let cover = '';

    try {
        const metaData = await net.getJson(
            `https://api.bilibili.com/x/series/series?mid=${mid}&series_id=${seriesId}`,
            { cookie, referer }
        );
        const meta = metaData.code === 0 && metaData.data ? metaData.data.meta : null;
        if (meta) {
            title = meta.name || title;
            cover = net.normalizeImage(meta.cover);
        }
    } catch (e) {
    }

    const pageSize = 100;
    const items = [];

    for (let pn = 1; pn <= MAX_PAGES; pn++) {
        const data = await net.getJson(
            `https://api.bilibili.com/x/series/archives?mid=${mid}&series_id=${seriesId}` +
            `&only_normal=true&sort=asc&pn=${pn}&ps=${pageSize}`,
            { cookie, referer }
        );

        if (data.code !== 0) throw new Error(data.message || '列表解析失败');

        const payload = data.data || {};
        const archives = payload.archives || [];

        archives.forEach((archive) => {
            if (!archive || !archive.bvid) return;
            items.push({
                url: `https://www.bilibili.com/video/${archive.bvid}`,
                title: archive.title || '',
                thumbnail: net.normalizeImage(archive.pic),
                duration: net.formatDuration(archive.duration)
            });
        });

        const total = (payload.page && payload.page.total) || items.length;
        if (archives.length === 0 || items.length >= total) break;
    }

    return {
        title,
        cover: cover || (items[0] && items[0].thumbnail) || '',
        kind: 'video',
        items,
        source: 'bilibili-series'
    };
}

async function resolveFavList(mediaId, cookie) {
    const pageSize = 20;
    const items = [];
    let info = null;

    for (let pn = 1; pn <= MAX_PAGES; pn++) {
        const data = await net.getJson(
            `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${mediaId}&pn=${pn}&ps=${pageSize}&platform=web`,
            { cookie, referer: `https://www.bilibili.com/medialist/detail/ml${mediaId}` }
        );

        if (data.code !== 0) throw new Error(data.message || '收藏夹解析失败');

        const payload = data.data;
        if (!payload) break;

        info = payload.info || info;
        const medias = payload.medias || [];

        medias.forEach((media) => {
            if (!media || !media.bvid) return;
            if (media.attr && media.attr !== 0) return;
            if (media.title === '已失效视频' || media.title === '已失效稿件') return;
            items.push({
                url: `https://www.bilibili.com/video/${media.bvid}`,
                title: media.title || '',
                thumbnail: net.normalizeImage(media.cover),
                duration: net.formatDuration(media.duration)
            });
        });

        if (payload.has_more !== true || medias.length === 0) break;
    }

    return {
        title: (info && info.title) || '收藏夹',
        cover: net.normalizeImage((info && info.cover) || '') || (items[0] && items[0].thumbnail) || '',
        kind: 'video',
        items,
        source: 'bilibili-fav'
    };
}

async function resolveVideoSeason(id, cookie) {
    const param = /^bv/i.test(id) ? `bvid=${id}` : `aid=${id}`;
    const data = await net.getJson(`https://api.bilibili.com/x/web-interface/view?${param}`, {
        cookie,
        referer: REFERER
    });

    if (data.code !== 0 || !data.data) return null;

    const detail = data.data;
    const season = detail.ugc_season;
    if (!season) return null;

    const items = [];
    (season.sections || []).forEach((section) => {
        const groupName = String(section.title || '').trim() || '正片';
        (section.episodes || []).forEach((ep) => {
            if (!ep || !ep.bvid) return;
            const arc = ep.arc || {};
            items.push({
                url: `https://www.bilibili.com/video/${ep.bvid}`,
                title: ep.title || arc.title || '',
                thumbnail: net.normalizeImage(arc.pic) || net.normalizeImage(season.cover),
                duration: net.formatDuration(arc.duration),
                group: groupName
            });
        });
    });

    if (items.length === 0) return null;

    return {
        title: season.title || detail.title || '合集',
        cover: net.normalizeImage(season.cover || detail.pic),
        kind: 'video',
        items,
        source: 'bilibili-ugc-season'
    };
}

async function resolveBilibiliList(rawUrl, cookiePath) {
    const input = String(rawUrl || '').trim();
    if (!input) return null;
    if (!isBilibiliUrl(input)) {
        return null;
    }

    log('---------------------------------------------');
    log(`开始解析：${input}`);
    log(`cookie：${cookiePath ? cookiePath : '（未提供）'}`);

    try {
        let urlObj = new URL(input);

        if (isShortHost(urlObj.hostname)) {
            const direct = expandShortPath(urlObj.pathname);
            if (direct) {
                log(`短链直取：${direct}`);
                urlObj = new URL(direct);
            } else {
                log(`跟随短链跳转：${input}`);
                const finalUrl = await resolveShortLink(input);
                log(`短链落点：${finalUrl}`);
                urlObj = new URL(finalUrl);
            }
        }

        const target = parseTarget(urlObj);
        if (!target) {
            logWarn(`未能识别为番剧/合集/列表/收藏夹链接，交给 yt-dlp：${urlObj.toString()}`);
            return null;
        }
        log(`识别类型：${target.type} ${JSON.stringify(target)}`);

        const cookie = net.readCookie(cookiePath, ['bilibili.com']);
        if (cookiePath && !cookie) {
            logWarn(`cookie 文件里没有找到 bilibili.com 的 cookie（文件：${cookiePath}）`);
        }

        let result = null;

        switch (target.type) {
            case 'bangumi':
                result = await resolveBangumi(target, cookie);
                break;
            case 'season':
                result = await resolveUgcSeason(target.mid, target.seasonId, cookie);
                break;
            case 'series':
                result = await resolveSeries(target.mid, target.seriesId, cookie);
                break;
            case 'fav':
                result = await resolveFavList(target.mediaId, cookie);
                break;
            case 'video':
                result = await resolveVideoSeason(target.id, cookie);
                break;
            default:
                result = null;
        }

        if (!result || !result.items || result.items.length === 0) {
            logWarn('该链接没有解析出可分集列表，交给 yt-dlp');
            return null;
        }

        result.items = result.items.filter((item) => item && item.url);
        if (result.items.length === 0) {
            logWarn('过滤掉无效条目后列表为空，交给 yt-dlp');
            return null;
        }

        log(`解析完成：${result.title}（${result.items.length} 项，来源 ${result.source}）`);
        return result;
    } catch (e) {
        logError(`解析失败：${e && e.message ? e.message : e}`);
        return null;
    }
}

module.exports = {
    resolveBilibiliList,
    isBilibiliUrl
};

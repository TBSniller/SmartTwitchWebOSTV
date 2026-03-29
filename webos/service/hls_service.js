/*
 * SmartTwitchWebOSTV local webOS JS service for HLS playlist fetches.
 * Keeps Twitch playlist fetches inside the app package service process so
 * browser CORS restrictions do not block quality parsing in the hosted app.
 */

'use strict';

var pkgInfo = require('./package.json');
var Service = require('webos-service');
var https = require('https');
var urlLib = require('url');

var service = new Service(pkgInfo.name);

var ALLOWED_HOST = 'usher.ttvnw.net';
var MAX_RESPONSE_BYTES = 1024 * 1024;
var DEFAULT_TIMEOUT_MS = 4500;
var MIN_TIMEOUT_MS = 1200;
var MAX_TIMEOUT_MS = 7000;
var DEFAULT_BROWSER_UA = 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36';
var DEFAULT_ACCEPT_LANGUAGE = 'en-US,en;q=0.9';

function clampTimeout(value) {
    var parsed = parseInt(value, 10);
    if (!isFinite(parsed) || parsed <= 0) parsed = DEFAULT_TIMEOUT_MS;
    if (parsed < MIN_TIMEOUT_MS) parsed = MIN_TIMEOUT_MS;
    if (parsed > MAX_TIMEOUT_MS) parsed = MAX_TIMEOUT_MS;
    return parsed;
}

function isAllowedPlaylistUrl(parsedUrl) {
    if (!parsedUrl) return false;
    if (parsedUrl.protocol !== 'https:') return false;
    if (String(parsedUrl.hostname || '').toLowerCase() !== ALLOWED_HOST) return false;
    var path = String(parsedUrl.pathname || '').toLowerCase();
    if (!/\.m3u8$/.test(path)) return false;
    if (path.indexOf('/api/channel/hls/') === 0) return true;
    if (path.indexOf('/vod/') === 0) return true;
    return false;
}

function respondError(message, statusCode, errorCode, errorText) {
    message.respond({
        returnValue: false,
        status: statusCode || 500,
        errorCode: errorCode || 'UNKNOWN',
        errorText: errorText || 'Service error'
    });
}
function normalizeHeaderValue(value, maxLength) {
    if (typeof value !== 'string') return '';
    var cleaned = value.replace(/[\r\n]/g, ' ').trim();
    if (!cleaned) return '';
    if (maxLength > 0 && cleaned.length > maxLength) return cleaned.slice(0, maxLength);
    return cleaned;
}

service.register('fetchPlaylist', function (message) {
    var payload = message && message.payload && typeof message.payload === 'object' ? message.payload : {};
    var targetUrl = typeof payload.url === 'string' ? payload.url : '';
    if (!targetUrl) {
        respondError(message, 400, 'INVALID_URL', 'payload.url is required');
        return;
    }

    var parsedUrl = null;
    try {
        parsedUrl = urlLib.parse(targetUrl);
    } catch (eUrl) {
        respondError(message, 400, 'INVALID_URL', 'payload.url is not a valid URL');
        return;
    }
    if (!parsedUrl || !parsedUrl.hostname) {
        respondError(message, 400, 'INVALID_URL', 'payload.url is not a valid URL');
        return;
    }

    if (!isAllowedPlaylistUrl(parsedUrl)) {
        respondError(message, 403, 'URL_NOT_ALLOWED', 'Only usher Twitch playlist URLs are allowed');
        return;
    }

    var timeoutMs = clampTimeout(payload.timeoutMs);
    var requestOrigin = normalizeHeaderValue(payload.origin, 256);
    var requestReferer = normalizeHeaderValue(payload.referer, 1024);
    var requestUserAgent = normalizeHeaderValue(payload.userAgent, 512) || DEFAULT_BROWSER_UA;
    var requestAcceptLanguage = normalizeHeaderValue(payload.acceptLanguage, 256) || DEFAULT_ACCEPT_LANGUAGE;
    var finished = false;

    var finalize = function (result) {
        if (finished) return;
        finished = true;
        message.respond(result);
    };
    var requestHeaders = {
        Accept: '*/*',
        'Accept-Encoding': 'identity',
        'Accept-Language': requestAcceptLanguage,
        'User-Agent': requestUserAgent
    };
    if (requestOrigin) requestHeaders.Origin = requestOrigin;
    if (requestReferer) requestHeaders.Referer = requestReferer;
    requestHeaders['Sec-Fetch-Mode'] = 'cors';
    requestHeaders['Sec-Fetch-Site'] = 'cross-site';

    var req = https.request(
        {
            protocol: 'https:',
            hostname: parsedUrl.hostname,
            port: parsedUrl.port ? parsedUrl.port : 443,
            method: 'GET',
            path: parsedUrl.pathname + (parsedUrl.search || ''),
            headers: requestHeaders
        },
        function (res) {
            var status = parseInt(res.statusCode, 10) || 0;
            if (status !== 200) {
                try { res.resume(); } catch (eResume) {}
                finalize({
                    returnValue: false,
                    status: status > 0 ? status : 502,
                    errorCode: 'UPSTREAM_STATUS',
                    errorText: 'Upstream returned status ' + status
                });
                return;
            }

            var chunks = [];
            var totalBytes = 0;

            res.on('data', function (chunk) {
                if (finished) return;
                totalBytes += chunk.length;
                if (totalBytes > MAX_RESPONSE_BYTES) {
                    req.destroy(new Error('RESPONSE_TOO_LARGE'));
                    return;
                }
                chunks.push(chunk);
            });

            res.on('end', function () {
                if (finished) return;
                var body = '';
                try {
                    body = Buffer.concat(chunks).toString('utf8');
                } catch (eConcat) {
                    finalize({
                        returnValue: false,
                        status: 500,
                        errorCode: 'DECODE_ERROR',
                        errorText: 'Failed to decode playlist body'
                    });
                    return;
                }

                if (body.indexOf('#EXTM3U') === -1) {
                    finalize({
                        returnValue: false,
                        status: 502,
                        errorCode: 'INVALID_PLAYLIST',
                        errorText: 'Playlist body does not contain EXTM3U header'
                    });
                    return;
                }

                finalize({
                    returnValue: true,
                    status: 200,
                    responseText: body,
                    url: targetUrl
                });
            });
        }
    );

    req.setTimeout(timeoutMs, function () {
        req.destroy(new Error('TIMEOUT'));
    });

    req.on('error', function (err) {
        if (finished) return;
        var messageText = err && err.message ? String(err.message) : 'Network request failed';
        var errorCode = messageText === 'RESPONSE_TOO_LARGE' ? 'RESPONSE_TOO_LARGE' : messageText === 'TIMEOUT' ? 'TIMEOUT' : 'NETWORK_ERROR';
        var statusCode = messageText === 'RESPONSE_TOO_LARGE' ? 413 : messageText === 'TIMEOUT' ? 504 : 502;
        finalize({
            returnValue: false,
            status: statusCode,
            errorCode: errorCode,
            errorText: messageText
        });
    });

    req.end();
});




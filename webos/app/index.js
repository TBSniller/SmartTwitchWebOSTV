(function (global) {
    'use strict';

    var DEFAULT_TARGET_URL = 'https://tbsniller.github.io/SmartTwitchWebOSTV/release/index.html';
    var LAUNCH_TOKEN_PARAM = 'sttv_webos_launch';
    var launchHandlersInstalled = false;
    var launchBootstrapTimerId = 0;
    var launchSystemEventSeen = false;
    var launchNavigationCommitted = false;
    var BOOTSTRAP_FALLBACK_DELAY_MS = 450;
    function isDebugEnabled() {
        try {
            if (global.location && typeof global.location.search === 'string' && /(?:\?|&)sttv_debug=1(?:&|$)/.test(global.location.search)) return true;
        } catch (e) {}
        try {
            return !!(global.localStorage && global.localStorage.getItem('STTV_DEBUG') === '1');
        } catch (e2) {
            return false;
        }
    }
    var DEBUG = isDebugEnabled();
    function debugLog(event, extra) {
        if (!DEBUG) return;
        var payload = {
            event: event || 'event',
            t: Date.now()
        };
        if (extra && typeof extra === 'object') {
            var k;
            for (k in extra) {
                if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
            }
        }
        try {
            console.log('[STTV wrapper]', JSON.stringify(payload));
        } catch (e) {}
    }

    function safeJsonParse(value, fallback) {
        if (!value || typeof value !== 'string') return fallback;

        try {
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }
    function normalizeParams(raw) {
        if (!raw) return {};
        if (typeof raw === 'object') return raw;
        return safeJsonParse(raw, {});
    }
    function readPalmLaunchParams() {
        if (!global.PalmSystem || typeof global.PalmSystem.launchParams === 'undefined' || global.PalmSystem.launchParams === null || global.PalmSystem.launchParams === '') {
            return {available: false, params: {}};
        }
        return {available: true, params: normalizeParams(global.PalmSystem.launchParams)};
    }
    function parseLaunchParams(eventDetail) {
        if (eventDetail && typeof eventDetail === 'object') return eventDetail;

        var palm = readPalmLaunchParams();
        if (palm.available) return palm.params;
        return normalizeParams(global.launchParams);
    }
    function isHttpUrl(value) {
        return typeof value === 'string' && /^https?:\/\//i.test(value);
    }

    function pickTarget(params) {
        if (params && isHttpUrl(params.target)) {
            return params.target;
        }

        if (params && isHttpUrl(params.contentTarget)) {
            return params.contentTarget;
        }

        return DEFAULT_TARGET_URL;
    }
    function withLaunchToken(url) {
        if (!url || typeof url !== 'string') return DEFAULT_TARGET_URL;
        try {
            var parsed = new URL(url);
            parsed.searchParams.set(LAUNCH_TOKEN_PARAM, String(Date.now()));
            return parsed.toString();
        } catch (error) {
            var sep = url.indexOf('?') === -1 ? '?' : '&';
            return url + sep + LAUNCH_TOKEN_PARAM + '=' + Date.now();
        }
    }

    function comparableUrl(url) {
        if (!url || typeof url !== 'string') return '';
        try {
            var parsed = new URL(url, global.location && global.location.href ? global.location.href : undefined);
            parsed.searchParams.delete(LAUNCH_TOKEN_PARAM);
            parsed.searchParams.delete('sttv_update');
            return parsed.origin + parsed.pathname + parsed.search;
        } catch (error) {
            var idx = url.indexOf('?');
            return idx >= 0 ? url.slice(0, idx) : url;
        }
    }
    function shouldNavigate(target) {
        var currentUrl = global.location && global.location.href ? comparableUrl(global.location.href) : '';
        var nextUrl = comparableUrl(target);
        if (!nextUrl) return false;
        if (!currentUrl) return true;
        return currentUrl !== nextUrl;
    }
    function activateApp() {
        try {
            if (global.webOSSystem && typeof global.webOSSystem.activate === 'function') {
                global.webOSSystem.activate();
                return;
            }
        } catch (e) {}
        try {
            if (global.PalmSystem && typeof global.PalmSystem.activate === 'function') {
                global.PalmSystem.activate();
            }
        } catch (e2) {}
    }
    function clearBootstrapLaunchTimer() {
        if (!launchBootstrapTimerId) return;
        global.clearTimeout(launchBootstrapTimerId);
        launchBootstrapTimerId = 0;
    }
    function launch(eventName, eventDetail) {
        if (launchNavigationCommitted) {
            if (eventName === 'webOSRelaunch') activateApp();
            debugLog('launch_skip_committed', {launchEvent: eventName || 'launch'});
            return;
        }
        var params = parseLaunchParams(eventDetail);
        var target = pickTarget(params);
        debugLog('launch_received', {
            launchEvent: eventName || 'launch',
            hasEventDetail: !!(eventDetail && typeof eventDetail === 'object'),
            hasTarget: !!target
        });
        if (eventName === 'webOSRelaunch') activateApp();
        if (!shouldNavigate(target)) {
            debugLog('launch_skip_same_target', {launchEvent: eventName || 'launch'});
            return;
        }
        target = withLaunchToken(target);

        if (!target) return;
        launchNavigationCommitted = true;
        debugLog('launch_navigate', {launchEvent: eventName || 'launch', target: comparableUrl(target)});
        global.location.replace(target);
    }
    function installLaunchHandlers() {
        if (launchHandlersInstalled || !global.document || typeof global.document.addEventListener !== 'function') return;
        launchSystemEventSeen = false;
        clearBootstrapLaunchTimer();
        var onLaunch = function (event) {
            launchSystemEventSeen = true;
            clearBootstrapLaunchTimer();
            debugLog('launch_event', {launchEvent: event && event.type ? event.type : 'webOSLaunch'});
            launch(event && event.type ? event.type : 'webOSLaunch', event && event.detail ? event.detail : null);
        };
        global.document.addEventListener('webOSLaunch', onLaunch, true);
        global.document.addEventListener('webOSRelaunch', onLaunch, true);
        launchBootstrapTimerId = global.setTimeout(function () {
            launchBootstrapTimerId = 0;
            if (launchSystemEventSeen) return;
            debugLog('launch_bootstrap_fallback', {});
            launch('bootstrap', null);
        }, BOOTSTRAP_FALLBACK_DELAY_MS);
        launchHandlersInstalled = true;
    }

    installLaunchHandlers();
})(window);

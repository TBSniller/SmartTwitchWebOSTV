const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const releaseSourceDir = path.join(root, 'release');
const bridgeSource = path.join(root, 'webos', 'bridge', 'webosCompatBridge.js');
const defaultOutputRoot = path.join(root, '.tmp', 'hosted-release-artifact');
const defaultChannel = 'release';
const bridgeTag = '<script src="githubio/js/webosCompatBridge.js"></script>';
const mainScriptRegex = /<script\b(?=[^>]*\bsrc\s*=\s*['"][^'"]*githubio\/js\/main\.js(?:\?[^'"]*)?['"])[^>]*>\s*<\/script>/i;
const anyBridgeTagRegex = /<script\b(?=[^>]*\bsrc\s*=\s*['"][^'"]*webos(?:Hosted|Compat)Bridge\.js(?:\?[^'"]*)?['"])[^>]*>\s*<\/script>\s*/gi;
const bridgeTagGlobalRegex = /<script\b(?=[^>]*\bsrc\s*=\s*['"][^'"]*githubio\/js\/webosCompatBridge\.js(?:\?[^'"]*)?['"])[^>]*>\s*<\/script>/gi;
const bridgeTagSingleRegex = /<script\b(?=[^>]*\bsrc\s*=\s*['"][^'"]*githubio\/js\/webosCompatBridge\.js(?:\?[^'"]*)?['"])[^>]*>\s*<\/script>/i;
const validChannelRegex = /^[A-Za-z0-9._-]+$/;

function parseArgs(argv) {
    let outputRoot = defaultOutputRoot;
    let channel = defaultChannel;

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h') {
            console.log('Usage: node tools/upstream/prepareHostedRelease.js [--out-dir <dir>] [--channel <name>]');
            process.exit(0);
        }

        if (arg === '--out-dir') {
            const next = argv[index + 1];
            if (!next) {
                throw new Error('Missing value for --out-dir');
            }
            outputRoot = resolveOutputRoot(next);
            index += 1;
            continue;
        }

        if (arg.indexOf('--out-dir=') === 0) {
            outputRoot = resolveOutputRoot(arg.slice('--out-dir='.length));
            continue;
        }

        if (arg === '--channel') {
            const next = argv[index + 1];
            if (!next) {
                throw new Error('Missing value for --channel');
            }
            channel = resolveChannel(next);
            index += 1;
            continue;
        }

        if (arg.indexOf('--channel=') === 0) {
            channel = resolveChannel(arg.slice('--channel='.length));
            continue;
        }

        throw new Error('Unknown argument: ' + arg);
    }

    return {outputRoot, channel};
}

function resolveOutputRoot(value) {
    if (!value) {
        throw new Error('Invalid output directory argument');
    }
    if (path.isAbsolute(value)) {
        return value;
    }
    return path.resolve(root, value);
}

function resolveChannel(value) {
    if (!value || !validChannelRegex.test(value)) {
        throw new Error('Invalid channel value: ' + value);
    }
    return value;
}

function ensureSourceInputs() {
    const releaseIndexPath = path.join(releaseSourceDir, 'index.html');
    if (!fs.existsSync(releaseSourceDir)) {
        throw new Error('Missing tracked release directory: ' + releaseSourceDir);
    }
    if (!fs.existsSync(releaseIndexPath)) {
        throw new Error('Missing tracked release index: ' + releaseIndexPath);
    }
    if (!fs.existsSync(bridgeSource)) {
        throw new Error('Missing bridge source: ' + bridgeSource);
    }
}

function replaceRequired(content, pattern, replacement, label) {
    const next = content.replace(pattern, replacement);
    if (next === content) {
        throw new Error('Failed to patch staged bridge for channel: missing ' + label);
    }
    return next;
}

function adaptBridgeForChannel(stagedBridgePath, channel) {
    if (channel !== 'dev') {
        return;
    }

    let bridge = fs.readFileSync(stagedBridgePath, 'utf8');
    bridge = replaceRequired(
        bridge,
        /var\s+FORK_RELEASE_URL\s*=\s*FORK_BASE_URL\s*\+\s*'\/release\/index\.html';/,
        "var FORK_RELEASE_URL = FORK_BASE_URL + '/dev/index.html';",
        'FORK_RELEASE_URL'
    );
    bridge = replaceRequired(
        bridge,
        /var\s+FORK_VERSION_URL\s*=\s*FORK_BASE_URL\s*\+\s*'\/release\/githubio\/version\/version\.json';/,
        "var FORK_VERSION_URL = FORK_BASE_URL + '/dev/githubio/version/version.json';",
        'FORK_VERSION_URL'
    );
    bridge = replaceRequired(
        bridge,
        /var\s+markers\s*=\s*\['\/release\/',\s*'\/hosted\/',\s*'\/webos\/app\/'\];/,
        "var markers = ['/dev/', '/hosted/', '/webos/app/'];",
        'normalizeReloadUrl markers'
    );
    fs.writeFileSync(stagedBridgePath, bridge);
}

function buildArtifact(outputRoot, channel) {
    const stagedChannelDir = path.join(outputRoot, channel);
    const stagedBridgePath = path.join(stagedChannelDir, 'githubio', 'js', 'webosCompatBridge.js');
    const stagedIndexPath = path.join(stagedChannelDir, 'index.html');

    fs.rmSync(stagedChannelDir, {recursive: true, force: true});
    fs.mkdirSync(outputRoot, {recursive: true});
    fs.cpSync(releaseSourceDir, stagedChannelDir, {recursive: true});
    fs.mkdirSync(path.dirname(stagedBridgePath), {recursive: true});
    fs.copyFileSync(bridgeSource, stagedBridgePath);
    adaptBridgeForChannel(stagedBridgePath, channel);

    let html = fs.readFileSync(stagedIndexPath, 'utf8');
    html = html.replace(anyBridgeTagRegex, '');

    if (!mainScriptRegex.test(html)) {
        throw new Error('Cannot find main.js script tag in staged ' + channel + '/index.html');
    }
    html = html.replace(mainScriptRegex, bridgeTag + '$&');
    fs.writeFileSync(stagedIndexPath, html);

    return {
        channel,
        stagedChannelDir,
        stagedBridgePath,
        stagedIndexPath
    };
}

function validateArtifact(paths) {
    if (!fs.existsSync(paths.stagedBridgePath)) {
        throw new Error('Staged bridge file missing: ' + paths.stagedBridgePath);
    }

    const html = fs.readFileSync(paths.stagedIndexPath, 'utf8');
    const bridgeMatches = html.match(bridgeTagGlobalRegex) || [];
    const bridgePosition = html.search(bridgeTagSingleRegex);
    const mainPosition = html.search(mainScriptRegex);

    if (bridgeMatches.length !== 1) {
        throw new Error('Expected exactly one staged bridge script tag, found ' + bridgeMatches.length);
    }
    if (mainPosition < 0) {
        throw new Error('Cannot find staged main.js script tag');
    }
    if (bridgePosition < 0 || bridgePosition >= mainPosition) {
        throw new Error('Staged bridge script tag is missing or not before main.js');
    }
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    ensureSourceInputs();
    const staged = buildArtifact(args.outputRoot, args.channel);
    validateArtifact(staged);
    console.log('Prepared hosted release artifact at: ' + path.join(args.outputRoot, staged.channel));
}

main();


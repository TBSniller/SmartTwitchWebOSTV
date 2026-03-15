const fs = require('fs');
const path = require('path');
const os = require('os');
const {spawnSync} = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const upstreamRepo = 'https://github.com/fgl27/SmartTwitchTV.git';
const tempRoot = path.join(root, '.tmp', 'upstream-release-sync');
const tempRepo = path.join(tempRoot, 'repo');
const localRelease = path.join(root, 'release');
const upstreamRelease = path.join(tempRepo, 'release');
const upstreamStateDir = path.join(root, 'tools', 'upstream', 'state');
const trackedUpstreamShaPath = path.join(upstreamStateDir, 'smarttwitchtv-head.sha');
const trackedReleaseTreeShaPath = path.join(upstreamStateDir, 'smarttwitchtv-release-tree.sha');
const legacyBridgeFilePath = path.join(localRelease, 'githubio', 'js', 'webosCompatBridge.js');
const legacyBridgeTagRegex = /<script\b(?=[^>]*\bsrc\s*=\s*['"][^'"]*githubio\/js\/webosCompatBridge\.js(?:\?[^'"]*)?['"])[^>]*>\s*<\/script>/i;

function run(cmd, args, cwd) {
    const result = spawnSync(cmd, args, {
        cwd,
        stdio: 'inherit',
        shell: process.platform === 'win32'
    });
    if (result.status !== 0) {
        throw new Error('Command failed: ' + cmd + ' ' + args.join(' '));
    }
}

function ensureExists(target, label) {
    if (!fs.existsSync(target)) {
        throw new Error('Missing ' + label + ': ' + target);
    }
}

function gitRead(cwd, args) {
    const result = spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
        shell: process.platform === 'win32'
    });
    if (result.status !== 0) {
        throw new Error('Command failed: git ' + args.join(' '));
    }
    return result.stdout.trim();
}

function readTrimmedIfExists(target) {
    if (!fs.existsSync(target)) {
        return '';
    }
    return fs.readFileSync(target, 'utf8').trim();
}

function writeSha(target, value) {
    if (!value) {
        return;
    }
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, value + os.EOL);
}

function assertReleaseMirrorClean() {
    if (!fs.existsSync(localRelease)) {
        return;
    }

    if (fs.existsSync(legacyBridgeFilePath)) {
        throw new Error('Tracked release mirror must not contain legacy bridge artifact: ' + legacyBridgeFilePath);
    }

    const indexPath = path.join(localRelease, 'index.html');
    if (!fs.existsSync(indexPath)) {
        return;
    }

    const html = fs.readFileSync(indexPath, 'utf8');
    if (legacyBridgeTagRegex.test(html)) {
        throw new Error('Tracked release mirror must not contain legacy bridge script tag in release/index.html');
    }
}

function main() {
    let upstreamHeadSha = '';
    let upstreamReleaseTreeSha = '';

    try {
        fs.rmSync(tempRoot, {recursive: true, force: true});
        fs.mkdirSync(tempRoot, {recursive: true});

        run('git', ['clone', '--depth', '1', upstreamRepo, tempRepo], root);

        ensureExists(upstreamRelease, 'upstream release directory');
        upstreamHeadSha = gitRead(tempRepo, ['rev-parse', 'HEAD']);
        upstreamReleaseTreeSha = gitRead(tempRepo, ['rev-parse', 'HEAD:release']);

        const storedReleaseTreeSha = readTrimmedIfExists(trackedReleaseTreeShaPath);
        const hasLocalRelease = fs.existsSync(localRelease);
        const releaseTreeChanged = upstreamReleaseTreeSha !== storedReleaseTreeSha;

        if (!releaseTreeChanged && hasLocalRelease) {
            assertReleaseMirrorClean();
            process.stdout.write('No upstream release tree changes detected. Skipping release sync.' + os.EOL);
            process.stdout.write('Upstream HEAD: ' + upstreamHeadSha + os.EOL);
            process.stdout.write('Upstream release tree: ' + upstreamReleaseTreeSha + os.EOL);
            return;
        }

        fs.rmSync(localRelease, {recursive: true, force: true});
        fs.cpSync(upstreamRelease, localRelease, {recursive: true});
        assertReleaseMirrorClean();

        writeSha(trackedUpstreamShaPath, upstreamHeadSha);
        writeSha(trackedReleaseTreeShaPath, upstreamReleaseTreeSha);

        process.stdout.write('Synced release/ from upstream mirror (no tracked bridge patching).' + os.EOL);
        process.stdout.write('Upstream HEAD: ' + upstreamHeadSha + os.EOL);
        process.stdout.write('Upstream release tree: ' + upstreamReleaseTreeSha + os.EOL);
    } finally {
        fs.rmSync(tempRoot, {recursive: true, force: true});
    }
}

main();


const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..', '..');
const sourceRepoUrl = 'https://github.com/TBSniller/SmartTwitchWebOSTV';
const defaultBuildDir = path.join(root, 'build');
const fallbackIconUri = 'https://raw.githubusercontent.com/TBSniller/SmartTwitchWebOSTV/master/release/githubio/images/icon_circle.png';

function parseArgs(argv) {
    const args = {
        appInfoPath: '',
        releaseTag: '',
        buildDir: defaultBuildDir
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h') {
            console.log('Usage: node tools/release/generatePrereleaseManifest.js --appinfo <path> --release-tag <dev-N> [--build-dir <dir>]');
            process.exit(0);
        }

        if (arg === '--appinfo') {
            const next = argv[index + 1];
            if (!next) throw new Error('Missing value for --appinfo');
            args.appInfoPath = resolvePath(next);
            index += 1;
            continue;
        }

        if (arg.indexOf('--appinfo=') === 0) {
            args.appInfoPath = resolvePath(arg.slice('--appinfo='.length));
            continue;
        }

        if (arg === '--release-tag') {
            const next = argv[index + 1];
            if (!next) throw new Error('Missing value for --release-tag');
            args.releaseTag = next;
            index += 1;
            continue;
        }

        if (arg.indexOf('--release-tag=') === 0) {
            args.releaseTag = arg.slice('--release-tag='.length);
            continue;
        }

        if (arg === '--build-dir') {
            const next = argv[index + 1];
            if (!next) throw new Error('Missing value for --build-dir');
            args.buildDir = resolvePath(next);
            index += 1;
            continue;
        }

        if (arg.indexOf('--build-dir=') === 0) {
            args.buildDir = resolvePath(arg.slice('--build-dir='.length));
            continue;
        }

        throw new Error('Unknown argument: ' + arg);
    }

    if (!args.appInfoPath) {
        throw new Error('Missing --appinfo');
    }
    if (!/^dev-\d+$/.test(args.releaseTag)) {
        throw new Error('Invalid --release-tag value: ' + args.releaseTag);
    }

    return args;
}

function resolvePath(value) {
    if (!value) throw new Error('Invalid path argument');
    if (path.isAbsolute(value)) return value;
    return path.resolve(root, value);
}

function readJson(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error('Missing file: ' + filePath);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractYamlScalar(content, key) {
    const regex = new RegExp('^' + key + ':\\s*(.+)$', 'm');
    const match = content.match(regex);
    if (!match) return '';
    return match[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

function sha256(filePath) {
    const hasher = crypto.createHash('sha256');
    hasher.update(fs.readFileSync(filePath));
    return hasher.digest('hex');
}

function resolveIconUri(appId) {
    const stableId = appId.endsWith('.dev') ? appId.slice(0, -4) : appId;
    const metadataPath = path.join(root, 'webos', 'homebrew', 'packages', stableId + '.yml');
    if (!fs.existsSync(metadataPath)) {
        return fallbackIconUri;
    }

    const metadata = fs.readFileSync(metadataPath, 'utf8');
    const iconUri = extractYamlScalar(metadata, 'iconUri');
    return iconUri || fallbackIconUri;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const appInfo = readJson(args.appInfoPath);

    const ipkName = appInfo.id + '_' + appInfo.version + '_all.ipk';
    const ipkPath = path.join(args.buildDir, ipkName);
    if (!fs.existsSync(ipkPath)) {
        throw new Error('Missing IPK. Build first: ' + ipkPath);
    }

    const manifest = {
        id: appInfo.id,
        version: appInfo.version,
        type: appInfo.type,
        title: appInfo.title,
        appDescription: appInfo.appDescription,
        iconUri: resolveIconUri(appInfo.id),
        sourceUrl: sourceRepoUrl,
        rootRequired: false,
        ipkUrl: sourceRepoUrl + '/releases/download/' + args.releaseTag + '/' + ipkName,
        ipkHash: {
            sha256: sha256(ipkPath)
        }
    };

    fs.mkdirSync(args.buildDir, {recursive: true});
    const manifestOut = path.join(args.buildDir, appInfo.id + '.manifest.json');
    fs.writeFileSync(manifestOut, JSON.stringify(manifest, null, 2) + '\n');

    console.log('Generated prerelease manifest: ' + manifestOut);
}

main();

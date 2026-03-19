const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const stableAppDir = path.join(root, 'webos', 'app');
const defaultOutDir = path.join(root, '.tmp', 'dev-prerelease-app');
const defaultTargetUrl = 'https://tbsniller.github.io/SmartTwitchWebOSTV/dev/index.html';
const defaultIdSuffix = '.dev';
const defaultVersionPrefix = '0.0.';

function parseArgs(argv) {
    const args = {
        outDir: defaultOutDir,
        targetUrl: defaultTargetUrl,
        idSuffix: defaultIdSuffix,
        devNumber: 0
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h') {
            console.log('Usage: node tools/release/prepareDevAppVariant.js --dev-number <N> [--out-dir <dir>] [--target-url <url>] [--id-suffix <suffix>]');
            process.exit(0);
        }

        if (arg === '--out-dir') {
            const next = argv[index + 1];
            if (!next) throw new Error('Missing value for --out-dir');
            args.outDir = resolvePath(next);
            index += 1;
            continue;
        }

        if (arg.indexOf('--out-dir=') === 0) {
            args.outDir = resolvePath(arg.slice('--out-dir='.length));
            continue;
        }

        if (arg === '--target-url') {
            const next = argv[index + 1];
            if (!next) throw new Error('Missing value for --target-url');
            args.targetUrl = next;
            index += 1;
            continue;
        }

        if (arg.indexOf('--target-url=') === 0) {
            args.targetUrl = arg.slice('--target-url='.length);
            continue;
        }

        if (arg === '--id-suffix') {
            const next = argv[index + 1];
            if (!next) throw new Error('Missing value for --id-suffix');
            args.idSuffix = next;
            index += 1;
            continue;
        }

        if (arg.indexOf('--id-suffix=') === 0) {
            args.idSuffix = arg.slice('--id-suffix='.length);
            continue;
        }

        if (arg === '--dev-number') {
            const next = argv[index + 1];
            if (!next) throw new Error('Missing value for --dev-number');
            args.devNumber = parseDevNumber(next);
            index += 1;
            continue;
        }

        if (arg.indexOf('--dev-number=') === 0) {
            args.devNumber = parseDevNumber(arg.slice('--dev-number='.length));
            continue;
        }

        throw new Error('Unknown argument: ' + arg);
    }

    if (!args.devNumber) {
        throw new Error('Missing --dev-number');
    }
    if (!/^\.?[A-Za-z0-9._-]+$/.test(args.idSuffix)) {
        throw new Error('Invalid --id-suffix value: ' + args.idSuffix);
    }
    if (args.targetUrl.indexOf("'") >= 0) {
        throw new Error('Target URL cannot include single quote characters.');
    }

    return args;
}

function parseDevNumber(value) {
    const parsed = parseInt(String(value || '').trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('Invalid dev number: ' + value);
    }
    return parsed;
}

function resolvePath(value) {
    if (!value) throw new Error('Invalid path argument');
    if (path.isAbsolute(value)) return value;
    return path.resolve(root, value);
}

function loadJson(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error('Missing file: ' + filePath);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function patchDefaultTarget(indexPath, targetUrl) {
    const source = fs.readFileSync(indexPath, 'utf8');
    const targetRegex = /var DEFAULT_TARGET_URL = '[^']*';/;
    if (!targetRegex.test(source)) {
        throw new Error('Cannot find DEFAULT_TARGET_URL in ' + indexPath);
    }
    const patched = source.replace(targetRegex, "var DEFAULT_TARGET_URL = '" + targetUrl + "';");
    fs.writeFileSync(indexPath, patched);
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(stableAppDir)) {
        throw new Error('Missing stable app directory: ' + stableAppDir);
    }

    fs.rmSync(args.outDir, {recursive: true, force: true});
    fs.cpSync(stableAppDir, args.outDir, {recursive: true});

    const appInfoPath = path.join(args.outDir, 'appinfo.json');
    const appInfo = loadJson(appInfoPath);
    const stableId = String(appInfo.id || '').trim();
    if (!stableId) {
        throw new Error('Stable app id missing in ' + appInfoPath);
    }

    const devId = stableId + args.idSuffix;
    const devVersion = defaultVersionPrefix + String(args.devNumber);
    appInfo.id = devId;
    appInfo.version = devVersion;
    writeJson(appInfoPath, appInfo);

    patchDefaultTarget(path.join(args.outDir, 'index.js'), args.targetUrl);

    console.log('Prepared dev app variant:');
    console.log('- app dir: ' + args.outDir);
    console.log('- app id: ' + devId);
    console.log('- app version: ' + devVersion);
    console.log('- target URL: ' + args.targetUrl);
}

main();

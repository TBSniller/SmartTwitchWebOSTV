const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const defaultStableServiceDir = path.join(root, 'webos', 'service');
const defaultStableAppInfoPath = path.join(root, 'webos', 'app', 'appinfo.json');
const defaultOutDir = path.join(root, '.tmp', 'dev-service');

function parseArgs(argv) {
    const args = {
        outDir: defaultOutDir,
        stableServiceDir: defaultStableServiceDir,
        stableAppInfoPath: defaultStableAppInfoPath,
        devAppInfoPath: ''
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h') {
            console.log('Usage: node tools/release/prepareDevServiceVariant.js --dev-appinfo <path> [--out-dir <dir>] [--service-dir <dir>] [--stable-appinfo <path>]');
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

        if (arg === '--service-dir') {
            const next = argv[index + 1];
            if (!next) throw new Error('Missing value for --service-dir');
            args.stableServiceDir = resolvePath(next);
            index += 1;
            continue;
        }
        if (arg.indexOf('--service-dir=') === 0) {
            args.stableServiceDir = resolvePath(arg.slice('--service-dir='.length));
            continue;
        }

        if (arg === '--stable-appinfo') {
            const next = argv[index + 1];
            if (!next) throw new Error('Missing value for --stable-appinfo');
            args.stableAppInfoPath = resolvePath(next);
            index += 1;
            continue;
        }
        if (arg.indexOf('--stable-appinfo=') === 0) {
            args.stableAppInfoPath = resolvePath(arg.slice('--stable-appinfo='.length));
            continue;
        }

        if (arg === '--dev-appinfo') {
            const next = argv[index + 1];
            if (!next) throw new Error('Missing value for --dev-appinfo');
            args.devAppInfoPath = resolvePath(next);
            index += 1;
            continue;
        }
        if (arg.indexOf('--dev-appinfo=') === 0) {
            args.devAppInfoPath = resolvePath(arg.slice('--dev-appinfo='.length));
            continue;
        }

        throw new Error('Unknown argument: ' + arg);
    }

    if (!args.devAppInfoPath) {
        throw new Error('Missing --dev-appinfo');
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

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function ensureStartsWithPrefix(value, prefix, fieldName) {
    if (typeof value !== 'string' || !value) {
        throw new Error(fieldName + ' is missing');
    }
    if (value.indexOf(prefix) !== 0) {
        throw new Error(fieldName + ' must start with app id prefix: ' + prefix + ', got: ' + value);
    }
}

function rewritePrefixedId(value, stablePrefix, devPrefix) {
    ensureStartsWithPrefix(value, stablePrefix, 'service id');
    return devPrefix + value.slice(stablePrefix.length);
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const stableAppInfo = readJson(args.stableAppInfoPath);
    const devAppInfo = readJson(args.devAppInfoPath);

    const stableAppId = String(stableAppInfo.id || '').trim();
    const devAppId = String(devAppInfo.id || '').trim();
    if (!stableAppId) throw new Error('Stable app id missing in ' + args.stableAppInfoPath);
    if (!devAppId) throw new Error('Dev app id missing in ' + args.devAppInfoPath);

    if (!fs.existsSync(args.stableServiceDir)) {
        throw new Error('Missing stable service directory: ' + args.stableServiceDir);
    }

    fs.rmSync(args.outDir, {recursive: true, force: true});
    fs.cpSync(args.stableServiceDir, args.outDir, {recursive: true});

    const servicesJsonPath = path.join(args.outDir, 'services.json');
    const packageJsonPath = path.join(args.outDir, 'package.json');
    const servicesJson = readJson(servicesJsonPath);
    const packageJson = readJson(packageJsonPath);

    const stableServiceId = String(servicesJson.id || packageJson.name || '').trim();
    if (!stableServiceId) throw new Error('Stable service id missing in service metadata');

    const devServiceId = rewritePrefixedId(stableServiceId, stableAppId, devAppId);

    servicesJson.id = devServiceId;
    if (Array.isArray(servicesJson.services)) {
        for (let i = 0; i < servicesJson.services.length; i += 1) {
            if (!servicesJson.services[i] || typeof servicesJson.services[i] !== 'object') continue;
            const currentName = String(servicesJson.services[i].name || '').trim();
            if (!currentName) continue;
            servicesJson.services[i].name = rewritePrefixedId(currentName, stableAppId, devAppId);
        }
    }

    packageJson.name = devServiceId;

    writeJson(servicesJsonPath, servicesJson);
    writeJson(packageJsonPath, packageJson);

    console.log('Prepared dev service variant:');
    console.log('- service dir: ' + args.outDir);
    console.log('- service id: ' + devServiceId);
}

main();

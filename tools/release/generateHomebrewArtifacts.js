const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..', '..');
const sourceRepoUrl = 'https://github.com/TBSniller/SmartTwitchWebOSTV';

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

function main() {
    const appInfoPath = path.join(root, 'webos', 'app', 'appinfo.json');
    const appInfo = readJson(appInfoPath);

    const buildDir = path.join(root, 'build');
    const ipkName = appInfo.id + '_' + appInfo.version + '_all.ipk';
    const ipkPath = path.join(buildDir, ipkName);

    if (!fs.existsSync(ipkPath)) {
        throw new Error('Missing IPK. Build first: ' + ipkPath);
    }

    const appsRepoSourcePath = path.join(root, 'webos', 'homebrew', 'packages', appInfo.id + '.yml');
    if (!fs.existsSync(appsRepoSourcePath)) {
        throw new Error('Missing apps-repo metadata source: ' + appsRepoSourcePath);
    }

    const appsRepoSource = fs.readFileSync(appsRepoSourcePath, 'utf8');
    const iconUri = extractYamlScalar(appsRepoSource, 'iconUri');
    const manifestUrl = extractYamlScalar(appsRepoSource, 'manifestUrl');
    const expectedManifestUrl = sourceRepoUrl + '/releases/latest/download/' + appInfo.id + '.manifest.json';

    if (!iconUri) {
        throw new Error('Missing iconUri in apps-repo metadata source: ' + appsRepoSourcePath);
    }

    if (manifestUrl !== expectedManifestUrl) {
        throw new Error('manifestUrl must stay pinned to releases/latest/download: expected ' + expectedManifestUrl + ' but got ' + manifestUrl);
    }

    fs.mkdirSync(buildDir, {recursive: true});

    const manifest = {
        id: appInfo.id,
        version: appInfo.version,
        type: appInfo.type,
        title: appInfo.title,
        appDescription: appInfo.appDescription,
        iconUri,
        sourceUrl: sourceRepoUrl,
        rootRequired: false,
        ipkUrl: ipkName,
        ipkHash: {
            sha256: sha256(ipkPath)
        }
    };

    const manifestOut = path.join(buildDir, appInfo.id + '.manifest.json');
    const appsRepoOut = path.join(buildDir, appInfo.id + '.apps-repo.yml');

    fs.writeFileSync(manifestOut, JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(appsRepoOut, appsRepoSource);

    console.log('Generated Homebrew artifacts:');
    console.log('- ' + manifestOut);
    console.log('- ' + appsRepoOut);
}

main();


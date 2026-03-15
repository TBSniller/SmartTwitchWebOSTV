const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const appInfoPath = path.join(root, 'webos', 'app', 'appinfo.json');

function main() {
    const tag = (process.argv[2] || '').trim();
    if (!tag) {
        throw new Error('Usage: node tools/release/verifyReleaseTag.js <tag>');
    }

    if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
        throw new Error('Tag must match vX.Y.Z. Got: ' + tag);
    }

    if (!fs.existsSync(appInfoPath)) {
        throw new Error('Missing appinfo: ' + appInfoPath);
    }

    const appInfo = JSON.parse(fs.readFileSync(appInfoPath, 'utf8'));
    const expectedTag = 'v' + appInfo.version;

    if (tag !== expectedTag) {
        throw new Error('Tag/appinfo mismatch: expected ' + expectedTag + ' from webos/app/appinfo.json but got ' + tag);
    }

    console.log('Tag/appinfo validation passed for ' + tag);
}

main();


'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const targetUrl = 'https://tbsniller.github.io/SmartTwitchWebOSTV/dev/index.html';
const sourcePaths = [
    'webos/app/appinfo.json',
    'webos/app/index.js',
    'webos/service/services.json',
    'webos/service/package.json'
];
const snapshots = sourcePaths.map((file) => fs.readFileSync(path.join(root, file), 'utf8'));
const appInfo = JSON.parse(snapshots[0]);
const serviceInfo = JSON.parse(snapshots[2]);
const servicePackage = JSON.parse(snapshots[3]);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sttv-screensaver-'));

function runScript(file, args) {
    execFileSync(process.execPath, [path.join(root, file), ...args], {cwd: root, stdio: 'pipe'});
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

try {
    assert.equal(appInfo.screenSaverProperties.preferredType, 2, 'Use the documented Type 2 screensaver');
    assert.notEqual(appInfo.enablePigScreenSaver, false, 'Do not replace PIG with the full screensaver');
    assert.match(appInfo.version, /^\d+\.\d+\.\d+$/);
    assert.equal(serviceInfo.version, appInfo.version, 'Keep app and service release metadata aligned');

    const devAppDir = path.join(tempDir, 'app');
    const devServiceDir = path.join(tempDir, 'service');
    runScript('tools/release/prepareDevAppVariant.js', [
        '--out-dir', devAppDir, '--dev-number', '1', '--target-url', targetUrl
    ]);
    runScript('tools/release/prepareDevServiceVariant.js', [
        '--out-dir', devServiceDir, '--dev-appinfo', path.join(devAppDir, 'appinfo.json')
    ]);

    const devAppInfo = readJson(path.join(devAppDir, 'appinfo.json'));
    assert.deepEqual(devAppInfo, {...appInfo, id: appInfo.id + '.dev', version: '0.0.1'},
        'The dev variant must preserve all other app metadata, including the screensaver policy');

    const targetPattern = /var DEFAULT_TARGET_URL = '[^']*';/;
    assert.match(snapshots[1], targetPattern, 'The wrapper must expose its default hosted target');
    assert.equal(fs.readFileSync(path.join(devAppDir, 'index.js'), 'utf8'),
        snapshots[1].replace(targetPattern, "var DEFAULT_TARGET_URL = '" + targetUrl + "';"),
        'Only the default hosted URL should change in the dev wrapper');

    const devServiceId = devAppInfo.id + '.hls';
    const expectedServiceInfo = JSON.parse(snapshots[2]);
    expectedServiceInfo.id = devServiceId;
    expectedServiceInfo.services.forEach((service) => {
        assert.ok(service.name.startsWith(appInfo.id + '.'), 'Service names must belong to this app');
        service.name = devAppInfo.id + service.name.slice(appInfo.id.length);
    });
    assert.deepEqual(readJson(path.join(devServiceDir, 'services.json')), expectedServiceInfo,
        'Dev service names must remain isolated from the stable app');
    assert.deepEqual(readJson(path.join(devServiceDir, 'package.json')),
        {...servicePackage, name: devServiceId});

    sourcePaths.forEach((file, index) => {
        assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), snapshots[index],
            'Dev preparation must not mutate ' + file);
    });
    console.log('PASS: Type 2 metadata, isolated dev app/service, dev URL, and unchanged source files');
} finally {
    fs.rmSync(tempDir, {recursive: true, force: true});
}

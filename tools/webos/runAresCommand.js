const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const appInfoPath = path.join(root, 'webos', 'app', 'appinfo.json');

function loadAppInfo() {
    if (!fs.existsSync(appInfoPath)) {
        throw new Error('Missing appinfo: ' + appInfoPath);
    }
    return JSON.parse(fs.readFileSync(appInfoPath, 'utf8'));
}

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: root,
        stdio: 'inherit',
        shell: process.platform === 'win32'
    });
    process.exit(result.status || 0);
}

function main() {
    const action = process.argv[2];
    if (!action) {
        throw new Error('Usage: node tools/webos/runAresCommand.js <install|launch|inspect|remove>');
    }

    const appInfo = loadAppInfo();
    const id = appInfo.id;
    const version = appInfo.version;
    const ipkFile = path.join(root, 'build', id + '_' + version + '_all.ipk');

    if (action === 'install') {
        run('ares-install', [ipkFile]);
        return;
    }

    if (action === 'launch') {
        run('ares-launch', [id]);
        return;
    }

    if (action === 'inspect') {
        run('ares-inspect', ['--device', 'webos', id]);
        return;
    }

    if (action === 'remove') {
        run('ares-install', ['--device', 'webos', '-r', id]);
        return;
    }

    throw new Error('Unsupported action: ' + action);
}

main();


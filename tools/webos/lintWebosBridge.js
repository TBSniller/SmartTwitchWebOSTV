const fs = require('fs');
const path = require('path');
const jshint = require('jshint').JSHINT;

const root = path.resolve(__dirname, '..', '..');
const bridgePath = path.join(root, 'webos', 'bridge', 'webosCompatBridge.js');

const options = {
    eqeqeq: true,
    laxbreak: true,
    undef: true,
    unused: 'strict',
    browser: true,
    node: true
};

const predef = {
    Android: true,
    punycode: true,
    smartTwitchTV: true,
    firebase: true,
    dataLayer: true,
    ActiveXObject: true,
    Twitch: true,
    global: true
};

if (!fs.existsSync(bridgePath)) {
    console.error('Missing bridge source: ' + bridgePath);
    process.exit(1);
}

const source = fs.readFileSync(bridgePath, 'utf8');
jshint(source, options, predef);
const errors = (jshint.data() && jshint.data().errors) || [];

if (errors.length) {
    console.error('\nwebos bridge jshint fail: ' + bridgePath + '\n');
    errors.forEach((error) => {
        if (!error) return;
        console.error('Line ' + error.line + ' reason ' + error.reason + ' code ' + error.code + ' evidence ' + (error.evidence || ''));
    });
    console.error('\nTotal errors = ' + errors.length + '\n');
    process.exit(1);
}

console.log('\nwebos bridge jshint ok: ' + bridgePath + '\n');

const fs = require('fs');
const path = require('path');
const os = require('os');
const {spawnSync} = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const upstreamRepo = 'https://github.com/fgl27/SmartTwitchTV.git';
const tempRoot = path.join(root, '.tmp', 'upstream-android-context-sync');
const tempRepo = path.join(tempRoot, 'repo');
const androidContextRoot = path.join(root, '.ai_context', 'android_upstream');
const latestContextDir = path.join(androidContextRoot, 'latest');
const metadataPath = path.join(latestContextDir, '.sync-metadata.json');
const fileIndexPath = path.join(latestContextDir, '.sync-file-index.json');
const diffReportPath = path.join(latestContextDir, '.sync-diff-report.md');
const excludedTopLevel = new Set(['.git', 'app', 'release']);

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

function shouldExcludeRelative(relPath) {
    const topLevel = relPath.split(path.sep)[0];
    return excludedTopLevel.has(topLevel);
}

function copyFilteredUpstreamSnapshot() {
    fs.rmSync(latestContextDir, {recursive: true, force: true});
    fs.mkdirSync(latestContextDir, {recursive: true});

    const entries = fs.readdirSync(tempRepo, {withFileTypes: true});
    for (const entry of entries) {
        if (excludedTopLevel.has(entry.name)) {
            continue;
        }
        const srcPath = path.join(tempRepo, entry.name);
        const destPath = path.join(latestContextDir, entry.name);
        fs.cpSync(srcPath, destPath, {
            recursive: true,
            force: true,
            errorOnExist: false
        });
    }
}

function parseTreeLine(line) {
    if (!line) {
        return null;
    }
    const tabIndex = line.indexOf('\t');
    if (tabIndex < 0) {
        return null;
    }
    const header = line.slice(0, tabIndex).trim().split(/\s+/);
    if (header.length < 3) {
        return null;
    }
    return {
        blobSha: header[2],
        filePath: line.slice(tabIndex + 1).trim()
    };
}

function buildFileIndexFromGitTree() {
    const output = gitRead(tempRepo, ['ls-tree', '-r', 'HEAD']);
    const lines = output ? output.split(/\r?\n/) : [];
    const index = {};

    for (const line of lines) {
        const parsed = parseTreeLine(line);
        if (!parsed || !parsed.filePath) {
            continue;
        }

        const normalizedPath = parsed.filePath.replace(/\//g, path.sep);
        if (shouldExcludeRelative(normalizedPath)) {
            continue;
        }
        index[parsed.filePath] = parsed.blobSha;
    }

    return index;
}

function readPreviousFileIndex() {
    if (!fs.existsSync(fileIndexPath)) {
        return null;
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(fileIndexPath, 'utf8'));
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        return parsed;
    } catch (error) {
        return null;
    }
}

function buildDiff(previousIndex, nextIndex) {
    const previousPaths = new Set(Object.keys(previousIndex || {}));
    const nextPaths = new Set(Object.keys(nextIndex || {}));
    const added = [];
    const removed = [];
    const changed = [];

    for (const filePath of nextPaths) {
        if (!previousPaths.has(filePath)) {
            added.push(filePath);
            continue;
        }
        if (previousIndex[filePath] !== nextIndex[filePath]) {
            changed.push(filePath);
        }
    }

    for (const filePath of previousPaths) {
        if (!nextPaths.has(filePath)) {
            removed.push(filePath);
        }
    }

    added.sort();
    removed.sort();
    changed.sort();

    return {added, removed, changed};
}

function formatDiffSection(title, values, limit) {
    const maxItems = typeof limit === 'number' ? limit : 200;
    if (!values.length) {
        return '### ' + title + os.EOL + '- none' + os.EOL;
    }

    const lines = ['### ' + title];
    const shown = values.slice(0, maxItems);
    for (const value of shown) {
        lines.push('- ' + value);
    }
    if (values.length > shown.length) {
        lines.push('- ... truncated (' + (values.length - shown.length) + ' more)');
    }
    return lines.join(os.EOL) + os.EOL;
}

function writeMetadata(upstreamHeadSha, fileIndex, diff) {
    const metadata = {
        sourceRepo: upstreamRepo,
        upstreamHeadSha,
        syncedAtUtc: new Date().toISOString(),
        excludedTopLevel: Array.from(excludedTopLevel),
        fileCount: Object.keys(fileIndex).length,
        diffSummary: diff
            ? {
                  added: diff.added.length,
                  removed: diff.removed.length,
                  changed: diff.changed.length
              }
            : null
    };

    fs.mkdirSync(latestContextDir, {recursive: true});
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + os.EOL);
    fs.writeFileSync(fileIndexPath, JSON.stringify(fileIndex, null, 2) + os.EOL);
}

function writeDiffReport(upstreamHeadSha, diff) {
    const lines = [];
    lines.push('# Android Upstream Context Diff Report');
    lines.push('');
    lines.push('- Upstream repo: `' + upstreamRepo + '`');
    lines.push('- Upstream HEAD: `' + upstreamHeadSha + '`');
    lines.push('- Synced at (UTC): `' + new Date().toISOString() + '`');
    lines.push('- Excludes: `.git/`, `app/`, `release/`');
    lines.push('');

    if (!diff) {
        lines.push('No previous `.sync-file-index.json` found. Baseline snapshot created.');
        lines.push('');
        fs.writeFileSync(diffReportPath, lines.join(os.EOL));
        return;
    }

    lines.push('## Summary');
    lines.push('');
    lines.push('- Added files: ' + diff.added.length);
    lines.push('- Removed files: ' + diff.removed.length);
    lines.push('- Changed files: ' + diff.changed.length);
    lines.push('');
    lines.push(formatDiffSection('Added', diff.added, 200).trimEnd());
    lines.push('');
    lines.push(formatDiffSection('Removed', diff.removed, 200).trimEnd());
    lines.push('');
    lines.push(formatDiffSection('Changed', diff.changed, 200).trimEnd());
    lines.push('');

    fs.writeFileSync(diffReportPath, lines.join(os.EOL));
}

function main() {
    let upstreamHeadSha = '';
    try {
        fs.rmSync(tempRoot, {recursive: true, force: true});
        fs.mkdirSync(tempRoot, {recursive: true});
        fs.mkdirSync(androidContextRoot, {recursive: true});

        const previousIndex = readPreviousFileIndex();

        run('git', ['clone', '--depth', '1', upstreamRepo, tempRepo], root);
        upstreamHeadSha = gitRead(tempRepo, ['rev-parse', 'HEAD']);

        const nextIndex = buildFileIndexFromGitTree();
        const diff = previousIndex ? buildDiff(previousIndex, nextIndex) : null;

        copyFilteredUpstreamSnapshot();
        writeMetadata(upstreamHeadSha, nextIndex, diff);
        writeDiffReport(upstreamHeadSha, diff);

        process.stdout.write('Synced Android upstream context into .ai_context/android_upstream/latest' + os.EOL);
        process.stdout.write('Upstream HEAD: ' + upstreamHeadSha + os.EOL);
        if (diff) {
            process.stdout.write(
                'Diff summary - added: ' +
                    diff.added.length +
                    ', removed: ' +
                    diff.removed.length +
                    ', changed: ' +
                    diff.changed.length +
                    os.EOL
            );
        } else {
            process.stdout.write('Baseline snapshot created (no previous file index found).' + os.EOL);
        }
    } finally {
        fs.rmSync(tempRoot, {recursive: true, force: true});
    }
}

main();

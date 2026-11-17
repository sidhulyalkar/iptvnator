import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { parseDocument } from 'yaml';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const content = readFileSync(
    resolve(repo, '.github/workflows/fork-fire-tablet-apk.yml'),
    'utf8'
);

test('Fire APK workflow is valid YAML with one complete artifact upload', () => {
    const document = parseDocument(content, { uniqueKeys: true });
    assert.deepEqual(document.errors.map(error => error.message), []);
    const workflow = document.toJS();
    assert.equal(workflow.permissions.contents, 'read');
    assert.deepEqual(workflow.on.push.branches, [
        'feature/fire-tablet-android-preview-20261117',
    ]);
    assert.ok(workflow.on.push.paths.includes('tools/android/**'));
    const steps = workflow.jobs['fire-tablet-apk'].steps;
    const uploads = steps.filter(step => String(step.uses).startsWith('actions/upload-artifact@'));
    assert.equal(uploads.length, 1, 'one and only one APK artifact upload');
    assert.equal(uploads[0].with['if-no-files-found'], 'error');
    assert.equal(uploads[0].with.path, 'dist/android-preview/*');

    const verify = steps.find(step => step.name === 'Verify APK identity, signing and bundled assets');
    assert.ok(verify?.run, 'APK verification step must exist');
    assert.match(verify.run, /apksigner" verify --verbose/);
    assert.match(verify.run, /grep -Fxq 'assets\/index\.html'/);
    assert.match(verify.run, /grep -Eq '\^assets\/main.*js\$'/);
    assert.match(verify.run, /sha256sum "\$output"/);
});

test('Fire APK workflow builds Angular and runs both native and JavaScript tests', () => {
    const workflow = parseDocument(content).toJS();
    const steps = workflow.jobs['fire-tablet-apk'].steps;
    const commands = steps.map(step => step.run || '').join('\n');
    assert.match(commands, /pnpm nx build web --configuration=android/);
    assert.match(commands, /node --test tools\/android\/\*\.test\.mjs/);
    assert.match(commands, /:app:testDebugUnitTest/);
    assert.match(commands, /:app:lintDebug/);
});

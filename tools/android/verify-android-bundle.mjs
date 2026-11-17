import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function inspectBundle(directory) {
    const errors = [];
    const indexFile = join(directory, 'index.html');
    if (!existsSync(indexFile)) {
        return ['Missing index.html: build web with --configuration=android'];
    }
    const html = readFileSync(indexFile, 'utf8');
    if (!/<base\s+href=["']\/assets\/["']\s*\/?\s*>/.test(html)) {
        errors.push('Android build must use <base href="/assets/">');
    }
    if (existsSync(join(directory, 'ngsw-worker.js'))) {
        errors.push('Service worker must not be bundled into the native APK');
    }
    // Every local top-level stylesheet, script, font preload and favicon must
    // resolve against the packaged Angular output, not the hosted PWA.
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)) {
        const url = match[1];
        if (/^(https?:|data:|blob:|#)/i.test(url)) continue;
        const path = decodeURIComponent(url.split('?')[0]).replace(/^\/assets\//, '').replace(/^\.\//, '');
        if (!path || path.startsWith('/') || path.split('/').includes('..')) {
            errors.push('Unsafe absolute or escaping bundle resource: ' + url);
            continue;
        }
        if (!existsSync(join(directory, path))) errors.push('Missing referenced asset: ' + url);
    }
    const files = readdirSync(directory);
    if (!files.some(name => /^main[.-].+\.js$/.test(name))) {
        errors.push('No compiled Angular main chunk found');
    }
    return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const directory = resolve(process.argv[2] ?? join(root, 'dist/apps/web'));
    const errors = inspectBundle(directory);
    if (errors.length) {
        for (const error of errors) console.error('FAIL:', error);
        process.exitCode = 1;
    } else {
        const size = readdirSync(directory).length;
        console.log('PASS: packaged Angular app validated (' + size + ' top-level entries)');
    }
}

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_PATH as BASE, distRoot, launchBrowser, serveDist } from './website-browser-support.mjs';

const candidatePath = join(distRoot, 'unified-tv-candidate', 'index.html');

test('candidate tour: three sourced screens, noindex and clear qualification boundary', async () => {
  const html = await readFile(candidatePath, 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(html, /Find\. Watch\. Return\./);
  assert.match(html, /Existing product screenshot for orientation; not a capture of the candidate branch/);
  assert.match(html, /native Electron playback is still undergoing qualification/);
  assert.match(html, /github\.com\/sidhulyalkar\/iptvnator\/pull\/17/);
  const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*data-candidate-tab[^>]*>/g)].map(x => x[0]);
  const panels = [...html.matchAll(/<div[^>]*role="tabpanel"[^>]*data-candidate-panel[^>]*>/g)].map(x => x[0]);
  assert.equal(tabs.length, 3);
  assert.equal(panels.length, 3);
  for (const [i, id] of ['find', 'guide', 'keep'].entries()) {
    assert.match(tabs[i], new RegExp(`aria-controls="candidate-panel-${id}"`));
    assert.match(tabs[i], new RegExp(`aria-selected="${i === 0 ? 'true' : 'false'}"`));
    assert.match(panels[i], new RegExp(`id="candidate-panel-${id}"`));
  }
  assert.equal((html.match(/data-src="\/iptvnator\/screenshots\//g) ?? []).length, 3);
  assert.doesNotMatch(html, /<iframe/i, 'tour contains no claimed fake player');
  const home = await readFile(join(distRoot, 'index.html'), 'utf8');
  assert.match(home, /href="\/iptvnator\/unified-tv-candidate\/"/);
});

test('candidate tour: keyboard navigation, focus, lazy images and mobile layout', async (t) => {
  const browser = await launchBrowser();
  if (!browser) { t.skip('no Chromium available locally'); return; }
  const { server, origin } = await serveDist();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    await page.goto(`${origin}${BASE}/unified-tv-candidate/`, { waitUntil: 'networkidle' });
    const tabs = page.locator('[data-candidate-tab]');
    const panels = page.locator('[data-candidate-panel]');
    assert.equal(await tabs.count(), 3);
    assert.equal(await page.locator('[data-candidate-panel]:not([hidden])').count(), 1);
    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true');
    assert.equal(await panels.nth(1).getAttribute('hidden'), null);
    assert.equal(await tabs.nth(1).evaluate(el => document.activeElement === el), true);
    assert.equal(await panels.nth(1).locator('img').getAttribute('src'), '/iptvnator/screenshots/multi-epg-view.webp');
    await page.keyboard.press('End');
    assert.equal(await tabs.nth(2).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home');
    assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true');
    assert.deepEqual(await tabs.evaluateAll(els => els.map(el => el.tabIndex)), [0, -1, -1]);
    assert.deepEqual(errors, []);
    await browser.close();
  } finally {
    server.close();
  }
});

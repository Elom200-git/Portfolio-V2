/* Sonde rapide : charge /admin/ et loggue console + état DOM. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const BASE = 'http://127.0.0.1:8788';

function waitFor(url, cb) {
  const http = require('http');
  const tryOnce = () => http.get(url, () => cb()).on('error', () => setTimeout(tryOnce, 300));
  setTimeout(tryOnce, 500);
  setTimeout(() => { console.error('Serveur non démarré'); process.exit(1); }, 15000);
}

waitFor(BASE + '/api/analytics?days=1', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[console:' + m.type() + ']', m.text().slice(0, 300)));
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 500)));
  page.on('requestfailed', (r) => console.log('[reqfail]', r.url(), r.failure() && r.failure().errorText));
  page.on('response', (r) => { if (r.status() >= 400) console.log('[http ' + r.status() + ']', r.url()); });

  await page.goto(BASE + '/admin/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => ({
    loginHidden: document.getElementById('login-screen').hidden,
    viewHtml: (document.getElementById('view') || {}).innerHTML ? document.getElementById('view').innerHTML.length : -1,
    bodyChildren: document.body.children.length,
    scripts: [...document.scripts].map((s) => s.getAttribute('src')),
  }));
  console.log(JSON.stringify(state, null, 2));
  await page.screenshot({ path: '/tmp/admin_probe.png', fullPage: true });
  await browser.close();
});

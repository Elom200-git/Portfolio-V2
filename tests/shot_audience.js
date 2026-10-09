/* Capture d'écran de la vue Audience avec données mockées. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const BASE = 'http://127.0.0.1:8788';

function waitFor(url, cb) {
  const http = require('http');
  let ok = false;
  const kill = setTimeout(() => { if (!ok) process.exit(1); }, 15000);
  const t = () => { if (ok) return; http.get(url, () => { ok = true; clearTimeout(kill); cb(); }).on('error', () => setTimeout(t, 300)); };
  setTimeout(t, 500);
}

waitFor(BASE + '/api/analytics?days=1', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/admin/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.fill('#login-pass', 'admin123');
  await page.click('#login-form button[type=submit]');
  await page.waitForSelector('#login-screen[hidden]', { state: 'attached' });
  await page.click('[data-view="audience"]');
  await page.fill('#an-pass-inp', 'test-pass-123');
  await page.click('[data-act="an-unlock"]');
  await page.waitForSelector('.an-kpis');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/admin_audience.png', fullPage: true });
  console.log('OK -> /tmp/admin_audience.png');
  await browser.close();
});

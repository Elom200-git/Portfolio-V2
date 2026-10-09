/* Smoke test site public : rendu, erreurs console, appel /api/track. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const BASE = 'http://127.0.0.1:8788';

function waitFor(url, cb) {
  const http = require('http');
  let ok = false;
  const kill = setTimeout(() => { if (!ok) { console.error('serveur KO'); process.exit(1); } }, 15000);
  const t = () => { if (ok) return; http.get(url, () => { ok = true; clearTimeout(kill); cb(); }).on('error', () => setTimeout(t, 300)); };
  setTimeout(t, 500);
}

const server = spawn('python3', ['tests/test_server.py', '8788'], { stdio: 'ignore', detached: true });
process.on('exit', () => { try { process.kill(-server.pid); } catch (e) { try { server.kill(); } catch (e2) {} } });

waitFor(BASE + '/api/analytics?days=1', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  let tracked = false;
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { if (r.url().includes('/api/track')) tracked = true; });

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => ({
    title: document.title,
    heroPresent: !!document.querySelector('header, .hero, #hero, main'),
    sections: document.querySelectorAll('section').length,
    maintenance: !!document.getElementById('maintenance-screen'),
  }));

  // Le track ne part qu'en production (pas localhost) : 127.0.0.1 doit être exclu.
  const isLocal = await page.evaluate(() => /localhost|127\.0\.0\.1/.test(location.hostname));

  console.log(JSON.stringify({ ...state, tracked, isLocal, errors: errors.slice(0, 3) }, null, 2));
  console.log(state.title && state.sections > 0 && errors.length === 0 ? 'SMOKE OK' : 'SMOKE FAIL');
  await browser.close();
  process.exit(state.title && state.sections > 0 && errors.length === 0 ? 0 : 1);
});

/* Vérifie que les classes .an-* reçoivent bien leurs styles CSS. */
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
  const styles = await page.evaluate(() => {
    const gs = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : 'ABSENT';
    };
    return {
      kpisDisplay: gs('.an-kpis', 'display'),
      kpisCols: gs('.an-kpis', 'gridTemplateColumns'),
      kpiFont: gs('.an-kpi b', 'fontFamily'),
      kpiFontSize: gs('.an-kpi b', 'fontSize'),
      barCount: document.querySelectorAll('.an-bar').length,
      firstBarColor: gs('.an-bar i', 'backgroundColor'),
      chartHeight: gs('.an-chart', 'height'),
      axisFont: gs('.an-axis', 'fontFamily'),
      rowBorder: gs('.an-row', 'borderBottomStyle'),
      colsCols: gs('.an-cols', 'gridTemplateColumns'),
    };
  });
  console.log(JSON.stringify(styles, null, 2));
  await browser.close();
  process.exit(0);
});

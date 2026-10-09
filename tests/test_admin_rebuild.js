/* Tests Playwright de l'admin reconstruit + dashboard Audience.
   Démarrer d'abord : node api/test_server.py équivalent → python3 api/test_server.py 8788
   (le script Python de test lance le serveur automatiquement). */
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const BASE = 'http://127.0.0.1:8788';
const results = [];
const consoleErrors = [];

function check(name, cond, extra = '') {
  results.push([name, !!cond]);
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' | ' + extra : ''));
}

function waitFor(url, timeoutMs, cb) {
  const http = require('http');
  let connected = false;
  const kill = setTimeout(() => {
    if (!connected) { console.error('Serveur de test non démarré'); process.exit(1); }
  }, timeoutMs);
  const tryOnce = () => {
    if (connected) return;
    http.get(url, () => { connected = true; clearTimeout(kill); cb(); })
      .on('error', () => setTimeout(tryOnce, 300));
  };
  setTimeout(tryOnce, 500);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  // ---- Login par défaut admin123 --------------------------------------
  await page.goto(BASE + '/admin/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#login-screen:not([hidden])', { timeout: 5000 });
  await page.fill('#login-pass', 'admin123');
  await page.click('#login-form button[type=submit]');
  await page.waitForSelector('#login-screen[hidden]', { state: 'attached', timeout: 5000 });
  check('login admin123', true);

  // ---- Chaque vue ------------------------------------------------------
  const views = ['dashboard', 'hero', 'services', 'projects', 'finmodel', 'skills',
    'certs', 'about', 'contact', 'media', 'seo', 'audience', 'activity', 'settings'];
  for (const v of views) {
    await page.click(`[data-view="${v}"]`);
    await page.waitForTimeout(250);
    const html = await page.innerHTML('#view');
    check('vue ' + v, html.length > 50, html.length + ' chars');
  }

  // ---- Audience : gate mot de passe puis unlock -------------------------
  await page.click('[data-view="audience"]');
  await page.waitForTimeout(300);
  const gate = (await page.innerText('#an-body')).toLowerCase();
  check('audience gate', gate.includes('mot de passe'));
  await page.fill('#an-pass-inp', 'test-pass-123');
  await page.click('[data-act="an-unlock"]');
  await page.waitForSelector('.an-kpis', { timeout: 5000 });
  check('audience KPIs', (await page.innerText('.an-kpis')).toLowerCase().includes('pages vues'));
  check('audience 30 barres', (await page.locator('.an-bar').count()) === 30, String(await page.locator('.an-bar').count()));
  check('audience lignes top', (await page.locator('.an-row').count()) >= 5);

  await page.click('#an-range button[data-days="7"]');
  await page.waitForTimeout(400);
  check('audience 7 barres', (await page.locator('.an-bar').count()) === 7);

  // ---- Mauvais mot de passe → 401 ---------------------------------------
  // state.anPass reste en mémoire : on recharge pour repartir du sessionStorage.
  await page.evaluate(() => sessionStorage.removeItem('elom_an_pass'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-view="audience"]');
  await page.waitForTimeout(300);
  await page.fill('#an-pass-inp', 'WRONG');
  await page.click('[data-act="an-unlock"]');
  await page.waitForTimeout(500);
  check('audience 401', (await page.innerText('#an-body')).toLowerCase().includes('incorrect'));

  // ---- Éditeur projet : ouvrir, enregistrer ------------------------------
  await page.click('[data-view="projects"]');
  await page.waitForTimeout(250);
  await page.locator('[data-act="prj-open"]').first().click();
  await page.waitForTimeout(250);
  check('éditeur projet ouvert', (await page.locator('.editor-page').count()) === 1);
  await page.click('[data-act="prj-ed-save"]');
  await page.waitForTimeout(250);
  check('projet sauvegardé', (await page.locator('.editor-page').count()) === 0);

  // ---- Ctrl+K -------------------------------------------------------------
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(250);
  check('Ctrl+K palette', await page.locator('#cmdk').isVisible());
  await page.keyboard.press('Escape');

  // ---- Erreurs console ------------------------------------------------------
  // Le 401 est attendu : c'est le test volontaire « mauvais mot de passe ».
  const real = consoleErrors.filter((e) => !/favicon|404|401/.test(e));
  check('aucune erreur console', real.length === 0, JSON.stringify(real.slice(0, 3)));

  await browser.close();
}

function main() {
  const server = spawn('python3', ['tests/test_server.py', '8788'], { stdio: 'ignore', detached: true });
  waitFor(BASE + '/api/analytics?days=1', 15000, async () => {
    try {
      await run();
    } catch (e) {
      check('exécution sans exception', false, e.message);
    } finally {
      try { process.kill(-server.pid); } catch (e) { try { server.kill(); } catch (e2) {} }
    }
    const fails = results.filter((r) => !r[1]);
    console.log(`\n${results.length - fails.length}/${results.length} PASS`);
    process.exit(fails.length ? 1 : 0);
  });
}

main();

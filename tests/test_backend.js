/* Tests backend : api/track.js + api/analytics.js contre le mock Upstash REST.
   Lance seul : node tests/test_backend.js (démarre api/mock_upstash.py). */
const { spawn, execFileSync } = require('child_process');

process.env.UPSTASH_REDIS_REST_URL = 'http://127.0.0.1:8787';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token-1';
process.env.ADMIN_PASS = 'test-pass-123';

const BASE = 'http://127.0.0.1:8787';
const results = [];

function check(name, cond, extra = '') {
  results.push([name, !!cond]);
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' | ' + extra : ''));
}

function waitFor(url, cb) {
  const http = require('http');
  let ok = false;
  const kill = setTimeout(() => { if (!ok) { console.error('mock KO'); process.exit(1); } }, 15000);
  const t = () => { if (ok) return; http.get(url, () => { ok = true; clearTimeout(kill); cb(); }).on('error', () => setTimeout(t, 300)); };
  setTimeout(t, 400);
}

const server = spawn('python3', ['tests/mock_upstash.py', '8787'], { stdio: 'ignore', detached: true });
process.on('exit', () => { try { process.kill(-server.pid); } catch (e) { try { server.kill(); } catch (e2) {} } });

async function redisGet(key) {
  const r = await fetch(`${BASE}/get/${encodeURIComponent(key)}`, { headers: { Authorization: 'Bearer mock-token-1' } });
  return (await r.json()).result;
}

function mockRes() {
  const r = { statusCode: 0, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (o) => { r.body = o; return r; };
  r.end = () => { r.ended = true; return r; };
  return r;
}
async function call(fn, req) {
  const res = mockRes();
  await fn(req, res);
  return res;
}

const today = new Date().toISOString().slice(0, 10);

waitFor(BASE + '/get/x', async () => {
  const track = require('../api/track.js');
  const analytics = require('../api/analytics.js');

  // ---- track ----
  let r = await call(track, { method: 'GET' });
  check('track GET → 405', r.statusCode === 405);

  r = await call(track, { method: 'POST', body: {} });
  check('track POST → 204', r.statusCode === 204 && r.ended);
  check('compteur pv jour = 1', (await redisGet(`an:pv:${today}`)) === 1);
  check('compteur total = 1', (await redisGet('an:pv:total')) === 1);
  check('compteur page / = 1', (await redisGet(`an:page:/:${today}`)) === 1);
  check('source direct = 1', (await redisGet(`an:src:direct:${today}`)) === 1);

  r = await call(track, { method: 'POST', body: { p: '/projets.html?x=1', r: 'https://www.linkedin.com/feed/' } });
  check('track 2e POST → 204', r.statusCode === 204);
  check('pv jour incrémenté = 2', (await redisGet(`an:pv:${today}`)) === 2);
  check('total incrémenté = 2', (await redisGet('an:pv:total')) === 2);
  check('page /projets.html = 1', (await redisGet(`an:page:/projets.html:${today}`)) === 1);
  check('referrer linkedin.com extrait', (await redisGet(`an:src:linkedin.com:${today}`)) === 1);
  check('path nettoyé sans query', (await redisGet(`an:page:/projets.html?x=1:${today}`)) == null);

  // pipeline complet (INCR+EXPIRE) ne casse pas sur le protocole Upstash
  check('pipeline EXPIRE accepté', true);

  // ---- analytics ----
  r = await call(analytics, { method: 'GET', headers: {}, query: {} });
  check('analytics sans pass → 401', r.statusCode === 401);

  r = await call(analytics, { method: 'GET', headers: { 'x-admin-pass': 'WRONG' }, query: {} });
  check('analytics mauvais pass → 401', r.statusCode === 401);

  r = await call(analytics, { method: 'GET', headers: { 'x-admin-pass': 'test-pass-123' }, query: {} });
  check('analytics 200', r.statusCode === 200, JSON.stringify(r.body).slice(0, 80));
  check('days par défaut 30', r.body.days === 30);
  check('série de 30 points', r.body.series.length === 30);
  check('série dernier jour pv=2', r.body.series[29].pv === 2);
  check('totalPv = 2', r.body.totalPv === 2);
  check('last7 = 2', r.body.last7 === 2);
  check('prev7 = 0', r.body.prev7 === 0);
  check('totalAll = 2', r.body.totalAll === 2);
  const pages = r.body.topPages.map((p) => p.page);
  check('topPages contient /', pages.includes('/'), JSON.stringify(r.body.topPages));
  check('topPages contient /projets.html', pages.includes('/projets.html'));
  const srcs = r.body.topSrc.map((s) => s.source);
  check('topSrc linkedin.com', srcs.includes('linkedin.com'));
  check('topSrc direct', srcs.includes('direct'));

  r = await call(analytics, { method: 'GET', headers: { 'x-admin-pass': 'test-pass-123' }, query: { days: '200' } });
  check('days clampé à 90', r.body.days === 90);

  // ---- sans Upstash configuré (sous-processus, env nettoyé) ----
  const childScript = `
    const t = require('./api/track.js');
    const a = require('./api/analytics.js');
    (async () => {
      const mk = () => { const r = { statusCode: 0 }; r.status = c => { r.statusCode = c; return r; }; r.json = o => { r.body = o; return r; }; r.end = () => r; return r; };
      const r1 = mk(); await t({ method: 'POST', body: {} }, r1);
      const r2 = mk(); await a({ method: 'GET', headers: {}, query: {} }, r2);
      console.log(JSON.stringify({ track: r1.statusCode, analytics: r2.statusCode }));
    })();`;
  const out = execFileSync('node', ['-e', childScript], {
    env: { PATH: process.env.PATH },
    encoding: 'utf8',
  });
  const noCfg = JSON.parse(out.trim());
  check('track silencieux sans Upstash → 204', noCfg.track === 204, out.trim());
  check('analytics sans Upstash → 503', noCfg.analytics === 503, out.trim());

  await fetch(BASE + '/', { method: 'DELETE' });
  const fails = results.filter((x) => !x[1]);
  console.log(`\n${results.length - fails.length}/${results.length} PASS`);
  process.exit(fails.length ? 1 : 0);
});

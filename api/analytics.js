/* Lecture des compteurs agrégés — réservée au propriétaire.
   Header attendu : x-admin-pass: <mot de passe admin> comparé à ADMIN_PASS côté serveur. */
const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, ADMIN_PASS } = process.env;

const DAY_MS = 86400000;
function dayKey(offset = 0) {
  return new Date(Date.now() - offset * DAY_MS).toISOString().slice(0, 10);
}

async function redisCmd(cmd, ...args) {
  const base = UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
  const r = await fetch(`${base}/${cmd}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
  });
  const j = await r.json();
  return j.result;
}

/* somme des compteurs an:page:<nom>:<jour> / an:src:<nom>:<jour> sur N jours */
async function sumByPrefix(prefix, days) {
  const names = new Set();
  for (let i = 0; i < days; i++) {
    const k = dayKey(i);
    let cursor = 0;
    do {
      const [cur, list] = await redisCmd('SCAN', cursor, 'MATCH', `${prefix}*:${k}`, 'COUNT', 200);
      cursor = Number(cur) || 0;
      (list || []).forEach((key) => {
        const name = key.slice(prefix.length).replace(`:${k}`, '');
        if (name) names.add(name);
      });
    } while (cursor !== 0);
  }
  const out = [];
  for (const name of names) {
    const keys = [];
    for (let i = 0; i < days; i++) keys.push(`${prefix}${name}:${dayKey(i)}`);
    const vals = (await redisCmd('MGET', ...keys)) || [];
    out.push({ name, total: vals.reduce((s, x) => s + (Number(x) || 0), 0) });
  }
  return out.sort((a, b) => b.total - a.total);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) { res.status(503).json({ error: 'analytics non configuré' }); return; }
  const pass = req.headers['x-admin-pass'] || '';
  if (!ADMIN_PASS || pass !== ADMIN_PASS) { res.status(401).json({ error: 'non autorisé' }); return; }

  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
    const keys = [];
    for (let i = days - 1; i >= 0; i--) keys.push(dayKey(i));
    const vals = (await redisCmd('MGET', ...keys.map((k) => `an:pv:${k}`))) || [];
    const series = keys.map((date, i) => ({ date, pv: Number(vals[i]) || 0 }));
    const totalPv = series.reduce((s, d) => s + d.pv, 0);
    const last7 = series.slice(-7).reduce((s, d) => s + d.pv, 0);
    const prev7 = series.slice(-14, -7).reduce((s, d) => s + d.pv, 0);

    const [pages, sources] = await Promise.all([
      sumByPrefix('an:page:', days),
      sumByPrefix('an:src:', days)
    ]);
    const totalAll = Number((await redisCmd('GET', 'an:pv:total')) || 0);

    res.status(200).json({
      days, totalPv, last7, prev7, totalAll,
      series,
      topPages: pages.slice(0, 8).map((p) => ({ page: p.name, views: p.total })),
      topSrc: sources.slice(0, 8).map((s) => ({ source: s.name, views: s.total }))
    });
  } catch (e) {
    console.error('[analytics]', e);
    res.status(500).json({ error: 'erreur de lecture analytics' });
  }
};

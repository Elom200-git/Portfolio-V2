/* Track page view — anonyme, sans cookies, production uniquement.
   INC de compteurs quotidiens agrégés dans Upstash Redis (REST). */
const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;

const DAY_MS = 86400000;
function dayKey(offset = 0) {
  return new Date(Date.now() - offset * DAY_MS).toISOString().slice(0, 10);
}
function cleanPath(p) {
  const s = String(p || '/').split('?')[0].split('#')[0];
  return (s === '' ? '/' : s).slice(0, 80);
}
function cleanRef(r) {
  try {
    if (!r) return 'direct';
    const h = new URL(r).hostname.replace(/^www\./, '');
    return h.slice(0, 60);
  } catch (e) { return 'direct'; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) { res.status(204).end(); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const path = cleanPath(body.p);
    const src = cleanRef(body.r);
    const dk = dayKey(0);
    const base = UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
    // TTL 120 j sur les clés quotidiennes (fenêtre max 90 j + marge) ; pas de TTL sur le total.
    const ttl = String(120 * 86400);
    // pipeline INCR : total jour, page/jour, source/jour, total global
    const cmds = [
      ['INCR', `an:pv:${dk}`],
      ['EXPIRE', `an:pv:${dk}`, ttl],
      ['INCR', `an:page:${path}:${dk}`],
      ['EXPIRE', `an:page:${path}:${dk}`, ttl],
      ['INCR', `an:src:${src}:${dk}`],
      ['EXPIRE', `an:src:${src}:${dk}`, ttl],
      ['INCR', 'an:pv:total']
    ];
    await fetch(`${base}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cmds)
    });
  } catch (e) { /* jamais bloquer la page */ }
  res.status(204).end();
};

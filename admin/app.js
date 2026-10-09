/* Back-office v2 : CRUD complet sur data/site.json + SEO + maintenance + journal + analytics.
   Stockage : localStorage (brouillon) + export fichiers pour Vercel. Aucun framework. */
(function () {
  'use strict';

  const DRAFT_KEY = 'elom_cms_draft';
  const ACT_KEY = 'elom_cms_activity';
  const PASS_KEY = 'elom_cms_passhash';
  const PASS_CHANGED_KEY = 'elom_cms_pass_changed';
  const SESSION_KEY = 'elom_cms_session';
  const LANG_KEY = 'elom-lang';

  const state = {
    data: null, baseEn: null, baseFr: null,
    view: 'dashboard', editLang: 'fr', dirty: false,
    repoHash: null, hasDraft: false, unpublished: false,
    prjQuery: '', prjLayout: 'all', mediaQuery: '',
    svcQuery: '', skQuery: '', certQuery: '',
    previewMode: 'desktop', savedAt: '',
    editingProject: null, editingCert: null, editingSvc: null, editingSkill: null,
    anDays: 30, anPass: null
  };

  const KNOWN_CERTS = ['unicef', 'oif-dclic3', 'oif-dclic2', 'fcc-english', 'google-dm',
    'coursera-1', 'coursera-2', 'work-1', 'work-2', 'rank', 'diploma'];

  const MEDIA_PATHS = [
    'assets/images/projects/profile.webp', 'assets/images/projects/about.webp',
    'assets/images/projects/transport-1.webp', 'assets/images/projects/transport-2.webp',
    'assets/images/projects/transport-3.webp', 'assets/images/projects/transport-4.webp',
    'assets/images/projects/transport-5.webp',
    'assets/images/projects/boutique-1.webp', 'assets/images/projects/boutique-2.webp',
    'assets/images/projects/inventaire-1.webp', 'assets/images/projects/inventaire-2.webp',
    'assets/images/projects/inventaire-3.webp',
    'assets/images/projects/message-1.webp', 'assets/images/projects/message-2.webp',
    'assets/images/projects/message-3.webp',
    'assets/images/projects/otr-1.webp', 'assets/images/projects/otr-2.webp',
    'assets/images/projects/otr-3.webp', 'assets/images/projects/otr-4.webp',
    'assets/images/projects/dataco-1.webp', 'assets/images/projects/dataco-2.webp',
    'assets/images/projects/dataco-3.webp', 'assets/images/projects/dataco-4.webp',
    'assets/images/finmodel/finchart.svg', 'assets/images/finmodel/zoom-assumptions.webp',
    'assets/videos/demo-1.mp4', 'assets/videos/demo-2.mp4',
    'assets/videos/demo-3.mp4', 'assets/videos/demo-4.mp4',
    'assets/documents/cv/Elom_Toublou_CV_Professional_EN.pdf',
    'assets/documents/cv/Elom_Toublou_CV_Academic_EN.pdf'
  ];

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const T = (lang) => {
    const base = JSON.parse(JSON.stringify(lang === 'fr' ? state.baseFr : state.baseEn));
    const base2 = lang === 'fr' ? state.baseEn : state.baseFr;
    return (v) => {
      if (v && typeof v === 'object') {
        const by = v[lang];
        if (by && String(by).trim()) return by;
        const alt = lang === 'fr' ? v.en : v.fr;
        if (alt && String(alt).trim()) return alt;
        const b1 = base == null ? '' : undefined; void b1;
        return (base2 && typeof base2 === 'object') ? '' : '';
      }
      return v == null ? '' : v;
    };
  };

  /* ---------- journal d'activité (local, 120 dernières) ---------- */
  function logAct(action, detail) {
    try {
      const arr = JSON.parse(localStorage.getItem(ACT_KEY) || '[]');
      arr.unshift({ action, detail: detail || '', t: new Date().toISOString() });
      localStorage.setItem(ACT_KEY, JSON.stringify(arr.slice(0, 120)));
    } catch (e) {}
  }
  function getAct() {
    try { return JSON.parse(localStorage.getItem(ACT_KEY) || '[]'); } catch (e) { return []; }
  }

  function toast(msg, kind) {
    const icons = {
      ok: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
      err: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12" y1="16" y2="16.01"/></svg>'
    };
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    if (icons[kind]) {
      const s = document.createElement('span'); s.className = 'toast-ico'; s.innerHTML = icons[kind];
      t.appendChild(s);
    }
    t.appendChild(document.createTextNode(msg));
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3400);
  }

  let modalResolve = null;
  function confirmModal(title, text, okLabel) {
    $('#modal-title').textContent = title;
    $('#modal-text').textContent = text || '';
    $('#modal-ok').textContent = okLabel || 'Supprimer';
    $('#modal').hidden = false;
    return new Promise((res) => { modalResolve = res; });
  }
  $('#modal-cancel').addEventListener('click', () => { $('#modal').hidden = true; if (modalResolve) modalResolve(false); });
  $('#modal-ok').addEventListener('click', () => { $('#modal').hidden = true; if (modalResolve) modalResolve(true); });

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- auth ---------- */
  async function checkAuth() {
    let stored = null;
    try { stored = localStorage.getItem(PASS_KEY); } catch (e) {}
    if (!stored) {
      stored = await sha256('admin123');
      try { localStorage.setItem(PASS_KEY, stored); } catch (e) {}
    }
    try {
      if (localStorage.getItem(PASS_CHANGED_KEY) === '1') {
        $('#login-hint').textContent = 'Mot de passe personnalisé actif.';
      }
    } catch (e) {}
    let sess = null;
    try { sess = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
    if (sess === '1') { showApp(); return; }
    $('#login-screen').hidden = false;
  }
  $('#login-toggle').addEventListener('click', () => {
    const inp = $('#login-pass');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    $('#login-toggle').textContent = show ? 'Masquer' : 'Afficher';
    inp.focus();
  });
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = $('#login-pass').value || '';
    const h = await sha256(v);
    let stored = null;
    try { stored = localStorage.getItem(PASS_KEY); } catch (e2) {}
    if (h === stored) {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e3) {}
      $('#login-err').hidden = true;
      logAct('Connexion');
      showApp();
    } else {
      $('#login-err').hidden = false;
      const sc = $('#login-screen');
      sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake');
    }
  });
  function doLogout() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    logAct('Déconnexion');
    location.reload();
  }
  $('#btn-logout').addEventListener('click', doLogout);

  function showApp() {
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
    boot();
  }

  /* ---------- data ---------- */
  function getDraft() {
    try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }
  function deepMerge(base, over) {
    if (Array.isArray(over)) return over;
    if (over && typeof over === 'object' && base && typeof base === 'object' && !Array.isArray(base)) {
      const out = Object.assign({}, base);
      Object.keys(over).forEach((k) => { out[k] = deepMerge(base ? base[k] : undefined, over[k]); });
      return out;
    }
    return over === undefined ? base : over;
  }
  function setPath(obj, path, val) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (cur[k] == null) cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = val;
  }
  function getPath(obj, path) {
    let cur = obj;
    for (const p of path.split('.')) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  async function boot() {
    try {
      const [siteText, en, fr] = await Promise.all([
        fetch('../data/site.json', { cache: 'no-store' }).then((r) => {
          if (!r.ok) throw new Error('site.json introuvable');
          return r.text();
        }),
        fetch('../i18n/en.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('../i18n/fr.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}))
      ]);
      state.baseEn = en; state.baseFr = fr;
      state.repoHash = await sha256(siteText);
      const site = JSON.parse(siteText);
      const draft = getDraft();
      state.hasDraft = !!draft;
      state.data = draft ? deepMerge(site, draft) : site;
      await refreshPublishState();
    } catch (e) {
      $('#view').innerHTML = '<div class="card"><div class="card-head"><h3>Impossible de charger data/site.json</h3></div><p class="desc">Lancez le site via un serveur local (python -m http.server). fetch() ne marche pas en file://.</p></div>';
      return;
    }
    try { state.editLang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'fr'; } catch (e) {}
    syncLangTabs();
    updateCounts(); setSaveUI();
    render();
    $('#view').addEventListener('input', onInput);
    $('#view').addEventListener('change', onInput);
    $('#view').addEventListener('click', onClick);
  }

  async function refreshPublishState() {
    try {
      const h = await sha256(JSON.stringify(state.data));
      state.unpublished = state.hasDraft && h !== state.repoHash;
    } catch (e) { state.unpublished = state.hasDraft; }
    const dot = $('#dot-unpublished');
    if (dot) dot.hidden = !state.unpublished;
    setSaveUI();
  }

  /* ---------- édition ---------- */
  let saveTimer = null;
  function onInput(e) {
    const el = e.target;
    if (!el || !el.closest) return;
    if (el.id === 'prj-search') { state.prjQuery = el.value; applyProjectFilter(); return; }
    if (el.id === 'svc-search') { state.svcQuery = el.value; applyRowFilter('svc-open', 'svc-search'); return; }
    if (el.id === 'sk-search') { state.skQuery = el.value; applyRowFilter('sk-open', 'sk-search'); return; }
    if (el.id === 'cert-search') { state.certQuery = el.value; applyRowFilter('cert-open', 'cert-search'); return; }
    if (el.id === 'media-search') { state.mediaQuery = el.value; applyMediaFilter(); return; }
    if (el.id === 'new-pass') { updateStrength(); return; }
    const bound = el.closest('[data-bind]');
    if (!bound) return;
    if (bound.type === 'checkbox') return;
    if (bound.dataset.tags === '1') return;
    let v = bound.value;
    if (bound.type === 'number') v = bound.value === '' ? 0 : Number(bound.value);
    if (bound.dataset.bindType === 'number') v = Number(v) || 0;
    setPath(state.data, bound.dataset.bind, v);
    const cc = bound.closest('.fld') ? bound.closest('.fld').querySelector('.char-count') : null;
    if (cc && bound.maxLength > 0) cc.textContent = bound.value.length + '/' + bound.maxLength;
    markDirty();
  }
  function markDirty() {
    state.dirty = true;
    saveTimer = setTimeout(() => saveDraft(true), 900);
    setSaveUI();
  }

  function saveDraft(silent) {
    clearTimeout(saveTimer);
    try {
      state.data.updatedAt = new Date().toISOString();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state.data));
      state.hasDraft = true; state.dirty = false;
      state.savedAt = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      refreshPublishState();
      if (!silent) toast('Brouillon enregistré (aperçu à jour)', 'ok');
    } catch (e) { toast('Échec de la sauvegarde locale', 'err'); }
    setSaveUI();
    if (state.view !== 'projects' || state.editingProject == null) { /* rien */ }
    try { reloadPreview(false); } catch (e) {}
  }

  function setSaveUI() {
    const pill = $('#save-state');
    if (!pill) return;
    const txt = $('#save-state-txt');
    if (state.dirty) {
      pill.classList.add('dirty');
      if (txt) txt.textContent = 'Non enregistré';
    } else {
      pill.classList.remove('dirty');
      if (txt) txt.textContent = state.savedAt ? 'Enregistré ' + state.savedAt : 'Enregistré';
    }
  }

  function syncLangTabs() {
    const fr = $('#tab-fr'), en = $('#tab-en');
    if (fr) fr.classList.toggle('on', state.editLang === 'fr');
    if (en) en.classList.toggle('on', state.editLang === 'en');
  }

  /* ---------- champs réutilisables ---------- */
  function fld(label, path, val, type, max) {
    return '<label class="fld"><span>' + esc(label) + (max ? '<span class="char-count"></span>' : '') + '</span>' +
      '<input type="' + (type || 'text') + '" data-bind="' + path + '" value="' + esc(val) + '"' +
      (max ? ' maxlength="' + max + '"' : '') + '></label>';
  }
  function fldArea(label, path, val) {
    return '<label class="fld"><span>' + esc(label) + '</span><textarea data-bind="' + path + '">' + esc(val) + '</textarea></label>';
  }
  function bi(label, path, en, fr) {
    return '<div class="grid2">' + fldArea(label + ' · EN', path + '.en', en) + fldArea(label + ' · FR', path + '.fr', fr) + '</div>';
  }
  function biShort(label, path, en, fr) {
    return '<div class="grid2">' + fld(label + ' · EN', path + '.en', en) + fld(label + ' · FR', path + '.fr', fr) + '</div>';
  }
  function imgFld(label, path, val) {
    const preview = val ? '<span class="thumbs"><img src="../' + esc(val) + '" onerror="this.style.display=\'none\'" alt=""></span>' : '';
    return '<label class="fld"><span>' + esc(label) + '</span>' +
      '<input data-bind="' + path + '" value="' + esc(val) + '" list="media-paths-global" placeholder="assets/images/...">' + preview + '</label>';
  }
  function renderCvDocument(d, lang) {
    lang = lang || state.cvLang || 'fr';
    const p = d.profile || {};
    const cv = d.cv || {};
    const isFr = lang === 'fr';
    const L = (obj, l) => (obj && typeof obj === 'object' ? (obj[l] != null ? obj[l] : (obj.fr || obj.en || '')) : (obj || ''));

    const name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || 'TOUBLOU ELOM SAMUEL';
    const title = L(cv.title, lang) || (isFr ? 'Data Analyst · Développeur BI · Modélisateur Financier' : 'Data Analyst · BI Developer · Financial Modeler');
    const summary = L(cv.summary, lang);
    const contacts = [
      p.location || 'Lomé, Togo',
      p.email || 'toublousamuel@gmail.com',
      p.phone || '+228 93 87 94 93',
      'linkedin.com/in/elom-samuel-toublou-056446346',
      'elom-toublou.vercel.app'
    ].join(' • ');

    const skillsList = (cv.keySkills || []).map((sk) => {
      const text = isFr ? (sk.fr || sk.en || '') : (sk.en || sk.fr || '');
      return text ? '<li>' + esc(text) + '</li>' : '';
    }).filter(Boolean).join('');

    const exps = (cv.experiences || []).map((e) => {
      const role = isFr ? (e.role_fr || e.role_en || '') : (e.role_en || e.role_fr || '');
      const period = isFr ? (e.period_fr || e.period_en || '') : (e.period_en || e.period_fr || '');
      const bullets = isFr ? (e.bullets_fr || e.bullets_en || []) : (e.bullets_en || e.bullets_fr || []);
      const bHtml = bullets.map((b) => '<li>' + esc(b) + '</li>').join('');
      return '<div class="job">' +
        '<div class="job-line"><span class="job-head">' + esc(e.company) + (e.location ? ' : <span class="job-org">' + esc(e.location) + '</span>' : '') + '</span>' +
        '<span class="job-dates">' + esc(period) + '</span></div>' +
        (role ? '<p class="role-sub">' + esc(role) + '</p>' : '') +
        (bHtml ? '<ul class="sub">' + bHtml + '</ul>' : '') +
        '</div>';
    }).join('');

    const projectsList = (cv.cvProjects && cv.cvProjects.length ? cv.cvProjects : (d.projects.items || []).slice(0, 4)).map((prj) => {
      const prjTitle = isFr ? (prj.title_fr || prj.title_en || '') : (prj.title_en || prj.title_fr || '');
      const prjDesc = isFr ? (prj.desc_fr || prj.desc_en || '') : (prj.desc_en || prj.desc_fr || '');
      return '<li><strong>' + esc(prjTitle) + '</strong> : ' + esc(prjDesc) + '</li>';
    }).join('');

    const eduList = (cv.education || []).map((ed) => {
      const deg = isFr ? (ed.degree_fr || ed.degree_en || '') : (ed.degree_en || ed.degree_fr || '');
      const sch = isFr ? (ed.school_fr || ed.school_en || ed.school || '') : (ed.school_en || ed.school_fr || ed.school || '');
      const det = isFr ? (ed.details_fr || ed.details_en || '') : (ed.details_en || ed.details_fr || '');
      return '<li><strong>' + esc(deg) + '</strong> : ' + esc(sch) + (ed.year ? ', ' + esc(ed.year) : '') + (det ? ' (' + esc(det) + ')' : '') + '</li>';
    }).join('');

    const certsList = (d.certifications.items || []).map((c) => {
      const cTitle = isFr ? (c.title_fr || c.title_en || '') : (c.title_en || c.title_fr || '');
      const cOrg = isFr ? (c.org_fr || c.org_en || '') : (c.org_en || c.org_fr || '');
      if (c.id === 'c1' || cTitle.toLowerCase().indexOf('licence en économie') !== -1) return '';
      return '<li><strong>' + esc(cTitle) + '</strong> : ' + esc(cOrg) + '</li>';
    }).filter(Boolean).join('');

    const refsList = (cv.references || []).map((r) => {
      const rTitle = isFr ? (r.title_fr || r.title_en || '') : (r.title_en || r.title_fr || '');
      return '<li><strong>' + esc(r.name) + '</strong> : ' + esc(rTitle) + (r.phone ? ' / ' + esc(r.phone) : '') + '</li>';
    }).join('');

    return '<div class="cv-sheet-preview">' +
      '<h1 class="name">' + esc(name) + '</h1>' +
      '<p class="headline">' + esc(title) + '</p>' +
      '<p class="contact">' + esc(contacts) + '</p>' +
      '<hr class="sep">' +
      (summary ? '<h2>' + (isFr ? 'PROFIL' : 'PROFILE') + '</h2><p class="profile">' + esc(summary) + '</p>' : '') +
      (skillsList ? '<h2>' + (isFr ? 'COMPÉTENCES CLÉS' : 'KEY SKILLS') + '</h2><ul class="b">' + skillsList + '</ul>' : '') +
      (exps ? '<h2>' + (isFr ? 'EXPÉRIENCE PROFESSIONNELLE' : 'PROFESSIONAL EXPERIENCE') + '</h2>' + exps : '') +
      (projectsList ? '<h2>' + (isFr ? 'PROJETS PERTINENTS' : 'RELEVANT PROJECTS') + '</h2><ul class="b">' + projectsList + '</ul>' : '') +
      ((eduList || certsList) ? '<h2>' + (isFr ? 'FORMATION & CERTIFICATIONS' : 'EDUCATION & CERTIFICATIONS') + '</h2><ul class="b">' + eduList + certsList + '</ul>' : '') +
      (refsList ? '<h2>' + (isFr ? 'RÉFÉRENCES' : 'REFERENCES') + '</h2><ul class="b">' + refsList + '</ul>' : '') +
      '</div>';
  }
  function updateStrength() {
    const v = $('#new-pass') ? $('#new-pass').value : '';
    let score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/\d/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const bar = $('#pass-bar');
    if (!bar) return;
    const colors = ['#B3261E', '#C77E1F', '#C77E1F', '#2BBFA0', '#0E5F4F'];
    bar.style.width = (score * 20) + '%';
    bar.style.background = colors[Math.max(0, score - 1)] || colors[0];
  }

  /* ---------- santé du contenu ---------- */
  function healthIssues() {
    const d = state.data, out = [];
    (d.projects.items || []).forEach((p, i) => {
      if (!p.title_fr || !p.title_en) out.push({ level: 'err', view: 'projects', label: 'Projet #' + (i + 1), detail: 'Titre manquant (FR ou EN).' });
      if (!(p.images || []).length) out.push({ level: 'warn', view: 'projects', label: p.title_fr || 'Projet #' + (i + 1), detail: 'Aucune image.' });
      if (!(p.tags || []).length) out.push({ level: 'warn', view: 'projects', label: p.title_fr || 'Projet #' + (i + 1), detail: 'Aucun tag.' });
    });
    (d.services.items || []).forEach((s, i) => {
      if (!s.desc_fr || !s.desc_en) out.push({ level: 'warn', view: 'services', label: s.title_fr || 'Service #' + (i + 1), detail: 'Description incomplète.' });
    });
    (d.certifications.items || []).forEach((c, i) => {
      if (c.status === 'obtained' && !c.certKey) out.push({ level: 'warn', view: 'certs', label: c.title_fr || 'Certification #' + (i + 1), detail: 'Statut obtenu sans clé viewer (image non cliquable).' });
    });
    return out;
  }

  /* ---------- construction dictionnaires i18n ---------- */
  function buildI18n(lg) {
    const base = JSON.parse(JSON.stringify(lg === 'fr' ? state.baseFr : state.baseEn));
    const d = state.data;
    const put = (path, val) => {
      const parts = path.split('.');
      let cur = base;
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] == null) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = val;
    };
    const tt = (v) => {
      if (v && typeof v === 'object') {
        const by = v[lg];
        if (by && String(by).trim()) return by;
        return (lg === 'fr' ? v.en : v.fr) || v.en || v.fr || '';
      }
      return v == null ? '' : v;
    };
    // meta / SEO
    const p = d.profile || {};
    if (p.seoTitle) put('meta.title', tt(p.seoTitle));
    if (p.seoDesc) put('meta.description', tt(p.seoDesc));
    if (p.ogTitle) put('meta.ogTitle', tt(p.ogTitle));
    if (p.ogDesc) put('meta.ogDesc', tt(p.ogDesc));
    // hero
    const h = d.hero;
    if (h) {
      ['eyebrow', 'desc', 'loc', 'btnProjects', 'btnCv', 'btnContact'].forEach((k) => { if (h[k] != null) put('hero.' + k, tt(h[k])); });
      (h.stats || []).forEach((s, i) => {
        put('hero.stat' + (i + 1) + 'n', s.n || '');
        put('hero.stat' + (i + 1) + 'l', tt(lg === 'fr' ? { fr: s.label_fr, en: s.label_en } : { en: s.label_en, fr: s.label_fr }));
      });
      ['stat1l', 'stat2l', 'stat3l'].forEach((k, i) => {
        const s = (h.stats || [])[i];
        if (s) put('hero.' + k, lg === 'fr' ? (s.label_fr || '') : (s.label_en || ''));
      });
    }
    // services
    const s = d.services;
    if (s) {
      ['label', 'title1', 'title2', 'sub', 'howTitle'].forEach((k) => { if (s[k] != null) put('services.' + k, tt(s[k])); });
      (s.items || []).forEach((it, i) => {
        put('services.s' + (i + 1) + 't', tt(lg === 'fr' ? { fr: it.title_fr, en: it.title_en } : { en: it.title_en, fr: it.title_fr }));
        put('services.s' + (i + 1) + 'd', tt(lg === 'fr' ? { fr: it.desc_fr, en: it.desc_en } : { en: it.desc_en, fr: it.desc_fr }));
      });
      (s.how || []).forEach((x, i) => {
        put('services.how' + (i + 1) + 't', tt(lg === 'fr' ? { fr: x.t_fr, en: x.t_en } : { en: x.t_en, fr: x.t_fr }));
        put('services.how' + (i + 1) + 'd', tt(lg === 'fr' ? { fr: x.d_fr, en: x.d_en } : { en: x.d_en, fr: x.d_fr }));
      });
    }
    // projets : mapping id -> préfixe de clés i18n
    const PRJ_PREFIX = { transport: 'transport', boutique: 'boutique', inventaire: 'inventaire', message: 'message', otr: 'otr', dataco: 'dataco' };
    const pr = d.projects;
    if (pr) {
      ['label', 'title1', 'title2', 'sub'].forEach((k) => { if (pr[k] != null) put('projects.' + k, tt(pr[k])); });
      (pr.items || []).forEach((it) => {
        const pre = PRJ_PREFIX[it.id];
        if (!pre) return;
        if (pre === 'inventaire' || pre === 'message' || pre === 'otr') {
          put('projects.' + pre + 'Type', tt(lg === 'fr' ? { fr: it.tag_fr, en: it.tag_en } : { en: it.tag_en, fr: it.tag_fr }));
        } else {
          put('projects.' + pre + 'Tag', tt(lg === 'fr' ? { fr: it.tag_fr, en: it.tag_en } : { en: it.tag_en, fr: it.tag_fr }));
        }
        put('projects.' + pre + 'Title', tt(lg === 'fr' ? { fr: it.title_fr, en: it.title_en } : { en: it.title_en, fr: it.title_fr }));
        put('projects.' + pre + 'Desc', tt(lg === 'fr' ? { fr: it.desc_fr, en: it.desc_en } : { en: it.desc_en, fr: it.desc_fr }));
        (it.metrics || []).forEach((m, j) => {
          put('projects.' + pre + 'M' + (j + 1), m.v || '');
          put('projects.' + pre + 'M' + (j + 1) + 'l', tt(lg === 'fr' ? { fr: m.l_fr, en: m.l_en } : { en: m.l_en, fr: m.l_fr }));
        });
      });
    }
    // finmodel
    const f = d.finmodel;
    if (f) {
      ['label', 'title1', 'title2', 'sub', 'plain', 'plain2', 'chartCaption', 'capAssumptions', 'capPnl', 'capForecast', 'anno1', 'anno2', 'tab1', 'tab2', 'tab3'].forEach((k) => {
        if (f[k] != null) put('finmodel.' + k, tt(f[k]));
      });
      (f.stats || []).forEach((x, i) => { if (x.l_fr || x.l_en) put('finmodel.stat' + (i + 1) + 'l', tt(lg === 'fr' ? { fr: x.l_fr, en: x.l_en } : { en: x.l_en, fr: x.l_fr })); });
      (f.features || []).forEach((x, i) => {
        put('finmodel.f' + (i + 1) + 't', tt(lg === 'fr' ? { fr: x.t_fr, en: x.t_en } : { en: x.t_en, fr: x.t_fr }));
        put('finmodel.f' + (i + 1) + 'd', tt(lg === 'fr' ? { fr: x.d_fr, en: x.d_en } : { en: x.d_en, fr: x.d_fr }));
      });
    }
    // skills
    const sk = d.skills;
    if (sk) {
      ['label', 'title1', 'title2', 'sub', 'coreTitle', 'techTitle', 'toolsTitle', 'extra'].forEach((k) => { if (sk[k] != null) put('skills.' + k, tt(sk[k])); });
      (sk.items || []).forEach((x, i) => {
        put('skills.s' + (i + 1), tt(lg === 'fr' ? { fr: x.name_fr, en: x.name_en } : { en: x.name_en, fr: x.name_fr }));
      });
    }
    // certifications
    const c = d.certifications;
    if (c) {
      ['label', 'title1', 'title2', 'sub', 'note'].forEach((k) => { if (c[k] != null) put('certifications.' + k, tt(c[k])); });
      (c.items || []).forEach((x, i) => {
        put('certifications.c' + (i + 1), tt(lg === 'fr' ? { fr: x.title_fr, en: x.title_en } : { en: x.title_en, fr: x.title_fr }));
        put('certifications.c' + (i + 1) + 'o', tt(lg === 'fr' ? { fr: x.org_fr, en: x.org_en } : { en: x.org_en, fr: x.org_fr }));
        put('certifications.c' + (i + 1) + 'd', tt(lg === 'fr' ? { fr: x.desc_fr, en: x.desc_en } : { en: x.desc_en, fr: x.desc_fr }));
      });
    }
    // about
    const a = d.about;
    if (a) {
      ['label', 'tag', 'heading1', 'heading3', 'p1', 'p2', 'p3', 'train1tag', 'train1t', 'train1d', 'train2tag', 'train2t', 'train2d', 'goal'].forEach((k) => {
        if (a[k] != null) put('about.' + k, tt(a[k]));
      });
    }
    // contact
    const ct = d.contact;
    if (ct) {
      ['big1', 'big2', 'big3', 'sub', 'avail', 'cvTitle', 'cvPro', 'cvAca', 'email', 'phone', 'linkedin', 'github', 'send'].forEach((k) => {
        if (ct[k] != null) put('contact.' + k, tt(ct[k]));
      });
    }
    return base;
  }

  function download(name, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ═══════════ VUES ═══════════ */
  const VIEW_NAMES = { dashboard: 'Tableau de bord', hero: 'Hero', services: 'Services', projects: 'Projets', finmodel: 'Modélisation', skills: 'Compétences', certs: 'Certifications', cv: 'CV & Expériences', about: 'À propos', contact: 'Contact et profil', media: 'Médias', seo: 'SEO', audience: 'Audience', settings: 'Réglages et export', activity: "Journal d'activité" };

  const VIEWS = {
    dashboard: {
      title: 'Tableau de bord', sub: "Vue d'ensemble, publication et qualité.",
      render() {
        const d = state.data;
        const items = d.projects.items || [];
        const feat = items.filter((p) => p.layout === 'featured').length;
        const np = items.length, ns = (d.services.items || []).length,
          nk = (d.skills.items || []).length, nc = (d.certifications.items || []).length;
        const issues = healthIssues();
        const errs = issues.filter((i) => i.level === 'err').length;
        const sizeKb = (JSON.stringify(d).length / 1024).toFixed(0);
        const S = (p2) => '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p2 + '</svg>';
        const SVGS = {
          folder: S('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>'),
          layout: S('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
          list: S('<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'),
          award: S('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>')
        };
        const pub = state.unpublished
          ? '<div class="pub-warn"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12" y1="16" y2="16.01"/></svg><div><b>Brouillon en avance sur le site publié.</b><br>Exportez puis poussez sur Git pour mettre en ligne.</div></div>'
          : '<div class="pub-ok"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><div><b>Contenu synchronisé.</b><br>' + (state.hasDraft ? 'Le brouillon correspond au repo.' : 'Aucun brouillon, le repo fait foi.') + '</div></div>';
        const health = issues.length === 0
          ? '<div class="pub-ok"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><div><b>Aucun problème détecté.</b><br>Titres, images, liens et traductions sont en ordre.</div></div>'
          : '<div class="health-list">' + issues.slice(0, 8).map((i) =>
            '<div class="health-item ' + i.level + '">' + (i.level === 'err'
              ? S('<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12" y1="16" y2="16.01"/>')
              : S('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>')) +
            '<div><b>' + esc(i.label) + '</b> <span style="color:var(--g5)">· ' + esc(VIEW_NAMES[i.view] || i.view) + '</span><br>' + esc(i.detail) + '</div>' +
            '<button class="btn-sm tag-act" data-act="go-view" data-view="' + i.view + '">Ouvrir</button></div>').join('') +
            (issues.length > 8 ? '<p class="desc">… et ' + (issues.length - 8) + ' autres.</p>' : '') + '</div>';
        function stat(n, l, icoKey, sub) {
          return '<div class="stat"><div class="stat-ico">' + (SVGS[icoKey] || '') + '</div><div class="n">' + n + '</div><div class="l">' + l + '</div><div class="sub">' + esc(sub) + '</div></div>';
        }
        return '<div class="stat-grid">' +
          stat(np, 'Projets', 'folder', feat + ' vedettes · ' + (np - feat) + ' grille') +
          stat(ns, 'Services', 'layout', 'lignes de service') +
          stat(nk, 'Compétences', 'list', 'outils et expertises') +
          stat(nc, 'Certifications', 'award', 'diplômes et certificats') + '</div>' +
          '<div class="dash-cols">' +
          '<div class="card"><div class="card-head"><div><h3>Publication</h3><p class="desc">Dernière mise à jour : ' + esc(d.updatedAt || '-') + ' · brouillon : ' + sizeKb + ' Ko</p></div>' +
          '<button class="btn-sm" data-act="go-view" data-view="settings">Ouvrir l’export</button></div>' + pub + '</div>' +
          '<div class="card"><div class="card-head"><div><h3>Qualité du contenu</h3><p class="desc">' +
          (issues.length ? errs + ' erreur(s), ' + (issues.length - errs) + ' avertissement(s)' : 'Tout est en ordre') + '</p></div></div>' + health + '</div>' +
          '</div>' +
          '<div class="card"><div class="card-head"><div><h3>Actions rapides</h3></div></div>' +
          '<div class="quick-grid">' +
          '<button class="quick" data-act="prj-add-go"><span class="q-ico"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></span><span><b>Nouveau projet</b><span>Créer puis remplir FR/EN</span></span></button>' +
          '<button class="quick" data-act="toggle-preview"><span class="q-ico"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></span><span><b>Aperçu du site</b><span>Voir le rendu du brouillon</span></span></button>' +
          '<button class="quick" data-act="go-view" data-view="audience"><span class="q-ico"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16v-3"/><path d="M12 16V8"/><path d="M17 16v-5"/></svg></span><span><b>Audience</b><span>Visiteurs réels du site</span></span></button>' +
          '<button class="quick" data-act="go-view" data-view="settings"><span class="q-ico"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg></span><span><b>Exporter</b><span>Publier sur Vercel</span></span></button>' +
          '</div></div>';
      }
    },
    hero: {
      title: 'Hero', sub: 'Haut de page : accroche, chiffres, boutons, photo.',
      render() {
        const h = state.data.hero, p = state.data.profile;
        return '<div class="card"><div class="card-head"><div><h3>Accroche</h3><p class="desc">Première impression du site, en deux langues.</p></div></div>' +
          biShort('Label', 'hero.eyebrow', h.eyebrow.en, h.eyebrow.fr) +
          bi('Phrase', 'hero.desc', h.desc.en, h.desc.fr) +
          biShort('Ligne de preuve', 'hero.loc', h.loc.en, h.loc.fr) + '</div>' +
          '<div class="card"><div class="card-head"><div><h3>Chiffres clés</h3><p class="desc">Trois statistiques affichées sous la phrase.</p></div></div>' +
          (h.stats || []).map((s, i) => '<div class="item"><div class="grid2">' +
            fld('Valeur ' + (i + 1), 'hero.stats.' + i + '.n', s.n, 'text', 12) + '<div></div>' +
            fld('Libellé · FR', 'hero.stats.' + i + '.label_fr', s.label_fr) +
            fld('Libellé · EN', 'hero.stats.' + i + '.label_en', s.label_en) +
            '</div></div>').join('') + '</div>' +
          '<div class="card"><div class="card-head"><div><h3>Boutons et photo</h3></div></div>' +
          biShort('Bouton projets', 'hero.btnProjects', h.btnProjects.en, h.btnProjects.fr) +
          biShort('Bouton contact', 'hero.btnContact', h.btnContact.en, h.btnContact.fr) +
          biShort('Lien CV', 'hero.btnCv', h.btnCv.en, h.btnCv.fr) +
          imgFld('Photo du hero', 'profile.photo', p.photo) + '</div>';
      }
    },
    services: {
      title: 'Services', sub: 'Lignes de services + méthode de travail.',
      render() {
        if (state.editingSvc != null) { return svcEditorHTML(state.data.services.items[state.editingSvc], state.editingSvc); }
        const s = state.data.services;
        return '<div class="card"><div class="card-head"><div><h3>En-tête</h3></div></div>' +
          biShort('Label', 'services.label', s.label.en, s.label.fr) +
          biShort('Titre, partie 1', 'services.title1', s.title1.en, s.title1.fr) +
          '<div class="grid2"><label class="fld"><span>Titre, partie 2 · FR</span><input data-bind="services.title2.fr" value="' + esc(s.title2.fr) + '"></label>' +
          '<label class="fld"><span>Titre, partie 2 · EN</span><input data-bind="services.title2.en" value="' + esc(s.title2.en) + '"></label></div>' +
          bi('Sous-titre', 'services.sub', s.sub.en, s.sub.fr) + '</div>' +
          '<div class="card"><div class="row-head"><h4>Services <span class="pill">' + s.items.length + '</span></h4><button class="btn-sm primary" data-act="svc-add-go"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Ajouter</button></div>' +
          '<div class="search row-search"><input id="svc-search" placeholder="Filtrer les services" value="' + esc(state.svcQuery || '') + '"></div>' +
          s.items.map((it, i) => '<div class="item"><button type="button" class="prj-open svc-open" data-act="svc-open" data-idx="' + i + '">' +
            '<span class="q-ico"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg></span>' +
            '<span class="prj-open-txt"><b>' + esc(it.title_fr || it.title_en || 'Sans titre') + '</b>' +
            '<span>' + esc(it.title_en || '') + '</span><em>icône : ' + esc(it.icon || 'chart') + '</em></span>' +
            '<svg class="ic prj-open-arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>' +
            '<div class="item-actions"><button class="btn-sm" data-act="svc-up" data-idx="' + i + '" title="Monter"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19V5"/><path d="m5 12 7-7 7 7"/></svg></button><button class="btn-sm" data-act="svc-down" data-idx="' + i + '" title="Descendre"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></button><button class="btn-sm" data-act="svc-dup" data-idx="' + i + '" title="Dupliquer"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></button><button class="btn-sm danger" data-act="svc-del" data-idx="' + i + '" title="Supprimer"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button></div></div>').join('') + '</div>' +
          '<div class="card"><div class="card-head"><div><h3>Méthode</h3><p class="desc">Bloc « How I work » sous la grille.</p></div></div>' +
          biShort('Titre méthode', 'services.howTitle', s.howTitle.en, s.howTitle.fr) +
          s.how.map((h2, i) => '<div class="item"><div class="grid2">' +
            fld('Titre · FR', 'services.how.' + i + '.t_fr', h2.t_fr) +
            fld('Titre · EN', 'services.how.' + i + '.t_en', h2.t_en) +
            fldArea('Texte · FR', 'services.how.' + i + '.d_fr', h2.d_fr) +
            fldArea('Texte · EN', 'services.how.' + i + '.d_en', h2.d_en) +
            '</div></div>').join('') + '</div>';
      }
    },
    projects: {
      title: 'Projets', sub: 'Cartes vedettes + grille. Recherche et filtres inclus.',
      render() {
        if (state.editingProject != null) { return projectEditorHTML(state.data.projects.items[state.editingProject], state.editingProject); }
        const pr = state.data.projects;
        return '<div class="card"><div class="card-head"><div><h3>En-tête</h3></div></div>' +
          biShort('Label', 'projects.label', pr.label.en, pr.label.fr) +
          biShort('Titre 1', 'projects.title1', pr.title1.en, pr.title1.fr) +
          biShort('Titre 2', 'projects.title2', pr.title2.en, pr.title2.fr) +
          bi('Sous-titre', 'projects.sub', pr.sub.en, pr.sub.fr) + '</div>' +
          '<div class="card"><div class="row-head"><h4>Projets <span class="pill" id="prj-count">' + pr.items.length + '</span></h4>' +
          '<button class="btn-sm primary" data-act="prj-add-go"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Ajouter un projet</button></div>' +
          '<div class="toolbar" style="margin-bottom:.9rem"><div class="search"><input id="prj-search" placeholder="Rechercher un projet" value="' + esc(state.prjQuery) + '"></div>' +
          '<select class="inline" id="prj-filter"><option value="all">Toutes mises en page</option>' +
          '<option value="featured"' + (state.prjLayout === 'featured' ? ' selected' : '') + '>Vedettes</option>' +
          '<option value="grid"' + (state.prjLayout === 'grid' ? ' selected' : '') + '>Grille</option></select></div>' +
          '<div id="prj-list">' + (pr.items.length
            ? pr.items.map((p, i) => projectRow(p, i)).join('')
            : '<div class="empty-state"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg><b>Aucun projet pour le moment.</b><span>Crée ton premier projet, remplis le formulaire sur une page, enregistre.</span><button class="btn-sm primary" data-act="prj-add-go">Créer un projet</button></div>') + '</div></div>';
      }
    },
    finmodel: {
      title: 'Modélisation financière', sub: 'Section Financial Modeling.',
      render() {
        const f = state.data.finmodel;
        return '<div class="card"><div class="card-head"><div><h3>Textes</h3></div></div>' +
          biShort('Label', 'finmodel.label', f.label.en, f.label.fr) +
          biShort('Titre 1', 'finmodel.title1', f.title1.en, f.title1.fr) +
          biShort('Titre 2', 'finmodel.title2', f.title2.en, f.title2.fr) +
          bi('Sous-titre', 'finmodel.sub', f.sub.en, f.sub.fr) +
          bi('Explication simple', 'finmodel.plain', f.plain.en, f.plain.fr) +
          bi('Explication 2', 'finmodel.plain2', f.plain2.en, f.plain2.fr) + '</div>' +
          '<div class="card"><div class="row-head"><h4>Stats (' + f.stats.length + ')</h4></div>' +
          f.stats.map((s, i) => '<div class="item"><div class="grid2">' +
            fld('Valeur', 'finmodel.stats.' + i + '.v', s.v, 'text', 12) + '<div></div>' +
            fld('Libellé · FR', 'finmodel.stats.' + i + '.l_fr', s.l_fr) +
            fld('Libellé · EN', 'finmodel.stats.' + i + '.l_en', s.l_en) +
            '</div></div>').join('') + '</div>' +
          '<div class="card"><div class="row-head"><h4>Fonctionnalités (' + f.features.length + ')</h4></div>' +
          f.features.map((x, i) => '<div class="item"><div class="grid2">' +
            fld('Titre · FR', 'finmodel.features.' + i + '.t_fr', x.t_fr) +
            fld('Titre · EN', 'finmodel.features.' + i + '.t_en', x.t_en) +
            fldArea('Texte · FR', 'finmodel.features.' + i + '.d_fr', x.d_fr) +
            fldArea('Texte · EN', 'finmodel.features.' + i + '.d_en', x.d_en) +
            '</div></div>').join('') + '</div>';
      }
    },
    skills: {
      title: 'Compétences', sub: 'Expertise principale, technologies et outils annexes.',
      render() {
        if (state.editingSkill != null) { return skEditorHTML(state.data.skills.items[state.editingSkill], state.editingSkill); }
        const sk = state.data.skills;
        return '<div class="card"><div class="card-head"><div><h3>En-tête</h3></div></div>' +
          biShort('Label', 'skills.label', sk.label.en, sk.label.fr) +
          biShort('Titre 1', 'skills.title1', sk.title1.en, sk.title1.fr) +
          biShort('Titre 2', 'skills.title2', sk.title2.en, sk.title2.fr) +
          bi('Sous-titre', 'skills.sub', sk.sub.en, sk.sub.fr) +
          '<div class="grid2">' +
          biShort('Groupe 1, titre', 'skills.coreTitle', sk.coreTitle ? sk.coreTitle.en : '', sk.coreTitle ? sk.coreTitle.fr : '') +
          biShort('Groupe 2, titre', 'skills.techTitle', sk.techTitle ? sk.techTitle.en : '', sk.techTitle ? sk.techTitle.fr : '') + '</div>' +
          biShort('Groupe 3, titre', 'skills.toolsTitle', sk.toolsTitle ? sk.toolsTitle.en : '', sk.toolsTitle ? sk.toolsTitle.fr : '') + '</div>' +
          '<div class="card"><div class="row-head"><h4>Compétences <span class="pill">' + sk.items.length + '</span></h4><button class="btn-sm primary" data-act="sk-add-go"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Ajouter</button></div>' +
          '<div class="search row-search"><input id="sk-search" placeholder="Filtrer les compétences" value="' + esc(state.skQuery || '') + '"></div>' +
          sk.items.map((s2, i) => '<div class="item sk-row"><button type="button" class="prj-open svc-open" data-act="sk-open" data-idx="' + i + '">' +
            '<span class="prj-open-txt"><b>' + esc(s2.name_fr || s2.name_en || 'Sans titre') + '</b>' +
            '<span>' + esc(s2.name_en || '') + '</span></span>' +
            '<svg class="ic prj-open-arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>' +
            '<div class="item-actions"><button class="btn-sm" data-act="sk-up" data-idx="' + i + '" title="Monter"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19V5"/><path d="m5 12 7-7 7 7"/></svg></button><button class="btn-sm" data-act="sk-down" data-idx="' + i + '" title="Descendre"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></button><button class="btn-sm danger" data-act="sk-del" data-idx="' + i + '" title="Supprimer"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button></div></div>').join('') + '</div>' +
          '<div class="card"><div class="card-head"><div><h3>Outils annexes</h3></div></div>' +
          bi('Liste annexe', 'skills.extra', sk.extra.en, sk.extra.fr) + '</div>';
      }
    },
    certs: {
      title: 'Certifications', sub: 'Diplômes et certificats (boutons + viewer).',
      render() {
        if (state.editingCert != null) { return certEditorHTML(state.data.certifications.items[state.editingCert], state.editingCert); }
        const c = state.data.certifications;
        return '<div class="card"><div class="card-head"><div><h3>En-tête</h3></div></div>' +
          biShort('Label', 'certifications.label', c.label.en, c.label.fr) +
          biShort('Titre 1', 'certifications.title1', c.title1.en, c.title1.fr) +
          biShort('Titre 2', 'certifications.title2', c.title2.en, c.title2.fr) +
          bi('Sous-titre', 'certifications.sub', c.sub.en, c.sub.fr) +
          bi('Note', 'certifications.note', c.note.en, c.note.fr) + '</div>' +
          '<div class="card"><div class="row-head"><h4>Certifications <span class="pill">' + c.items.length + '</span></h4><button class="btn-sm primary" data-act="cert-add-go"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Ajouter</button></div>' +
          '<div class="search row-search"><input id="cert-search" placeholder="Filtrer les certifications" value="' + esc(state.certQuery || '') + '"></div>' +
          '<div class="help">Le champ <b>Clé viewer</b> relie la carte à l’image protégée (clés connues : ' + KNOWN_CERTS.join(', ') + ').</div>' +
          c.items.map((it, i) => '<div class="item"><div class="item-head"><span class="item-title">' + (i + 1) + '. ' + esc(it.title_fr || it.title_en || 'Sans titre') + '</span>' +
            '<div class="item-actions"><button class="btn-sm" data-act="cert-up" data-idx="' + i + '" title="Monter"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19V5"/><path d="m5 12 7-7 7 7"/></svg></button><button class="btn-sm" data-act="cert-down" data-idx="' + i + '" title="Descendre"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></button><button class="btn-sm danger" data-act="cert-del" data-idx="' + i + '" title="Supprimer"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button></div></div>' +
            '<div class="grid2">' +
            '<button type="button" class="prj-open cert-open" data-act="cert-open" data-idx="' + i + '"><span class="cert-open-badge cb-' + esc(it.color || 'blue') + '">' + esc(it.badge || '•') + '</span>' +
            '<span class="prj-open-txt"><b>' + esc(it.title_fr || it.title_en || 'Sans titre') + '</b>' +
            '<span>' + esc(it.org_fr || it.org_en || '') + '</span><em>' + esc(it.certKey || 'pas de clé viewer') + '</em></span>' +
            '<svg class="ic prj-open-arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>' +
            '</div></div>').join('') + '</div>';
      }
    },
    cv: {
      title: 'Curriculum Vitae & Expériences', sub: 'Synchronisation automatique avec projets, certifications et compétences.',
      render() {
        const d = state.data;
        d.cv = d.cv || {};
        const cv = d.cv;
        cv.experiences = cv.experiences || [];
        cv.keySkills = cv.keySkills || [];
        cv.education = cv.education || [];
        cv.references = cv.references || [];
        cv.cvProjects = cv.cvProjects || [];

        const cvLang = state.cvLang || 'fr';
        const isFr = cvLang === 'fr';

        // 1. Barre d'action supérieure + Aperçu A4
        const topBar = '<div class="card"><div class="row-head"><div>' +
          '<h3>Aperçu du CV synchronisé</h3>' +
          '<p class="desc">Aperçu en direct format A4. Dès qu’un projet, une certification ou une expérience est modifié, le CV est instantanément actualisé.</p></div>' +
          '<div class="toolbar" style="margin:0">' +
          '<div class="seg" role="group" aria-label="Langue du CV">' +
          '<button class="' + (isFr ? 'on' : '') + '" data-act="cv-lang" data-idx="fr">FR</button>' +
          '<button class="' + (!isFr ? 'on' : '') + '" data-act="cv-lang" data-idx="en">EN</button>' +
          '</div>' +
          '<button class="btn-sm primary" data-act="cv-print"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>Imprimer / PDF</button>' +
          '<a href="../cv.html?lang=' + cvLang + '" target="_blank" class="tool-btn"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>Ouvrir la page CV</a>' +
          '</div></div>' +
          '<div style="margin-top:1.2rem;overflow-x:auto;padding-bottom:1rem">' +
          renderCvDocument(d, cvLang) +
          '</div></div>';

        // 2. Profil & Titre CV
        const profileCard = '<div class="card"><div class="card-head"><div><h3>Accroche &amp; Profil du CV</h3><p class="desc">Titre et synthèse professionnelle en tête de CV.</p></div></div>' +
          biShort('Titre du CV', 'cv.title', cv.title ? cv.title.en : '', cv.title ? cv.title.fr : '') +
          bi('Profil / Résumé', 'cv.summary', cv.summary ? cv.summary.en : '', cv.summary ? cv.summary.fr : '') + '</div>';

        // 3. Expériences professionnelles (CRUD)
        const expCards = cv.experiences.map((exp, i) => {
          const bulletsFr = exp.bullets_fr || [];
          const bulletsEn = exp.bullets_en || [];
          const bCount = Math.max(bulletsFr.length, bulletsEn.length, 1);
          let bulletInputs = '';
          for (let b = 0; b < bCount; b++) {
            bulletInputs += '<div class="cv-bullet-row">' +
              '<input data-bind="cv.experiences.' + i + '.bullets_fr.' + b + '" value="' + esc(bulletsFr[b] || '') + '" placeholder="Puce ' + (b + 1) + ' (FR)">' +
              '<input data-bind="cv.experiences.' + i + '.bullets_en.' + b + '" value="' + esc(bulletsEn[b] || '') + '" placeholder="Puce ' + (b + 1) + ' (EN)">' +
              '<button class="btn-sm danger" data-act="cv-bullet-del" data-idx="' + i + '" data-sub="' + b + '" title="Supprimer la puce">×</button>' +
              '</div>';
          }

          return '<div class="cv-exp-card">' +
            '<div class="item-head">' +
            '<span class="item-title"><b>' + (i + 1) + '. ' + esc(exp.company || 'Entreprise') + '</b>' +
            (exp.role_fr ? ' — ' + esc(exp.role_fr) : '') + '</span>' +
            '<div class="item-actions">' +
            '<button class="btn-sm" data-act="cv-exp-up" data-idx="' + i + '" title="Monter"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19V5"/><path d="m5 12 7-7 7 7"/></svg></button>' +
            '<button class="btn-sm" data-act="cv-exp-down" data-idx="' + i + '" title="Descendre"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></button>' +
            '<button class="btn-sm" data-act="cv-exp-dup" data-idx="' + i + '" title="Dupliquer"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
            '<button class="btn-sm danger" data-act="cv-exp-del" data-idx="' + i + '" title="Supprimer"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>' +
            '</div></div>' +
            '<div class="grid2">' +
            fld('Entreprise', 'cv.experiences.' + i + '.company', exp.company) +
            fld('Lieu', 'cv.experiences.' + i + '.location', exp.location) +
            '</div>' +
            '<div class="grid2">' +
            fld('Période (FR)', 'cv.experiences.' + i + '.period_fr', exp.period_fr) +
            fld('Période (EN)', 'cv.experiences.' + i + '.period_en', exp.period_en) +
            '</div>' +
            '<div class="grid2">' +
            fld('Intitulé du poste (FR)', 'cv.experiences.' + i + '.role_fr', exp.role_fr) +
            fld('Intitulé du poste (EN)', 'cv.experiences.' + i + '.role_en', exp.role_en) +
            '</div>' +
            '<div style="margin-top:.7rem"><div class="row-head"><label class="fld-lbl">Missions et réalisations clés (puces)</label>' +
            '<button class="btn-sm" data-act="cv-bullet-add" data-idx="' + i + '">+ Ajouter une puce</button></div>' +
            bulletInputs + '</div>' +
            '</div>';
        }).join('');

        const expsCard = '<div class="card"><div class="card-head"><div><h3>Expériences professionnelles</h3><p class="desc">Vos postes, stages et missions freelance.</p></div>' +
          '<button class="btn-sm primary" data-act="cv-exp-add">+ Ajouter une expérience</button></div>' +
          (expCards || '<div class="empty-state">Aucune expérience saisie.</div>') + '</div>';

        // 4. Projets pertinents synchronisés
        const projectsCard = '<div class="card"><div class="card-head"><div>' +
          '<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.2rem">' +
          '<h3 style="margin:0">Projets pertinents du CV</h3>' +
          '<span class="cv-sync-pill"><span class="dot"></span>Synchronisé avec Projets</span></div>' +
          '<p class="desc">Les projets ci-dessous sont synchronisés avec votre portfolio et intégrés dans le CV.</p></div></div>' +
          cv.cvProjects.map((cp, i) =>
            '<div class="item" style="padding:.8rem"><div class="grid2">' +
            fld('Titre projet (FR)', 'cv.cvProjects.' + i + '.title_fr', cp.title_fr) +
            fld('Titre projet (EN)', 'cv.cvProjects.' + i + '.title_en', cp.title_en) +
            '</div><div class="grid2">' +
            fld('Descriptif CV (FR)', 'cv.cvProjects.' + i + '.desc_fr', cp.desc_fr) +
            fld('Descriptif CV (EN)', 'cv.cvProjects.' + i + '.desc_en', cp.desc_en) +
            '</div></div>'
          ).join('') +
          '<div class="help" style="margin-top:.5rem">Toute modification faite dans la section <b>Projets</b> enrichit automatiquement les descriptions et métriques disponibles pour le CV.</div>' +
          '</div>';

        // 5. Formation & Certifications
        const eduList = (cv.education || []).map((ed, i) =>
          '<div class="item" style="padding:.8rem"><div class="item-head">' +
          '<span class="item-title">' + esc(ed.degree_fr || ed.degree_en || 'Diplôme') + '</span>' +
          '<button class="btn-sm danger" data-act="cv-edu-del" data-idx="' + i + '">Supprimer</button></div>' +
          '<div class="grid2">' +
          fld('Diplôme (FR)', 'cv.education.' + i + '.degree_fr', ed.degree_fr) +
          fld('Diplôme (EN)', 'cv.education.' + i + '.degree_en', ed.degree_en) +
          '</div><div class="grid2">' +
          fld('Établissement', 'cv.education.' + i + '.school_fr', ed.school_fr) +
          fld('Année / Détails', 'cv.education.' + i + '.year', ed.year) +
          '</div></div>'
        ).join('');

        const certsPreview = (d.certifications.items || []).map((c) =>
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--g1);font-size:.84rem">' +
          '<div><b>' + esc(c.title_fr || c.title_en) + '</b> <span style="color:var(--g5)">(' + esc(c.org_fr || c.org_en) + ')</span></div>' +
          '<span class="cv-sync-pill"><span class="dot"></span>Actif sur CV</span></div>'
        ).join('');

        const eduCertsCard = '<div class="card"><div class="card-head"><div><h3>Formation &amp; Diplômes</h3></div>' +
          '<button class="btn-sm" data-act="cv-edu-add">+ Ajouter un diplôme</button></div>' +
          eduList +
          '<div style="margin-top:1.5rem"><div class="card-head"><div>' +
          '<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.2rem">' +
          '<h3 style="margin:0">Certifications synchronisées</h3>' +
          '<span class="cv-sync-pill"><span class="dot"></span>En direct depuis Certifications</span></div>' +
          '<p class="desc">Toutes les certifications ajoutées dans l’onglet Certifications apparaissent automatiquement ci-dessous et dans le CV.</p></div></div>' +
          certsPreview + '</div></div>';

        // 6. Compétences clés du CV
        const skillsCard = '<div class="card"><div class="card-head"><div><h3>Compétences clés du CV</h3><p class="desc">Points forts affichés dans le bloc COMPÉTENCES CLÉS.</p></div>' +
          '<button class="btn-sm" data-act="cv-skill-add">+ Ajouter une compétence clé</button></div>' +
          cv.keySkills.map((sk, i) =>
            '<div class="item" style="padding:.6rem"><div style="display:flex;gap:.6rem;align-items:center">' +
            '<div style="flex:1" class="grid2">' +
            fld('Texte (FR)', 'cv.keySkills.' + i + '.fr', sk.fr) +
            fld('Texte (EN)', 'cv.keySkills.' + i + '.en', sk.en) +
            '</div>' +
            '<button class="btn-sm danger" data-act="cv-skill-del" data-idx="' + i + '" title="Supprimer" style="align-self:center">×</button>' +
            '</div></div>'
          ).join('') + '</div>';

        // 7. Références professionnelles
        const refsCard = '<div class="card"><div class="card-head"><div><h3>Références professionnelles</h3></div>' +
          '<button class="btn-sm" data-act="cv-ref-add">+ Ajouter une référence</button></div>' +
          cv.references.map((rf, i) =>
            '<div class="item" style="padding:.8rem"><div class="item-head">' +
            '<span class="item-title">' + esc(rf.name || 'Référent') + '</span>' +
            '<button class="btn-sm danger" data-act="cv-ref-del" data-idx="' + i + '">Supprimer</button></div>' +
            '<div class="grid2">' +
            fld('Nom', 'cv.references.' + i + '.name', rf.name) +
            fld('Téléphone / Contact', 'cv.references.' + i + '.phone', rf.phone) +
            '</div><div class="grid2">' +
            fld('Fonction & Entreprise (FR)', 'cv.references.' + i + '.title_fr', rf.title_fr) +
            fld('Fonction & Entreprise (EN)', 'cv.references.' + i + '.title_en', rf.title_en) +
            '</div></div>'
          ).join('') + '</div>';

        return topBar + profileCard + expsCard + projectsCard + eduCertsCard + skillsCard + refsCard;
      }
    },
    about: {
      title: 'À propos', sub: 'Biographie + formations + objectif.',
      render() {
        const a = state.data.about, p = state.data.profile;
        return '<div class="card"><div class="card-head"><div><h3>Textes</h3></div></div>' +
          biShort('Label', 'about.label', a.label.en, a.label.fr) +
          biShort('Tag', 'about.tag', a.tag.en, a.tag.fr) +
          '<div class="grid2">' + fld('Titre ligne 1 (FR)', 'about.heading1.fr', a.heading1.fr) + fld('Titre ligne 1 (EN)', 'about.heading1.en', a.heading1.en) + '</div>' +
          '<div class="grid2">' + fld('Titre ligne 2 (FR)', 'about.heading3.fr', a.heading3.fr) + fld('Titre ligne 2 (EN)', 'about.heading3.en', a.heading3.en) + '</div>' +
          bi('Paragraphe 1', 'about.p1', a.p1.en, a.p1.fr) +
          bi('Paragraphe 2', 'about.p2', a.p2.en, a.p2.fr) +
          bi('Paragraphe 3', 'about.p3', a.p3.en, a.p3.fr) +
          bi('Objectif', 'about.goal', a.goal.en, a.goal.fr) + '</div>' +
          '<div class="card"><div class="card-head"><div><h3>Formations dispensées</h3><p class="desc">Les 2 cartes sous la biographie.</p></div></div>' +
          biShort('Formation 1, badge', 'about.train1tag', a.train1tag ? a.train1tag.en : '', a.train1tag ? a.train1tag.fr : '') +
          biShort('Formation 1, titre', 'about.train1t', a.train1t.en, a.train1t.fr) +
          bi('Formation 1, texte', 'about.train1d', a.train1d.en, a.train1d.fr) +
          biShort('Formation 2, badge', 'about.train2tag', a.train2tag ? a.train2tag.en : '', a.train2tag ? a.train2tag.fr : '') +
          biShort('Formation 2, titre', 'about.train2t', a.train2t.en, a.train2t.fr) +
          bi('Formation 2, texte', 'about.train2d', a.train2d.en, a.train2d.fr) +
          imgFld('Photo À propos', 'profile.photoAbout', p.photoAbout) + '</div>';
      }
    },
    contact: {
      title: 'Contact et profil', sub: 'Coordonnées, liens, CV.',
      render() {
        const c = state.data.contact, p = state.data.profile;
        return '<div class="card"><div class="card-head"><div><h3>Profil</h3><p class="desc">Utilisé dans le hero, la navigation et la section contact.</p></div></div><div class="grid2">' +
          fld('Prénom', 'profile.firstName', p.firstName) +
          fld('Second prénom', 'profile.middleName', p.middleName) +
          fld('Nom', 'profile.lastName', p.lastName) +
          fld('Localisation', 'profile.location', p.location) +
          fld('Email', 'profile.email', p.email) +
          fld('Téléphone (affiché)', 'profile.phone', p.phone) +
          fld('Téléphone (lien)', 'profile.phoneLink', p.phoneLink) +
          fld('LinkedIn (URL)', 'profile.linkedin', p.linkedin) +
          fld('GitHub (URL)', 'profile.github', p.github) +
          '</div></div>' +
          '<div class="card"><div class="card-head"><div><h3>Section contact</h3></div></div>' +
          '<div class="grid2">' + fld('Titre 1', 'contact.big1', c.big1) + fld('Titre 2', 'contact.big2', c.big2) + '</div>' +
          '<div class="grid2">' + fld('Titre 3 (accent)', 'contact.big3', c.big3) + fld('Disponibilité', 'contact.avail', c.avail) + '</div>' +
          bi('Sous-titre', 'contact.sub', c.sub.en, c.sub.fr) +
          biShort('Bloc CV, titre', 'contact.cvTitle', c.cvTitle ? c.cvTitle.en : '', c.cvTitle ? c.cvTitle.fr : '') +
          imgFld('CV professionnel (PDF)', 'profile.cvPro', p.cvPro) +
          imgFld('CV académique (PDF)', 'profile.cvAca', p.cvAca) + '</div>';
      }
    },
    media: {
      title: 'Médias', sub: 'Fichiers disponibles, cliquez pour copier le chemin.',
      render() {
        const q = state.mediaQuery.toLowerCase();
        const match = (x) => !q || x.toLowerCase().indexOf(q) !== -1;
        const imgs = MEDIA_PATHS.filter((x) => /\.(webp|jpg|jpeg|png|svg)$/.test(x) && match(x));
        const vids = MEDIA_PATHS.filter((x) => /\.(mp4|webm)$/.test(x) && match(x));
        const docs = MEDIA_PATHS.filter((x) => /\.pdf$/.test(x) && match(x));
        const block = (title, arr, isImg) => '<div class="card"><div class="row-head"><h4>' + title + ' <span class="pill">' + arr.length + '</span></h4></div>' +
          (arr.length ? '<div class="media-grid">' +
            arr.map((x) => '<div class="media-cell" data-search="' + esc(x.toLowerCase()) + '">' +
              (isImg ? '<img src="../' + esc(x) + '" loading="lazy" onerror="this.style.display=\'none\'" alt="">' : '') +
              '<div class="mp">' + esc(x) + '</div><button class="btn-sm" data-act="copy" data-idx="' + esc(x) + '">Copier</button></div>').join('') +
            '</div>' : '<p class="desc">Aucun fichier trouvé.</p>') + '</div>';
        return '<div class="card"><div class="toolbar"><div class="search"><input id="media-search" placeholder="Filtrer par nom de fichier" value="' + esc(state.mediaQuery) + '"></div></div></div>' +
          '<div class="help">Pour ajouter un média : déposez le fichier dans <code>assets/…</code> via votre explorateur ou Git, puis collez son chemin dans le champ image du projet. Formats conseillés : <b>WebP</b> (images), <b>mp4</b> (démos).</div>' +
          block('Images', imgs, true) + block('Vidéos', vids, false) + block('Documents', docs, false);
      }
    },
    seo: {
      title: 'SEO', sub: 'Métadonnées et Open Graph (brouillon appliqué au site public).',
      render() {
        const p = state.data.profile;
        return '<div class="card"><div class="card-head"><div><h3>Meta générales</h3><p class="desc">Appliquées au chargement du site quand le brouillon diffère du repo. Champ vide = retombée sur l’autre langue.</p></div></div>' +
          biShort('Titre du site', 'profile.seoTitle', (p.seoTitle && p.seoTitle.en) || '', (p.seoTitle && p.seoTitle.fr) || '') +
          bi('Meta description', 'profile.seoDesc', (p.seoDesc && p.seoDesc.en) || '', (p.seoDesc && p.seoDesc.fr) || '') + '</div>' +
          '<div class="card"><div class="card-head"><div><h3>Open Graph (partage réseaux)</h3></div></div>' +
          biShort('Titre OG', 'profile.ogTitle', (p.ogTitle && p.ogTitle.en) || '', (p.ogTitle && p.ogTitle.fr) || '') +
          bi('Description OG', 'profile.ogDesc', (p.ogDesc && p.ogDesc.en) || '', (p.ogDesc && p.ogDesc.fr) || '') +
          imgFld('Image de partage', 'profile.ogImage', p.ogImage || '') +
          '<div class="help">Conseillé : image 1200×630, texte lisible, moins de 300 Ko (WebP ou PNG).</div></div>';
      }
    },
    audience: {
      title: 'Audience', sub: 'Visiteurs réels — mesure anonyme, sans cookies ni données personnelles.',
      render() {
        const days = state.anDays || 30;
        return '<div class="card"><div class="card-head"><div><h3>Statistiques du site</h3><p class="desc">Compteurs mesurés par le site (production uniquement), stockés agrégés côté serveur.</p></div></div>' +
          '<div class="seg" id="an-range" role="group" aria-label="Période">' +
          [[7, '7 jours'], [14, '14 jours'], [30, '30 jours'], [90, '90 jours']].map((o) =>
            '<button data-days="' + o[0] + '"' + (days === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>').join('') + '</div>' +
          '<div id="an-body" style="margin-top:1rem"><div class="help">Chargement des statistiques…</div></div></div>' +
          '<div class="card"><div class="card-head"><div><h3>Comment ça marche</h3></div></div>' +
          '<div class="health-item"><span class="mono-note">Vie privée</span><div>Aucune donnée personnelle : uniquement un compteur de pages vues par jour, page et source. Aucun cookie, aucune identification individuelle.</div></div>' +
          '<div class="health-item"><span class="mono-note">Production</span><div>Les visites locales (localhost) ne sont jamais comptées.</div></div></div>';
      }
    },
    activity: {
      title: "Journal d'activité", sub: 'Actions récentes, stockées localement (120 dernières).',
      render() {
        const arr = getAct();
        if (!arr.length) {
          return '<div class="card"><div class="empty-state"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><b>Aucune action enregistrée.</b><span>Connexions, éditions et exports apparaîtront ici.</span></div></div>';
        }
        return '<div class="card"><div class="row-head"><h4>' + arr.length + ' action(s)</h4><button class="btn-sm danger" data-act="act-clear">Vider le journal</button></div>' +
          '<div class="act-list">' + arr.map((a) => {
            const d2 = new Date(a.t);
            const stamp = d2.toLocaleDateString('fr-FR') + ' ' + d2.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return '<div class="act-row"><span class="act-dot"></span><div><b>' + esc(a.action) + '</b>' + (a.detail ? ' — ' + esc(a.detail) : '') + '</div><time>' + stamp + '</time></div>';
          }).join('') + '</div></div>';
      }
    },
    settings: {
      title: 'Réglages et export', sub: 'Publication, sauvegarde, sécurité.',
      render() {
        const sizeKb = (o) => (JSON.stringify(o).length / 1024).toFixed(1) + ' Ko';
        const en = buildI18n('en'), fr = buildI18n('fr');
        const fileRow = (name, size, desc, act) =>
          '<div class="file-row"><div class="file-face file-ico">JS</div><div><b>' + name + '</b><span>' + size + ' · ' + desc + '</span></div>' +
          '<button class="btn-sm" data-act="' + act + '">Télécharger</button></div>';
        return '<div class="card"><div class="card-head"><div><h3>Publication</h3><p class="desc">' +
          (state.unpublished ? 'Le brouillon contient des changements non publiés.' : 'Rien à publier, tout est synchronisé.') + '</p></div>' +
          '<button class="btn-sm primary" data-act="dl-all">Tout télécharger</button></div>' +
          fileRow('site.json', sizeKb(state.data), 'contenu canonique, dossier data/', 'dl-site') +
          fileRow('en.json', sizeKb(en), 'dictionnaire anglais, dossier i18n/', 'dl-en') +
          fileRow('fr.json', sizeKb(fr), 'dictionnaire français, dossier i18n/', 'dl-fr') +
          '<details class="export"><summary>Procédure de mise en ligne</summary><ol>' +
          '<li>Cliquez <b>Tout télécharger</b>.</li><li>Remplacez <code>data/site.json</code>, <code>i18n/en.json</code>, <code>i18n/fr.json</code> dans le dossier du projet.</li>' +
          '<li>Lancez la commande ci-dessous, puis poussez.</li><li>Vercel redéploie automatiquement.</li></ol>' +
          '<div class="cmd-row"><code id="pub-cmd">git add -A &amp;&amp; git commit -m "update: contenu via back-office" &amp;&amp; git push</code><button class="tool-btn" data-act="copy-cmd">Copier</button></div></details></div>' +
          '<div class="card"><div class="card-head"><div><h3>Brouillon local</h3><p class="desc">Enregistrement automatique à chaque frappe (Ctrl+S pour forcer).</p></div></div>' +
          '<div class="toolbar"><button class="btn-sm" data-act="save">Enregistrer maintenant</button>' +
          '<button class="btn-sm" data-act="toggle-preview">Aperçu du site</button>' +
          '<label class="fld" style="flex:1;min-width:200px;margin:0"><span>Importer un site.json</span><input type="file" id="import-file" accept=".json"></label></div>' +
          '<p class="desc" id="import-msg" style="margin-top:.6rem"></p>' +
          '<div class="toolbar" style="margin-top:.6rem"><button class="btn-sm danger" data-act="reset">Réinitialiser (retour au repo)</button></div></div>' +
          '<div class="card"><div class="card-head"><div><h3>Sécurité</h3><p class="desc">Protection locale du navigateur, 8 caractères minimum.</p></div></div>' +
          '<div class="grid2"><label class="fld"><span>Nouveau mot de passe</span><span class="pass-wrap"><input type="password" id="new-pass" placeholder="8 caractères minimum"><button type="button" class="pass-eye" data-act="toggle-pass" data-target="new-pass">Afficher</button></span><span class="strength"><i id="pass-bar"></i></span></label>' +
          '<label class="fld"><span>Confirmation</span><span class="pass-wrap"><input type="password" id="new-pass2" placeholder="Répétez le mot de passe"><button type="button" class="pass-eye" data-act="toggle-pass" data-target="new-pass2">Afficher</button></span></label></div>' +
          '<button class="btn-sm" data-act="pass">Changer le mot de passe</button> ' +
          '<button class="btn-sm danger" data-act="logout">Se déconnecter</button></div>' +
          '<div class="card"><div class="card-head"><div><h3>Mode maintenance</h3><p class="desc">Affiche une page d’attente propre sur le site public (brouillon appliqué).</p></div></div>' +
          (state.data.profile.maintenance
            ? '<div class="pub-warn"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg><div><b>Le site public est en mode maintenance.</b></div></div>'
            : '<div class="pub-ok"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><div><b>Site public normal.</b></div></div>') +
          '<label class="checkline" style="margin:.8rem 0"><input type="checkbox" id="maint-mode"' + (state.data.profile.maintenance ? ' checked' : '') + '> Activer le mode maintenance</label>' +
          '<button class="btn-sm primary" data-act="maint-save">Appliquer</button></div>';
      }
    }
  };

  /* ── éditeur projet plein écran ── */
  function projectEditorHTML(p, i) {
    const t = projectCard(p, i, (p.images || [])[0], '');
    return '<div class="editor-page">' +
      '<div class="editor-head"><div><h3 class="editor-title">' + esc(p.title_fr || p.title_en || 'Nouveau projet') + '</h3>' +
      '<p class="editor-sub">Formulaire complet sur une page · FR et EN · brouillon local</p></div>' +
      '<div class="editor-actions"><button class="btn-ghost" data-act="prj-ed-back">Retour à la liste</button>' +
      '<button class="btn-primary" data-act="prj-ed-save">Enregistrer</button></div></div>' +
      '<div class="editor-body">' + t + '</div>' +
      '<div class="editor-foot"><button class="btn-ghost" data-act="prj-ed-back">Annuler</button>' +
      '<button class="btn-primary" data-act="prj-ed-save">Enregistrer ce projet</button></div></div>';
  }
  function openProjectEditor(i) {
    state.editingProject = i;
    const p = state.data.projects.items[i];
    $('#view-title').textContent = 'Édition · ' + (p.title_fr || p.title_en || 'Projet');
    $('#view-sub').textContent = 'Tous les champs du projet sur une seule page';
    $('#view').innerHTML = projectEditorHTML(p, i);
    $('.main').scrollTo(0, 0);
  }
  function closeProjectEditor() { state.editingProject = null; render(); }

  function projectRow(p, i) {
    const thumb = (p.images || [])[0];
    const meta = (p.images || []).length + ' img · ' + (p.videos || []).length + ' vidéo(s) · ' + (p.tags || []).length + ' tags';
    const q = (p.title_fr + ' ' + p.title_en + ' ' + (p.tags || []).join(' ') + ' ' + (p.id || '')).toLowerCase();
    const up = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
    const down = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>';
    const dup = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
    const del = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
    return '<div class="prj-row" data-search="' + esc(q) + '" data-layout="' + esc(p.layout) + '">' +
      '<button type="button" class="prj-open" data-act="prj-open" data-idx="' + i + '">' +
      (thumb ? '<img class="prj-open-thumb" src="../' + esc(thumb) + '" onerror="this.style.display=\'none\'" alt="">' : '<span class="prj-open-thumb prj-open-ph"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></span>') +
      '<span class="prj-open-txt"><b>' + esc(p.title_fr || p.title_en || 'Sans titre') + '</b>' +
      '<span>' + esc(p.title_en || '') + '</span><em>' + esc(meta) + '</em></span>' +
      '<svg class="ic prj-open-arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>' +
      '<div class="item-actions"><button class="btn-sm" data-act="prj-up" data-idx="' + i + '" title="Monter">' + up + '</button><button class="btn-sm" data-act="prj-down" data-idx="' + i + '" title="Descendre">' + down + '</button><button class="btn-sm" data-act="prj-dup" data-idx="' + i + '" title="Dupliquer">' + dup + '</button><button class="btn-sm danger" data-act="prj-del" data-idx="' + i + '" title="Supprimer">' + del + '</button></div></div>';
  }

  function projectCard(p, i, thumb, meta) {
    const up = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
    const metrics = (p.metrics || []).map((m, j) =>
      '<div class="grid2"><label class="fld"><span>Valeur</span><input data-bind="projects.items.' + i + '.metrics.' + j + '.v" value="' + esc(m.v) + '" maxlength="12"></label><div></div>' +
      '<label class="fld"><span>Libellé · FR</span><input data-bind="projects.items.' + i + '.metrics.' + j + '.l_fr" value="' + esc(m.l_fr || '') + '"></label>' +
      '<label class="fld"><span>Libellé · EN</span><input data-bind="projects.items.' + i + '.metrics.' + j + '.l_en" value="' + esc(m.l_en || '') + '"></label></div>' +
      '<div class="item-actions" style="margin-bottom:.6rem"><button class="btn-sm danger" data-act="prj-met-del" data-idx="' + i + '" data-sub="' + j + '">Retirer cette métrique</button></div>'
    ).join('');
    const images = (p.images || []).map((src, j) =>
      '<label class="fld"><span>Image ' + (j + 1) + '</span><input data-bind="projects.items.' + i + '.images.' + j + '" value="' + esc(src) + '" list="media-paths-global" placeholder="assets/images/...">' +
      '<span class="thumbs">' + (src ? '<img src="../' + esc(src) + '" onerror="this.style.display=\'none\'" alt="">' : '') +
      '</span></label>' +
      '<div class="item-actions" style="margin:-.3rem 0 .8rem"><button class="btn-sm" data-act="prj-img-up" data-idx="' + i + '" data-sub="' + j + '" title="Monter">' + up + '</button><button class="btn-sm danger" data-act="prj-img-del" data-idx="' + i + '" data-sub="' + j + '">Retirer</button></div>'
    ).join('');
    const videos = (p.videos || []).map((v, j) =>
      '<div class="grid2"><label class="fld"><span>Label · FR</span><input data-bind="projects.items.' + i + '.videos.' + j + '.label_fr" value="' + esc(v.label_fr || '') + '"></label>' +
      '<label class="fld"><span>Label · EN</span><input data-bind="projects.items.' + i + '.videos.' + j + '.label_en" value="' + esc(v.label_en || '') + '"></label></div>' +
      '<label class="fld"><span>Fichier vidéo</span><input data-bind="projects.items.' + i + '.videos.' + j + '.src" value="' + esc(v.src || '') + '" list="media-paths-global" placeholder="assets/videos/demo.mp4"></label>' +
      '<div class="item-actions" style="margin-bottom:.8rem"><button class="btn-sm danger" data-act="prj-vid-del" data-idx="' + i + '" data-sub="' + j + '">Supprimer cette vidéo</button></div>'
    ).join('');
    return '<div class="item">' +
      '<div class="prj-top">' + (thumb ? '<img class="prj-thumb" src="../' + esc(thumb) + '" onerror="this.style.display=\'none\'" alt="">' : '') +
      '<div><div class="item-title">' + esc(p.title_fr || p.title_en || 'Projet') + '</div><div class="prj-meta">' + esc(meta) + '</div></div></div>' +
      '<div class="grid2" style="margin-top:.9rem">' +
      fld('ID (technique)', 'projects.items.' + i + '.id', p.id) +
      '<label class="fld"><span>Mise en page</span><select data-bind="projects.items.' + i + '.layout">' +
      [['featured', 'Vedette (grande carte)'], ['grid', 'Grille (3 colonnes)']].map((o) => '<option value="' + o[0] + '"' + (p.layout === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') +
      '</select></label></div>' +
      '<div class="grid2">' + fld('Tag · FR', 'projects.items.' + i + '.tag_fr', p.tag_fr) + fld('Tag · EN', 'projects.items.' + i + '.tag_en', p.tag_en) + '</div>' +
      '<div class="grid2">' + fld('Titre · FR', 'projects.items.' + i + '.title_fr', p.title_fr) + fld('Titre · EN', 'projects.items.' + i + '.title_en', p.title_en) + '</div>' +
      '<div class="grid2">' + fldArea('Description · FR', 'projects.items.' + i + '.desc_fr', p.desc_fr) + fldArea('Description · EN', 'projects.items.' + i + '.desc_en', p.desc_en) + '</div>' +
      '<div class="grid2">' + fld('Lien (URL)', 'projects.items.' + i + '.linkUrl', p.linkUrl || '') + fld('Libellé du lien · FR', 'projects.items.' + i + '.linkLabel_fr', p.linkLabel_fr || '') + '</div>' +
      fld('Libellé du lien · EN', 'projects.items.' + i + '.linkLabel_en', p.linkLabel_en || '') +
      '<label class="fld"><span>Tags (séparés par des virgules)</span><input data-bind="projects.items.' + i + '.tags" value="' + esc(Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '')) + '" data-tags="1"></label>' +
      '<div class="row-head" style="margin-top:.6rem"><h4>Métriques (' + (p.metrics || []).length + ')</h4><button class="btn-sm" data-act="prj-met-add" data-idx="' + i + '">Ajouter</button></div>' + metrics +
      '<div class="row-head" style="margin-top:.6rem"><h4>Images (' + (p.images || []).length + ')</h4><button class="btn-sm" data-act="prj-img-add" data-idx="' + i + '">Ajouter</button></div>' + images +
      '<div class="row-head" style="margin-top:.6rem"><h4>Vidéos démo (' + (p.videos || []).length + ')</h4><button class="btn-sm" data-act="prj-vid-add" data-idx="' + i + '">Ajouter</button></div>' + videos +
      '</div>';
  }

  /* ── éditeur certification ── */
  function certEditorHTML(it, i) {
    return '<div class="editor-page">' +
      '<div class="editor-head"><div><h3 class="editor-title">' + esc(it.title_fr || it.title_en || 'Nouvelle certification') + '</h3>' +
      '<p class="editor-sub">Formulaire complet sur une page · FR et EN · brouillon local</p></div>' +
      '<div class="editor-actions"><button class="btn-ghost" data-act="cert-ed-back">Retour à la liste</button>' +
      '<button class="btn-primary" data-act="cert-ed-save">Enregistrer</button></div></div>' +
      '<div class="editor-body"><div class="item"><div class="grid2">' +
      '<label class="fld"><span>Badge (2-3 lettres)</span><input data-bind="certifications.items.' + i + '.badge" value="' + esc(it.badge) + '" maxlength="4"></label>' +
      '<label class="fld"><span>Couleur du badge</span><select data-bind="certifications.items.' + i + '.color">' +
      ['blue', 'teal', 'coral', 'gold'].map((col) => '<option' + (it.color === col ? ' selected' : '') + '>' + col + '</option>').join('') + '</select></label>' +
      '<label class="fld"><span>Statut</span><select data-bind="certifications.items.' + i + '.status">' +
      [['obtained', 'Obtenu'], ['progress', 'En cours'], ['planned', 'Planifié']].map((o) => '<option value="' + o[0] + '"' + (it.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
      '<label class="fld"><span>Clé viewer (image protégée)</span><input data-bind="certifications.items.' + i + '.certKey" value="' + esc(it.certKey || '') + '" placeholder="diploma, google-dm…"></label>' +
      '<label class="fld"><span>Titre · FR</span><input data-bind="certifications.items.' + i + '.title_fr" value="' + esc(it.title_fr) + '"></label>' +
      '<label class="fld"><span>Titre · EN</span><input data-bind="certifications.items.' + i + '.title_en" value="' + esc(it.title_en) + '"></label>' +
      '<label class="fld"><span>Organisme · FR</span><input data-bind="certifications.items.' + i + '.org_fr" value="' + esc(it.org_fr) + '"></label>' +
      '<label class="fld"><span>Organisme · EN</span><input data-bind="certifications.items.' + i + '.org_en" value="' + esc(it.org_en) + '"></label>' +
      '<label class="fld"><span>Détail · FR</span><input data-bind="certifications.items.' + i + '.desc_fr" value="' + esc(it.desc_fr || '') + '"></label>' +
      '<label class="fld"><span>Détail · EN</span><input data-bind="certifications.items.' + i + '.desc_en" value="' + esc(it.desc_en || '') + '"></label>' +
      '</div>' +
      '<div class="help">Clés viewer connues : ' + KNOWN_CERTS.join(', ') + '.</div>' +
      '</div></div>' +
      '<div class="editor-foot"><button class="btn-ghost" data-act="cert-ed-back">Annuler</button>' +
      '<button class="btn-primary" data-act="cert-ed-save">Enregistrer cette certification</button></div></div>';
  }
  function openCertEditor(i) {
    state.editingCert = i;
    const it = state.data.certifications.items[i];
    $('#view-title').textContent = 'Édition · ' + (it.title_fr || it.title_en || 'Certification');
    $('#view-sub').textContent = 'Tous les champs de la certification sur une seule page';
    $('#view').innerHTML = certEditorHTML(it, i);
    $('.main').scrollTo(0, 0);
  }
  function closeCertEditor() { state.editingCert = null; render(); }

  /* ── éditeur service ── */
  function svcEditorHTML(it, i) {
    return '<div class="editor-page">' +
      '<div class="editor-head"><div><h3 class="editor-title">' + esc(it.title_fr || it.title_en || 'Nouveau service') + '</h3>' +
      '<p class="editor-sub">Formulaire complet sur une page · FR et EN · brouillon local</p></div>' +
      '<div class="editor-actions"><button class="btn-ghost" data-act="svc-ed-back">Retour à la liste</button>' +
      '<button class="btn-primary" data-act="svc-ed-save">Enregistrer</button></div></div>' +
      '<div class="editor-body"><div class="item"><div class="grid2">' +
      '<label class="fld"><span>Icône</span><select data-bind="services.items.' + i + '.icon">' +
      ['chart', 'monitor', 'nodes', 'table', 'network'].map((ic) => '<option value="' + ic + '"' + (it.icon === ic ? ' selected' : '') + '>' + ic + '</option>').join('') +
      '</select></label>' +
      '<label class="fld"><span>ID (technique)</span><input data-bind="services.items.' + i + '.id" value="' + esc(it.id) + '"></label>' +
      '<label class="fld"><span>Titre · FR</span><input data-bind="services.items.' + i + '.title_fr" value="' + esc(it.title_fr) + '"></label>' +
      '<label class="fld"><span>Titre · EN</span><input data-bind="services.items.' + i + '.title_en" value="' + esc(it.title_en) + '"></label>' +
      '<label class="fld"><span>Description · FR</span><textarea data-bind="services.items.' + i + '.desc_fr">' + esc(it.desc_fr) + '</textarea></label>' +
      '<label class="fld"><span>Description · EN</span><textarea data-bind="services.items.' + i + '.desc_en">' + esc(it.desc_en) + '</textarea></label>' +
      '</div></div></div>' +
      '<div class="editor-foot"><button class="btn-ghost" data-act="svc-ed-back">Annuler</button>' +
      '<button class="btn-primary" data-act="svc-ed-save">Enregistrer ce service</button></div></div>';
  }
  function openSvcEditor(i) {
    state.editingSvc = i;
    const it = state.data.services.items[i];
    $('#view-title').textContent = 'Édition · ' + (it.title_fr || it.title_en || 'Service');
    $('#view-sub').textContent = 'Tous les champs du service sur une seule page';
    $('#view').innerHTML = svcEditorHTML(it, i);
    $('.main').scrollTo(0, 0);
  }
  function closeSvcEditor() { state.editingSvc = null; render(); }

  /* ── éditeur compétence ── */
  function skEditorHTML(s, i) {
    return '<div class="editor-page">' +
      '<div class="editor-head"><div><h3 class="editor-title">' + esc(s.name_fr || s.name_en || 'Nouvelle compétence') + '</h3>' +
      '<p class="editor-sub">Formulaire complet sur une page · FR et EN · brouillon local</p></div>' +
      '<div class="editor-actions"><button class="btn-ghost" data-act="sk-ed-back">Retour à la liste</button>' +
      '<button class="btn-primary" data-act="sk-ed-save">Enregistrer</button></div></div>' +
      '<div class="editor-body"><div class="item"><div class="grid2">' +
      '<label class="fld"><span>Nom · FR</span><input data-bind="skills.items.' + i + '.name_fr" value="' + esc(s.name_fr) + '"></label>' +
      '<label class="fld"><span>Nom · EN</span><input data-bind="skills.items.' + i + '.name_en" value="' + esc(s.name_en) + '"></label>' +
      '</div></div></div>' +
      '<div class="editor-foot"><button class="btn-ghost" data-act="sk-ed-back">Annuler</button>' +
      '<button class="btn-primary" data-act="sk-ed-save">Enregistrer cette compétence</button></div></div>';
  }
  function openSkillEditor(i) {
    state.editingSkill = i;
    const s = state.data.skills.items[i];
    $('#view-title').textContent = 'Édition · ' + (s.name_fr || s.name_en || 'Compétence');
    $('#view-sub').textContent = 'Tous les champs de la compétence sur une seule page';
    $('#view').innerHTML = skEditorHTML(s, i);
    $('.main').scrollTo(0, 0);
  }
  function closeSkillEditor() { state.editingSkill = null; render(); }

  function afterMut(msg) { markDirty(); saveDraft(true); updateCounts(); render(); if (msg) toast(msg, 'ok'); }
  function updateCounts() {
    const d = state.data;
    const map = { services: (d.services.items || []).length, projects: (d.projects.items || []).length, skills: (d.skills.items || []).length, certs: (d.certifications.items || []).length, cv: ((d.cv && d.cv.experiences) || []).length };
    Object.keys(map).forEach((k) => { const el = $('#count-' + k); if (el) el.textContent = map[k]; });
  }
  function move(arr, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }

  /* ---------- navigation ---------- */
  function setView(v) {
    state.view = v;
    state.editingProject = null; state.editingCert = null; state.editingSvc = null; state.editingSkill = null;
    $$('#side-nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    const v2 = VIEWS[v];
    if (!v2 || !state.data) return;
    $('#view-title').textContent = v2.title;
    $('#view-sub').textContent = v2.sub;
    $('#view').innerHTML = v2.render();
    pairCards();
    if (v === 'audience') loadAnalytics(state.anDays || 30);
    $('.main').scrollTo(0, 0);
  }

  function pairCards() {
    const kids = $$('#view > .card');
    for (let i = 0; i + 1 < kids.length; i++) {
      const a = kids[i], b = kids[i + 1];
      if (a.offsetHeight < 1400 && b.offsetHeight < 1400) {
        const wrap = document.createElement('div');
        wrap.className = 'dash-cols';
        a.parentNode.insertBefore(wrap, a);
        wrap.appendChild(a);
        wrap.appendChild(b);
        i++;
      }
    }
  }

  function render() {
    const v = VIEWS[state.view];
    if (!v || !state.data) return;
    $('#view-title').textContent = v.title;
    $('#view-sub').textContent = v.sub;
    $('#view').innerHTML = v.render();
    pairCards();
    if (state.view === 'audience') loadAnalytics(state.anDays || 30);
    if (!$('#media-paths-global')) {
      const dl = document.createElement('datalist');
      dl.id = 'media-paths-global';
      dl.innerHTML = MEDIA_PATHS.map((x) => '<option value="' + esc(x) + '">').join('');
      document.body.appendChild(dl);
    }
    $$('#view [list="media-paths"]').forEach((inp) => inp.setAttribute('list', 'media-paths-global'));
    applyProjectFilter(); applyMediaFilter();
    const imp = $('#import-file');
    if (imp) imp.addEventListener('change', () => {
      const f = imp.files[0]; if (!f) return;
      const msg = $('#import-msg');
      const r = new FileReader();
      r.onload = () => {
        try {
          const j = JSON.parse(r.result);
          const need = ['hero', 'services', 'projects', 'skills', 'certifications', 'about', 'contact', 'profile'];
          const missing = need.filter((k) => j[k] == null);
          if (missing.length) throw new Error('Clés manquantes : ' + missing.join(', '));
          state.data = j; state.hasDraft = true;
          saveDraft(true); updateCounts(); render();
          logAct('Import site.json');
          toast('Fichier importé', 'ok');
        } catch (e) {
          if (msg) msg.textContent = 'Import refusé : ' + e.message;
          toast('Import invalide', 'err');
        }
      };
      r.readAsText(f);
    });
  }

  $$('#side-nav button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#btn-menu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#side-overlay').addEventListener('click', () => document.body.classList.remove('nav-open'));

  /* ---------- filtres ---------- */
  function applyRowFilter(rowCls, inputId) {
    const inp = $('#' + inputId);
    if (!inp) return;
    const q = (inp.value || '').toLowerCase().trim();
    $$('.' + rowCls).forEach((row) => {
      const box = row.closest('.item');
      const show = !q || (row.textContent || '').toLowerCase().indexOf(q) !== -1;
      if (box) box.style.display = show ? '' : 'none';
      else row.style.display = show ? '' : 'none';
    });
  }
  function applyProjectFilter() {
    const list = $('#prj-list');
    if (!list) return;
    const s = $('#prj-search');
    const f = $('#prj-filter');
    const q = ((s ? s.value : state.prjQuery) || '').toLowerCase().trim();
    state.prjQuery = s ? s.value : state.prjQuery;
    const lay = f ? f.value : state.prjLayout;
    state.prjLayout = lay;
    let shown = 0;
    const total = $$('.prj-row', list).length;
    $$('.prj-row', list).forEach((row) => {
      const okQ = !q || (row.dataset.search || '').indexOf(q) !== -1;
      const okL = lay === 'all' || row.dataset.layout === lay;
      const show = okQ && okL;
      row.style.display = show ? '' : 'none';
      if (show) shown++;
    });
    const c = $('#prj-count');
    if (c) c.textContent = (q || lay !== 'all') ? shown + '/' + total : total;
  }
  function applyMediaFilter() {
    const s = $('#media-search');
    if (!s) return;
    state.mediaQuery = s.value;
    const q = s.value.toLowerCase().trim();
    $$('.media-cell').forEach((cell) => {
      cell.style.display = (!q || (cell.dataset.search || '').indexOf(q) !== -1) ? '' : 'none';
    });
  }

  /* ---------- aperçu ---------- */
  function togglePreview() {
    const bar = $('#preview-bar');
    if (!bar) return;
    bar.hidden = !bar.hidden;
    if (!bar.hidden) reloadPreview(true);
  }
  function setPreviewMode(mode) {
    state.previewMode = mode;
    const wrap = document.querySelector('.preview-frame-wrap');
    if (wrap) wrap.classList.toggle('mobile', mode === 'mobile');
    const d = $('#preview-desktop'), m = $('#preview-mobile');
    if (d) d.classList.toggle('on', mode === 'desktop');
    if (m) m.classList.toggle('on', mode === 'mobile');
  }
  function reloadPreview(hard) {
    const f = $('#preview-frame');
    if (!f) return;
    const src = '../index.html?cms=' + Date.now();
    if (hard) { f.src = src; } else { try { f.contentWindow.location.reload(); } catch (e) { f.src = src; } }
  }
  $('#btn-preview-toggle').addEventListener('click', togglePreview);
  $('#btn-preview-close').addEventListener('click', () => { $('#preview-bar').hidden = true; });
  $('#btn-preview-reload').addEventListener('click', () => reloadPreview(true));
  $('#preview-desktop').addEventListener('click', () => setPreviewMode('desktop'));
  $('#preview-mobile').addEventListener('click', () => setPreviewMode('mobile'));

  /* ---------- recherche globale ---------- */
  $('#btn-cmdk').addEventListener('click', openCmdk);
  $('#cmdk').addEventListener('mousedown', (e) => { if (e.target === $('#cmdk')) closeCmdk(); });
  $('#cmdk-input').addEventListener('input', (e) => renderCmdk(e.target.value));
  $('#cmdk-results').addEventListener('click', (e) => {
    const it = e.target.closest('.cmdk-item');
    if (it) cmdkGo(Number(it.dataset.n));
  });
  $('#cmdk-results').addEventListener('mousemove', (e) => {
    const it = e.target.closest('.cmdk-item');
    if (!it) return;
    $$('.cmdk-item').forEach((x) => x.classList.remove('sel'));
    it.classList.add('sel');
    cmdkSel = Number(it.dataset.n);
  });
  document.addEventListener('keydown', (e) => {
    const open = !$('#cmdk').hidden;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); open ? closeCmdk() : openCmdk(); return; }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeCmdk(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = $$('.cmdk-item');
      if (!items.length) return;
      cmdkSel = (cmdkSel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      items.forEach((x) => x.classList.remove('sel'));
      items[cmdkSel].classList.add('sel');
      items[cmdkSel].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter') { e.preventDefault(); cmdkGo(cmdkSel); }
  });
  let cmdkSel = 0, cmdkList = [];
  function buildSearchIndex() {
    const d = state.data, idx = [];
    (d.projects.items || []).forEach((p, i) => idx.push({
      group: 'Projets', icon: 'folder', view: 'projects', open: 'prj-open', idx: i,
      text: (p.title_fr || '') + ' ' + (p.title_en || '') + ' ' + (p.tags || []).join(' ')
    }));
    (d.certifications.items || []).forEach((c, i) => idx.push({
      group: 'Certifications', icon: 'award', view: 'certs', open: 'cert-open', idx: i,
      text: (c.title_fr || '') + ' ' + (c.title_en || '') + ' ' + (c.org_fr || '') + ' ' + (c.org_en || '')
    }));
    (d.services.items || []).forEach((s, i) => idx.push({
      group: 'Services', icon: 'layout', view: 'services', open: 'svc-open', idx: i,
      text: (s.title_fr || '') + ' ' + (s.title_en || '')
    }));
    (d.skills.items || []).forEach((k, i) => idx.push({
      group: 'Compétences', icon: 'list', view: 'skills', open: 'sk-open', idx: i,
      text: (k.name_fr || '') + ' ' + (k.name_en || '')
    }));
    ((d.cv && d.cv.experiences) || []).forEach((e, i) => idx.push({
      group: 'Expériences CV', icon: 'list', view: 'cv',
      text: (e.company || '') + ' ' + (e.role_fr || '') + ' ' + (e.role_en || '')
    }));
    ['hero', 'services', 'projects', 'finmodel', 'skills', 'certs', 'cv', 'about', 'contact', 'media', 'seo', 'audience', 'settings', 'activity'].forEach((v) => {
      idx.push({ group: 'Sections', icon: 'layout', view: v, text: (VIEW_NAMES[v] || v) });
    });
    return idx;
  }
  function cmdkIcon(key) {
    const wrap = (p) => '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
    const S = {
      folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
      award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
      layout: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
      list: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'
    };
    return wrap(S[key] || S.layout);
  }
  function openCmdk() {
    $('#cmdk').hidden = false;
    const inp = $('#cmdk-input');
    inp.value = '';
    renderCmdk('');
    inp.focus();
  }
  function closeCmdk() { $('#cmdk').hidden = true; }
  function renderCmdk(q) {
    const idx = buildSearchIndex();
    const t = q.toLowerCase().trim();
    let hits = t ? idx.filter((x) => x.text.toLowerCase().indexOf(t) !== -1) : idx.filter((x) => x.group === 'Sections');
    hits = hits.slice(0, 12);
    cmdkList = hits; cmdkSel = 0;
    const res = $('#cmdk-results');
    if (!hits.length) { res.innerHTML = '<div class="cmdk-empty">Aucun résultat pour « ' + esc(q) + ' »</div>'; return; }
    let html = '', lastG = '';
    hits.forEach((h, n) => {
      if (h.group !== lastG) { html += '<div class="cmdk-group">' + esc(h.group) + '</div>'; lastG = h.group; }
      html += '<button type="button" class="cmdk-item' + (n === 0 ? ' sel' : '') + '" data-n="' + n + '">' + cmdkIcon(h.icon) +
        '<span>' + esc(h.text.trim().slice(0, 60)) + '</span>' + (h.open ? '<span class="cx">éditer</span>' : '<span class="cx">aller</span>') + '</button>';
    });
    res.innerHTML = html;
  }
  function cmdkGo(n) {
    const h = cmdkList[n];
    if (!h) return;
    closeCmdk();
    setView(h.view);
    if (h.open === 'prj-open') setTimeout(() => openProjectEditor(h.idx), 60);
    if (h.open === 'cert-open') setTimeout(() => openCertEditor(h.idx), 60);
    if (h.open === 'svc-open') setTimeout(() => openSvcEditor(h.idx), 60);
    if (h.open === 'sk-open') setTimeout(() => openSkillEditor(h.idx), 60);
  }

  /* ---------- analytics ---------- */
  function loadAnalytics(days) {
    const body = $('#an-body');
    if (!body) return;
    if (!state.anPass) {
      try { state.anPass = sessionStorage.getItem('elom_an_pass'); } catch (e) {}
    }
    if (location.protocol === 'file:') { body.innerHTML = '<div class="help">Analytics disponible une fois le site servi (http) et déployé.</div>'; return; }
    if (!state.anPass) {
      body.innerHTML = '<div class="help">Saisissez le mot de passe administrateur pour lire les statistiques (vérifié côté serveur).</div>' +
        '<div class="toolbar"><input type="password" id="an-pass-inp" class="an-pass" placeholder="Mot de passe admin"><button class="btn-sm primary" data-act="an-unlock">Déverrouiller</button></div>' +
        '<p class="desc" id="an-msg" style="margin-top:.5rem"></p>';
      return;
    }
    body.innerHTML = '<div class="help">Chargement…</div>';
    fetch('/api/analytics?days=' + days, { headers: { 'x-admin-pass': state.anPass } })
      .then((r) => { if (r.status === 401) throw new Error('auth'); if (!r.ok) throw new Error('srv'); return r.json(); })
      .then((j) => renderAnalytics(j))
      .catch((e) => {
        if (e.message === 'auth') {
          try { sessionStorage.removeItem('elom_an_pass'); } catch (e2) {}
          state.anPass = null;
          body.innerHTML = '<div class="pub-warn"><div><b>Mot de passe incorrect.</b> Le serveur compare le mot de passe admin (variable ADMIN_PASS dans Vercel).</div></div>' +
            '<div class="toolbar" style="margin-top:.7rem"><input type="password" id="an-pass-inp" class="an-pass" placeholder="Mot de passe admin"><button class="btn-sm primary" data-act="an-unlock">Réessayer</button></div>';
        } else {
          body.innerHTML = '<div class="pub-warn"><div><b>Statistiques indisponibles.</b><br>Vérifiez la configuration Upstash (variables UPSTASH_REDIS_REST_URL et TOKEN dans Vercel) et que le site a déjà reçu des visites en production.</div></div>';
        }
      });
  }
  function renderAnalytics(j) {
    const body = $('#an-body');
    if (!body) return;
    const max = Math.max(1, ...j.series.map((d) => d.pv));
    const bars = j.series.map((d) => {
      const h = Math.max(2, Math.round((d.pv / max) * 90));
      return '<div class="an-bar" title="' + d.date + ' : ' + d.pv + ' vue(s)"><i style="height:' + h + 'px"></i></div>';
    }).join('');
    const trend = j.prev7 > 0 ? Math.round(((j.last7 - j.prev7) / j.prev7) * 100) : null;
    const kpis =
      '<div class="an-kpis">' +
      '<div class="an-kpi"><b>' + j.totalPv + '</b><span>pages vues (' + j.days + ' j)</span></div>' +
      '<div class="an-kpi"><b>' + j.last7 + '</b><span>7 derniers jours</span></div>' +
      '<div class="an-kpi"><b>' + (trend == null ? '—' : (trend >= 0 ? '+' : '') + trend + '%') + '</b><span>vs 7 jours précédents</span></div>' +
      '<div class="an-kpi"><b>' + j.totalAll + '</b><span>total depuis le lancement</span></div></div>';
    const chart = '<div class="an-chart">' + bars + '</div><div class="an-axis"><span>' + j.series[0].date + '</span><span>' + j.series[j.series.length - 1].date + '</span></div>';
    const pages = j.topPages.length
      ? '<div class="card-sub"><h4>Pages les plus vues</h4>' + j.topPages.map((p) =>
        '<div class="an-row"><span>' + esc(p.page) + '</span><b>' + p.views + '</b></div>').join('') + '</div>'
      : '<div class="card-sub"><h4>Pages les plus vues</h4><p class="desc">Pas encore de données.</p></div>';
    const srcs = j.topSrc.length
      ? '<div class="card-sub"><h4>Sources de trafic</h4>' + j.topSrc.map((s) =>
        '<div class="an-row"><span>' + esc(s.source) + '</span><b>' + s.views + '</b></div>').join('') + '</div>'
      : '<div class="card-sub"><h4>Sources de trafic</h4><p class="desc">Pas encore de données.</p></div>';
    body.innerHTML = kpis + chart + '<div class="an-cols">' + pages + srcs + '</div>';
  }

  /* ---------- actions ---------- */
  const ACTIONS = {
    'go-view': (view) => setView(view),
    'toggle-preview': () => togglePreview(),
    'preview-desktop': () => setPreviewMode('desktop'),
    'preview-mobile': () => setPreviewMode('mobile'),
    'save': () => { saveDraft(false); logAct('Brouillon enregistré'); },
    'reset': async () => {
      if (await confirmModal('Réinitialiser le brouillon ?', 'Le contenu revient à l’état du dépôt Git. Les modifications locales seront perdues.', 'Réinitialiser')) {
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
        logAct('Brouillon réinitialisé');
        location.reload();
      }
    },
    'logout': () => doLogout(),
    'copy': (txt) => { if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Chemin copié', 'ok')); },
    'copy-cmd': () => {
      const el = $('#pub-cmd');
      if (el && navigator.clipboard) navigator.clipboard.writeText(el.textContent).then(() => toast('Commande copiée', 'ok'));
    },
    'toggle-pass': (target) => {
      const inp = $('#' + target);
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
    },
    'pass': async () => {
      const a = $('#new-pass'), b = $('#new-pass2');
      if (!a || !b) return;
      if (a.value.length < 8) { toast('8 caractères minimum', 'err'); return; }
      if (a.value !== b.value) { toast('Les deux mots de passe diffèrent', 'err'); return; }
      const h = await sha256(a.value);
      try {
        localStorage.setItem(PASS_KEY, h);
        localStorage.setItem(PASS_CHANGED_KEY, '1');
        logAct('Mot de passe changé');
        toast('Mot de passe mis à jour', 'ok');
        a.value = ''; b.value = ''; updateStrength();
      } catch (e) { toast('Échec', 'err'); }
    },
    'dl-site': () => { download('site.json', JSON.stringify(state.data, null, 2)); logAct('Export site.json'); },
    'dl-en': () => { download('en.json', JSON.stringify(buildI18n('en'), null, 2)); },
    'dl-fr': () => { download('fr.json', JSON.stringify(buildI18n('fr'), null, 2)); },
    'dl-all': () => { ACTIONS['dl-site'](); setTimeout(() => ACTIONS['dl-en'](), 300); setTimeout(() => ACTIONS['dl-fr'](), 600); logAct('Export 3 fichiers'); toast('3 fichiers téléchargés, remplacez-les dans le repo', 'ok'); },
    'act-clear': () => { try { localStorage.removeItem(ACT_KEY); } catch (e) {} render(); toast('Journal vidé', 'ok'); },
    'maint-save': () => {
      const m = $('#maint-mode');
      state.data.profile.maintenance = m ? m.checked : false;
      afterMut('Mode maintenance ' + (state.data.profile.maintenance ? 'activé' : 'désactivé'));
      logAct('Mode maintenance', state.data.profile.maintenance ? 'activé' : 'désactivé');
    },
    'an-unlock': () => {
      const inp = $('#an-pass-inp');
      if (!inp || !inp.value) return;
      state.anPass = inp.value;
      try { sessionStorage.setItem('elom_an_pass', inp.value); } catch (e) {}
      loadAnalytics(state.anDays || 30);
    },
    'prj-add': () => {
      state.data.projects.items.push({ id: 'projet-' + Date.now().toString(36), layout: 'grid', live: false, tag_en: '', tag_fr: '', title_en: 'New project', title_fr: 'Nouveau projet', desc_en: '', desc_fr: '', metrics: [], tags: [], linkUrl: '', linkLabel_en: '', linkLabel_fr: '', images: [], videos: [] });
      afterMut('Projet créé, remplissez puis enregistrez');
    },
    'prj-add-go': () => { ACTIONS['prj-add'](); openProjectEditor(state.data.projects.items.length - 1); },
    'prj-open': (i) => { openProjectEditor(i); },
    'prj-ed-back': () => { closeProjectEditor(); },
    'prj-ed-save': () => { afterMut('Projet enregistré'); logAct('Projet enregistré', state.data.projects.items[state.editingProject] ? (state.data.projects.items[state.editingProject].title_fr || '') : ''); closeProjectEditor(); },
    'prj-del': async (i) => {
      const p = state.data.projects.items[i];
      if (await confirmModal('Supprimer « ' + (p.title_fr || p.title_en || 'ce projet') + ' » ?', 'Réversible tant que non exporté.', 'Supprimer')) { state.data.projects.items.splice(i, 1); state.editingProject = null; afterMut('Projet supprimé'); }
    },
    'prj-up': (i) => { move(state.data.projects.items, i, -1); afterMut(); },
    'prj-down': (i) => { move(state.data.projects.items, i, 1); afterMut(); },
    'prj-dup': (i) => { const c = JSON.parse(JSON.stringify(state.data.projects.items[i])); c.id += '-copie'; state.data.projects.items.splice(i + 1, 0, c); afterMut('Projet dupliqué'); },
    'prj-met-add': (i) => { const p = state.data.projects.items[i]; p.metrics = p.metrics || []; p.metrics.push({ v: '', l_en: '', l_fr: '' }); afterMut(); },
    'prj-met-del': (i, j) => { state.data.projects.items[i].metrics.splice(j, 1); afterMut(); },
    'prj-img-add': (i) => { const p = state.data.projects.items[i]; p.images = p.images || []; p.images.push(''); afterMut(); },
    'prj-img-del': (i, j) => { state.data.projects.items[i].images.splice(j, 1); afterMut(); },
    'prj-img-up': (i, j) => { move(state.data.projects.items[i].images, j, -1); afterMut(); },
    'prj-vid-add': (i) => { const p = state.data.projects.items[i]; p.videos = p.videos || []; p.videos.push({ label_en: '', label_fr: '', src: '' }); afterMut(); },
    'prj-vid-del': (i, j) => { state.data.projects.items[i].videos.splice(j, 1); afterMut(); },
    'svc-add': () => { state.data.services.items.push({ id: 'svc-' + Date.now().toString(36), icon: 'chart', title_en: 'New service', title_fr: 'Nouveau service', desc_en: '', desc_fr: '' }); afterMut('Service ajouté'); },
    'svc-add-go': () => { state.data.services.items.push({ id: 'svc-' + Date.now().toString(36), icon: 'chart', title_en: 'New service', title_fr: 'Nouveau service', desc_en: '', desc_fr: '' }); afterMut(); openSvcEditor(state.data.services.items.length - 1); },
    'svc-open': (i) => { openSvcEditor(i); },
    'svc-ed-back': () => { closeSvcEditor(); },
    'svc-ed-save': () => { afterMut('Service enregistré'); logAct('Service enregistré'); closeSvcEditor(); },
    'svc-del': async (i) => { if (await confirmModal('Supprimer ce service ?', 'Réversible tant que non exporté.', 'Supprimer')) { state.data.services.items.splice(i, 1); state.editingSvc = null; afterMut('Service supprimé'); } },
    'svc-up': (i) => { move(state.data.services.items, i, -1); afterMut(); },
    'svc-down': (i) => { move(state.data.services.items, i, 1); afterMut(); },
    'svc-dup': (i) => { const c = JSON.parse(JSON.stringify(state.data.services.items[i])); c.id += '-copie'; state.data.services.items.splice(i + 1, 0, c); afterMut('Service dupliqué'); },
    'sk-add': () => { state.data.skills.items.push({ id: 'sk-' + Date.now().toString(36), name_en: 'New skill', name_fr: 'Nouvelle compétence' }); afterMut('Compétence ajoutée'); },
    'sk-add-go': () => { state.data.skills.items.push({ id: 'sk-' + Date.now().toString(36), name_en: 'New skill', name_fr: 'Nouvelle compétence' }); afterMut(); openSkillEditor(state.data.skills.items.length - 1); },
    'sk-open': (i) => { openSkillEditor(i); },
    'sk-ed-back': () => { closeSkillEditor(); },
    'sk-ed-save': () => { afterMut('Compétence enregistrée'); logAct('Compétence enregistrée'); closeSkillEditor(); },
    'sk-del': async (i) => { if (await confirmModal('Supprimer cette compétence ?', '', 'Supprimer')) { state.data.skills.items.splice(i, 1); state.editingSkill = null; afterMut('Compétence supprimée'); } },
    'sk-up': (i) => { move(state.data.skills.items, i, -1); afterMut(); },
    'sk-down': (i) => { move(state.data.skills.items, i, 1); afterMut(); },
    'cert-add': () => { state.data.certifications.items.push({ id: 'c' + Date.now().toString(36), badge: '•', color: 'blue', title_en: 'New certification', title_fr: 'Nouvelle certification', org_en: '', org_fr: '', desc_en: '', desc_fr: '', status: 'obtained', certKey: '' }); afterMut('Certification ajoutée'); },
    'cert-add-go': () => { state.data.certifications.items.push({ id: 'c' + Date.now().toString(36), badge: '•', color: 'blue', title_en: 'New certification', title_fr: 'Nouvelle certification', org_en: '', org_fr: '', desc_en: '', desc_fr: '', status: 'obtained', certKey: '' }); afterMut(); openCertEditor(state.data.certifications.items.length - 1); },
    'cert-open': (i) => { openCertEditor(i); },
    'cert-ed-back': () => { closeCertEditor(); },
    'cert-ed-save': () => { afterMut('Certification enregistrée'); logAct('Certification enregistrée'); closeCertEditor(); },
    'cert-del': async (i) => { if (await confirmModal('Supprimer cette certification ?', '', 'Supprimer')) { state.data.certifications.items.splice(i, 1); state.editingCert = null; afterMut('Certification supprimée'); } },
    'cert-up': (i) => { move(state.data.certifications.items, i, -1); afterMut(); },
    'cert-down': (i) => { move(state.data.certifications.items, i, 1); afterMut(); },
    /* CV & Expériences */
    'cv-lang': (lg) => { state.cvLang = lg || (state.cvLang === 'en' ? 'fr' : 'en'); render(); },
    'cv-print': () => {
      const l = state.cvLang || 'fr';
      window.open('../cv.html?lang=' + l + '&print=1', '_blank');
    },
    'cv-exp-add': () => {
      state.data.cv = state.data.cv || {};
      state.data.cv.experiences = state.data.cv.experiences || [];
      state.data.cv.experiences.unshift({
        id: 'exp-' + Date.now().toString(36),
        company: 'Nouvelle entreprise',
        location: 'Lomé, Togo',
        period_fr: '2026 – Présent',
        period_en: '2026 – Present',
        role_fr: 'Poste / Mission',
        role_en: 'Role / Title',
        bullets_fr: ['Mission ou réalisation clé'],
        bullets_en: ['Key accomplishment or mission']
      });
      afterMut('Nouvelle expérience ajoutée au CV');
    },
    'cv-exp-del': async (i) => {
      if (await confirmModal('Supprimer cette expérience du CV ?', '', 'Supprimer')) {
        state.data.cv.experiences.splice(i, 1);
        afterMut('Expérience supprimée');
      }
    },
    'cv-exp-up': (i) => { move(state.data.cv.experiences, i, -1); afterMut(); },
    'cv-exp-down': (i) => { move(state.data.cv.experiences, i, 1); afterMut(); },
    'cv-exp-dup': (i) => {
      const c = JSON.parse(JSON.stringify(state.data.cv.experiences[i]));
      c.id += '-copie';
      state.data.cv.experiences.splice(i + 1, 0, c);
      afterMut('Expérience dupliquée');
    },
    'cv-bullet-add': (i) => {
      const e = state.data.cv.experiences[i];
      e.bullets_fr = e.bullets_fr || [];
      e.bullets_en = e.bullets_en || [];
      e.bullets_fr.push('');
      e.bullets_en.push('');
      afterMut();
    },
    'cv-bullet-del': (i, j) => {
      const e = state.data.cv.experiences[i];
      if (e.bullets_fr) e.bullets_fr.splice(j, 1);
      if (e.bullets_en) e.bullets_en.splice(j, 1);
      afterMut();
    },
    'cv-skill-add': () => {
      state.data.cv = state.data.cv || {};
      state.data.cv.keySkills = state.data.cv.keySkills || [];
      state.data.cv.keySkills.push({ fr: 'Nouvelle compétence clé', en: 'New key skill' });
      afterMut('Compétence ajoutée au CV');
    },
    'cv-skill-del': async (i) => {
      state.data.cv.keySkills.splice(i, 1);
      afterMut('Compétence retirée');
    },
    'cv-edu-add': () => {
      state.data.cv = state.data.cv || {};
      state.data.cv.education = state.data.cv.education || [];
      state.data.cv.education.push({
        id: 'edu-' + Date.now().toString(36),
        degree_fr: 'Nouveau diplôme',
        degree_en: 'New degree',
        school_fr: 'Université / École',
        school_en: 'University / School',
        year: '2026',
        details_fr: '',
        details_en: ''
      });
      afterMut('Formation ajoutée');
    },
    'cv-edu-del': async (i) => {
      state.data.cv.education.splice(i, 1);
      afterMut('Formation supprimée');
    },
    'cv-ref-add': () => {
      state.data.cv = state.data.cv || {};
      state.data.cv.references = state.data.cv.references || [];
      state.data.cv.references.push({
        name: 'Nom du référent',
        title_fr: 'Poste / Entreprise',
        title_en: 'Title / Company',
        phone: '+228 ...'
      });
      afterMut('Référence ajoutée');
    },
    'cv-ref-del': async (i) => {
      state.data.cv.references.splice(i, 1);
      afterMut('Référence supprimée');
    }
  };

  function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (btn.dataset.bind && btn.tagName === 'INPUT') return;
    const fn = ACTIONS[act];
    if (!fn) return;
    e.preventDefault();
    const rawIdx = btn.dataset.idx;
    const i = rawIdx != null ? (isNaN(Number(rawIdx)) ? rawIdx : Number(rawIdx)) : undefined;
    const j = btn.dataset.sub != null ? Number(btn.dataset.sub) : undefined;
    if (act === 'go-view') fn(btn.dataset.view);
    else if (act === 'copy') fn(btn.dataset.idx);
    else if (act === 'toggle-pass') fn(btn.dataset.target);
    else if (j != null) fn(i, j);
    else if (i != null) fn(i);
    else fn();
  }

  /* périodes analytics */
  $('#view').addEventListener('click', (e) => {
    const b = e.target.closest('#an-range button');
    if (!b) return;
    state.anDays = Number(b.dataset.days) || 30;
    $$('#an-range button').forEach((x) => x.classList.toggle('on', x === b));
    loadAnalytics(state.anDays);
  });

  $('#btn-save').addEventListener('click', () => { saveDraft(false); logAct('Brouillon enregistré'); });
  $('#btn-export').addEventListener('click', () => setView('settings'));
  $('#tab-fr').addEventListener('click', () => { state.editLang = 'fr'; try { localStorage.setItem(LANG_KEY, 'fr'); } catch (e) {} syncLangTabs(); render(); });
  $('#tab-en').addEventListener('click', () => { state.editLang = 'en'; try { localStorage.setItem(LANG_KEY, 'en'); } catch (e) {} syncLangTabs(); render(); });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (state.data) { saveDraft(false); logAct('Brouillon enregistré'); }
    }
    if (e.key === 'Escape' && !$('#modal').hidden) {
      $('#modal').hidden = true;
      if (modalResolve) modalResolve(false);
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  checkAuth();
})();

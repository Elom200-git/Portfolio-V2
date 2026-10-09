/* ══ cms.js — data-driven layer for the portfolio + back-office
   - Loads data/site.json (canonical content, EN/FR)
   - Merges localStorage draft (elom_cms_draft) for live preview
   - Patches I18N dictionaries for singleton texts
   - Re-renders lists: services, projects, skills, certifications, finmodel
   - Progressive enhancement: if fetch fails, static HTML stays untouched
   - Listens to i18n:changed to re-render in the active language */

(function () {
  'use strict';

  const DATA_URL = 'data/site.json';
  const DRAFT_KEY = 'elom_cms_draft';

  const CMS = {
    data: null,
    lang: 'en',
    ready: false
  };
  window.CMS = CMS;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
  }
  function L(obj, lang) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] != null ? obj[lang] : (obj.en != null ? obj.en : '');
  }
  function deepMerge(base, over) {
    if (Array.isArray(over)) return over;
    if (over && typeof over === 'object' && base && typeof base === 'object' && !Array.isArray(base)) {
      const out = Object.assign({}, base);
      for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
      return out;
    }
    return over === undefined ? base : over;
  }
  function getDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function currentLang() {
    if (window.I18N && window.I18N.lang) return window.I18N.lang;
    try {
      const s = localStorage.getItem('elom-lang');
      if (s === 'fr' || s === 'en') return s;
    } catch (e) {}
    return 'en';
  }

  /* ── patch I18N dicts with singleton values from site.json ── */
  function patchI18nDicts(data) {
    if (!window.I18N || !window.I18N.dicts) return;
    const langs = ['en', 'fr'];
    langs.forEach((lg) => {
      const d = window.I18N.dicts[lg];
      if (!d) return;
      try {
        const t = (v) => (v && v[lg] != null ? v[lg] : (v && v.en != null ? v.en : ''));
        if (data.profile && data.profile.seoTitle) {
          d.meta = d.meta || {};
          /* champ bilingue : si la langue courante est vide, retomber sur l'autre */
          const tt = (v) => {
            if (!v) return '';
            const byLang = v[lg];
            if (byLang && String(byLang).trim()) return byLang;
            return v.en || v.fr || '';
          };
          const mt = tt(data.profile.seoTitle);
          if (mt) d.meta.title = mt;
          const md = data.profile.seoDesc ? tt(data.profile.seoDesc) : '';
          if (md) d.meta.description = md;
          const mo = data.profile.ogTitle ? tt(data.profile.ogTitle) : '';
          if (mo) d.meta.ogTitle = mo;
          const mod = data.profile.ogDesc ? tt(data.profile.ogDesc) : '';
          if (mod) d.meta.ogDesc = mod;
        }
        if (data.hero) {
          d.hero = d.hero || {};
          d.hero.eyebrow = t(data.hero.eyebrow); d.hero.desc = t(data.hero.desc);
          d.hero.btnProjects = t(data.hero.btnProjects); d.hero.btnCv = t(data.hero.btnCv);
          d.hero.btnContact = t(data.hero.btnContact);
          (data.hero.stats || []).forEach((s, i) => {
            d.hero['stat' + (i + 1) + 'n'] = s.n || '';
            d.hero['stat' + (i + 1) + 'l'] = lg === 'fr' ? (s.label_fr || '') : (s.label_en || '');
          });
        }
        if (data.services) {
          d.services = d.services || {};
          d.services.label = t(data.services.label); d.services.title1 = t(data.services.title1);
          d.services.title2 = t(data.services.title2); d.services.sub = t(data.services.sub);
          d.services.howTitle = t(data.services.howTitle);
          (data.services.how || []).forEach((h, i) => {
            d.services['how' + (i + 1) + 't'] = lg === 'fr' ? (h.t_fr || '') : (h.t_en || '');
            d.services['how' + (i + 1) + 'd'] = lg === 'fr' ? (h.d_fr || '') : (h.d_en || '');
          });
        }
        if (data.projects) {
          d.projects = d.projects || {};
          d.projects.label = t(data.projects.label); d.projects.title1 = t(data.projects.title1);
          d.projects.title2 = t(data.projects.title2); d.projects.sub = t(data.projects.sub);
        }
        if (data.finmodel) {
          d.finmodel = d.finmodel || {};
          ['label', 'title1', 'title2', 'sub', 'plain', 'plain2'].forEach((k) => {
            if (data.finmodel[k]) d.finmodel[k] = t(data.finmodel[k]);
          });
        }
        if (data.skills) {
          d.skills = d.skills || {};
          d.skills.label = t(data.skills.label); d.skills.title1 = t(data.skills.title1);
          d.skills.title2 = t(data.skills.title2); d.skills.sub = t(data.skills.sub);
          d.skills.coreTitle = t(data.skills.coreTitle);
          d.skills.techTitle = t(data.skills.techTitle);
          d.skills.toolsTitle = t(data.skills.toolsTitle);
          d.skills.extra = t(data.skills.extra);
        }
        if (data.certifications) {
          d.certifications = d.certifications || {};
          d.certifications.label = t(data.certifications.label);
          d.certifications.title1 = t(data.certifications.title1);
          d.certifications.title2 = t(data.certifications.title2);
          d.certifications.sub = t(data.certifications.sub);
          d.certifications.note = t(data.certifications.note);
        }
        if (data.about) {
          d.about = d.about || {};
          ['label', 'tag', 'heading1', 'heading3', 'p1', 'p2', 'p3', 'train1t', 'train1d', 'train2t', 'train2d', 'goal'].forEach((k) => {
            if (data.about[k]) d.about[k] = t(data.about[k]);
          });
        }
        if (data.contact) {
          d.contact = d.contact || {};
          ['big1', 'big2', 'big3', 'sub', 'avail', 'cvTitle'].forEach((k) => {
            if (data.contact[k]) d.contact[k] = t(data.contact[k]);
          });
        }
      } catch (e) { /* keep going */ }
    });
  }

  /* ── SVG icons for services ── */
  const ICONS = {
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17"/><path d="M8 16v-5"/><path d="M12 16v-9"/><path d="M16 16v-3"/><path d="M20 16V7"/></svg>',
    monitor: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18"/><path d="M9 9v9"/><path d="M8 21h8"/></svg>',
    nodes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.2 10.8L16.8 6.8"/><path d="M7.2 13.2l9.6 4"/></svg>',
    table: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v16h16"/><path d="M4 12h16"/><path d="M9 4v16"/><path d="M16 4v8"/><path d="M16 15l1.8 1.8L21 13.5"/></svg>',
    network: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="17" r="2.5"/><circle cx="19" cy="17" r="2.5"/><path d="M12 7.5v5"/><path d="M12 12.5L6.8 15.2"/><path d="M12 12.5l5.2 2.7"/></svg>'
  };  /* ── renderers ── */


  function renderServices(data, lang) {
    const grid = document.getElementById('svc-grid');
    if (!grid || !data.services || !Array.isArray(data.services.items)) return;
    const items = data.services.items.map((s, i) => {
      const icon = ICONS[s.icon] || ICONS.chart;
      const title = lang === 'fr' ? (s.title_fr || s.title_en) : (s.title_en || s.title_fr);
      const desc = lang === 'fr' ? (s.desc_fr || s.desc_en) : (s.desc_en || s.desc_fr);
      return '<div class="svc-card reveal visible rd' + ((i % 3) + 1) + '">' +
        '<div class="svc-icon">' + icon + '</div>' +
        '<h3 class="svc-title">' + esc(title) + '</h3>' +
        '<p class="svc-desc">' + esc(desc) + '</p></div>';
    }).join('');
    const foot = '<div class="svc-card svc-foot reveal visible rd3">' +
      '<p>' +
      esc(data.profile ? (data.profile.firstName + ' ' + data.profile.middleName + ' ' + data.profile.lastName) : '') + '<br>' +
      esc(data.profile ? (data.profile.location + ' · Remote worldwide') : '') + '</p></div>';
    grid.innerHTML = items + foot;
    const howGrid = document.getElementById('how-grid');
    if (howGrid && Array.isArray(data.services.how)) {
      howGrid.innerHTML = data.services.how.map((h, i) => {
        return '<div class="how-item reveal visible rd' + ((i % 3) + 1) + '"><h4 class="how-t">' +
          esc(lang === 'fr' ? (h.t_fr || h.t_en) : (h.t_en || h.t_fr)) + '</h4><p class="how-d">' +
          esc(lang === 'fr' ? (h.d_fr || h.d_en) : (h.d_en || h.d_fr)) + '</p></div>';
      }).join('');
    }
  }

  function carouselHTML(images, carId, carName) {
    const slides = (images || []).map((src, i) => {
      return '<div class="cs' + (i === 0 ? ' on' : '') + '"><img src="' + escAttr(src) + '" alt="' + escAttr(carName) + '" loading="lazy"></div>';
    }).join('');
    const dots = (images || []).map((_, i) => '<span class="csdot' + (i === 0 ? ' on' : '') + '"></span>').join('');
    return '<div class="pf-car" data-car-name="' + escAttr(carName) + '">' + slides +
      '<div class="cs-dots" aria-hidden="true">' + dots + '</div></div>';
  }
  function gridCarouselHTML(images, carName) {
    const slides = (images || []).map((src, i) => {
      return '<div class="cs' + (i === 0 ? ' on' : '') + '"><img src="' + escAttr(src) + '" alt="' + escAttr(carName) + '" loading="lazy"></div>';
    }).join('');
    const dots = (images || []).map((_, i) => '<span class="csdot' + (i === 0 ? ' on' : '') + '"></span>').join('');
    return '<div class="proj-visual" data-car-name="' + escAttr(carName) + '">' + slides +
      '<div class="cs-dots" aria-hidden="true">' + dots + '</div></div>';
  }

  function projectButtons(p, lang) {
    let html = '';
    if (p.linkUrl) {
      const lbl = lang === 'fr' ? (p.linkLabel_fr || p.linkLabel_en || 'Ouvrir ↗') : (p.linkLabel_en || p.linkLabel_fr || 'Open ↗');
      html += '<a href="' + escAttr(p.linkUrl) + '" target="_blank" rel="noopener" class="pf-link live">' + esc(lbl) + '</a>';
    }
    (p.videos || []).forEach((v) => {
      const lbl = lang === 'fr' ? (v.label_fr || v.label_en) : (v.label_en || v.label_fr);
      if (lbl && v.src) html += '<button class="pf-link" data-cms-video="' + escAttr(v.src) + '">' + esc(lbl) + '</button>';
    });
    if (!html && (p.linkLabel_en || p.linkLabel_fr) && !p.linkUrl && !(p.videos || []).length) return '';
    if (!html) return '';
    return '<div class="pf-links-group">' + html + '</div>';
  }

  function renderProjects(data, lang) {
    const wrap = document.getElementById('projects-list');
    if (!wrap || !data.projects || !Array.isArray(data.projects.items)) return;
    const featured = data.projects.items.filter((p) => p.layout === 'featured');
    const grid = data.projects.items.filter((p) => p.layout !== 'featured');
    let html = '';
    featured.forEach((p) => {
      const tag = lang === 'fr' ? (p.tag_fr || p.tag_en) : (p.tag_en || p.tag_fr);
      const title = lang === 'fr' ? (p.title_fr || p.title_en) : (p.title_en || p.title_fr);
      const desc = lang === 'fr' ? (p.desc_fr || p.desc_en) : (p.desc_en || p.desc_fr);
      const metrics = (p.metrics || []).map((m) =>
        '<div><div class="mn">' + esc(m.v) + '</div><div class="ml">' + esc(lang === 'fr' ? (m.l_fr || m.l_en) : (m.l_en || m.l_fr)) + '</div></div>'
      ).join('');
      const tags = (p.tags || []).map((tg) => '<span class="tag">' + esc(tg) + '</span>').join('');
      html += '<div class="pf-card reveal visible' + (p.live ? ' featured' : '') + '">' +
        '<div class="pf-visual">' + carouselHTML(p.images, p.id, title) + '</div>' +
        '<div class="pf-info">' + (tag ? '<div class="pf-tag' + (p.live ? ' live' : '') + '">' + esc(tag) + '</div>' : '') +
        '<h3 class="pf-title">' + esc(title) + '</h3><p class="pf-desc">' + esc(desc) + '</p>' +
        (metrics ? '<div class="pf-metrics">' + metrics + '</div>' : '') +
        (tags ? '<div class="pf-tags">' + tags + '</div>' : '') +
        projectButtons(p, lang) + '</div></div>';
    });
    if (grid.length) {
      html += '<div class="proj-grid">' + grid.map((p, gi) => {
        const tag = lang === 'fr' ? (p.tag_fr || p.tag_en) : (p.tag_en || p.tag_fr);
        const title = lang === 'fr' ? (p.title_fr || p.title_en) : (p.title_en || p.title_fr);
        const desc = lang === 'fr' ? (p.desc_fr || p.desc_en) : (p.desc_en || p.desc_fr);
        const tags = (p.tags || []).map((tg) => '<span class="proj-tag">' + esc(tg) + '</span>').join('');
        return '<div class="proj-card reveal visible rd' + ((gi % 3) + 1) + '"><div class="proj-arr" aria-hidden="true">↗</div>' +
          gridCarouselHTML(p.images, title) +
          (tag ? '<div class="proj-type">' + esc(tag) + '</div>' : '') +
          '<h3 class="proj-title">' + esc(title) + '</h3><p class="proj-desc">' + esc(desc) + '</p>' +
          (tags ? '<div class="proj-tags">' + tags + '</div>' : '') +
          projectButtons(p, lang) + '</div>';
      }).join('') + '</div>';
    }
    wrap.innerHTML = html;
  }

  function renderSkills(data, lang) {
    const layout = document.querySelector('.skills-layout');
    if (!layout || !data.skills || !Array.isArray(data.skills.items)) return;
    const byId = {};
    data.skills.items.forEach((s) => { byId[s.id] = s; });
    const item = (s) => {
      const name = lang === 'fr' ? (s.name_fr || s.name_en) : (s.name_en || s.name_fr);
      return '<div class="sk-item">' + esc(name) + '</div>';
    };
    const group = (titleKey, fallbackTitle, ids, rd) => {
      const list = ids.map((id) => byId[id]).filter(Boolean).map(item).join('');
      if (!list) return '';
      return '<div class="sk-group reveal visible' + rd + '"><p class="sk-group-t">' +
        esc(window.I18N ? window.I18N.t(titleKey) : fallbackTitle) + '</p>' +
        '<div class="sk-items">' + list + '</div></div>';
    };
    const extra = L(data.skills.extra, lang);
    layout.innerHTML =
      group('skills.coreTitle', 'Core expertise', ['excel', 'python', 'eco'], '') +
      group('skills.techTitle', 'Technologies', ['sql', 'pbi', 'econometrics'], ' rd1') +
      (extra ? '<div class="sk-group reveal visible rd2"><p class="sk-group-t">' +
        esc(window.I18N ? window.I18N.t('skills.toolsTitle') : 'Also working with') + '</p>' +
        '<div class="sk-items"><div class="sk-item">' + esc(extra) + '</div></div></div>' : '');
  }

  function renderCerts(data, lang) {
    const grid = document.getElementById('cert-grid');
    if (!grid || !data.certifications || !Array.isArray(data.certifications.items)) return;
    const pill = (st) => {
      if (st === 'obtained') return { cls: 'cp-done', en: 'Obtained', fr: 'Obtenu' };
      if (st === 'progress') return { cls: 'cp-prog', en: 'In progress', fr: 'En cours' };
      return { cls: 'cp-plan', en: 'Planned', fr: 'Planifié' };
    };
    grid.innerHTML = data.certifications.items.map((c, i) => {
      const p = pill(c.status);
      const title = lang === 'fr' ? (c.title_fr || c.title_en) : (c.title_en || c.title_fr);
      const org = lang === 'fr' ? (c.org_fr || c.org_en) : (c.org_en || c.org_fr);
      const desc = lang === 'fr' ? (c.desc_fr || c.desc_en) : (c.desc_en || c.desc_fr);
      const color = c.color === 'coral' ? 'cb-coral' : (c.color === 'teal' ? 'cb-teal' : (c.color === 'gold' ? 'cb-gold' : 'cb-blue'));
      const disabled = (!c.certKey || c.status === 'planned') ? ' disabled' : '';
      return '<button class="cert reveal visible rd' + (i % 4) + '"' + (c.certKey ? ' data-cert="' + escAttr(c.certKey) + '"' : '') + disabled + '>' +
        '<div class="cert-badge ' + color + '" aria-hidden="true">' + esc(c.badge || '•') + '</div>' +
        '<div class="cert-info"><div class="cert-nm">' + esc(title) + '</div>' +
        (org ? '<div class="cert-org">' + esc(org) + '</div>' : '') +
        (desc ? '<div class="cert-sub">' + esc(desc) + '</div>' : '') + '</div>' +
        '<span class="cpill ' + p.cls + '">' + esc(lang === 'fr' ? p.fr : p.en) + '</span></button>';
    }).join('');
  }

  function renderFinmodel(data, lang) {
    const stats = document.getElementById('fm-stats');
    if (stats && Array.isArray(data.finmodel.stats)) {
      stats.innerHTML = data.finmodel.stats.map((s) =>
        '<div class="fm-stat"><div class="mn">' + esc(s.v) + '</div><div class="ml">' +
        esc(lang === 'fr' ? (s.l_fr || s.l_en) : (s.l_en || s.l_fr)) + '</div></div>'
      ).join('');
    }
    const feats = document.getElementById('fm-features');
    if (feats && Array.isArray(data.finmodel.features)) {
      feats.innerHTML = data.finmodel.features.map((f, i) =>
        '<div class="fm-feat reveal visible' + (i ? ' rd' + i : '') + '"><div class="fm-feat-t">' +
        esc(lang === 'fr' ? (f.t_fr || f.t_en) : (f.t_en || f.t_fr)) + '</div><div class="fm-feat-d">' +
        esc(lang === 'fr' ? (f.d_fr || f.d_en) : (f.d_en || f.d_fr)) + '</div></div>'
      ).join('');
    }
  }

  function patchProfile(data) {
    if (!data.profile) return;
    const pr = data.profile;
    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      if (pr.email && a.textContent.includes('@') === false && a.href.includes('mailto:')) {
        // keep href in sync if it looks like the main email link
      }
    });
    const mailLinks = document.querySelectorAll('a[href^="mailto:"]');
    mailLinks.forEach((a) => {
      if (pr.email && (a.href.includes('toublousamuel') || a.classList.contains('btn'))) {
        a.href = 'mailto:' + pr.email;
      }
    });
    const mailVal = document.querySelector('.cc-value');
    // contact cards: update by position is fragile — update known cards
    const cards = document.querySelectorAll('.contact-card');
    cards.forEach((c) => {
      const href = c.getAttribute('href') || '';
      if (href.startsWith('mailto:') && pr.email) {
        c.href = 'mailto:' + pr.email;
        const v = c.querySelector('.cc-value');
        if (v) v.textContent = pr.email;
      } else if (href.startsWith('tel:') && pr.phoneLink) {
        c.href = pr.phoneLink;
        const v = c.querySelector('.cc-value');
        if (v && pr.phone) v.textContent = pr.phone;
      } else if (href.includes('linkedin') && pr.linkedin) {
        c.href = pr.linkedin;
        const v = c.querySelector('.cc-value');
        if (v && pr.linkedinLabel) v.textContent = pr.linkedinLabel;
      } else if (href.includes('github') && pr.github) {
        c.href = pr.github;
        const v = c.querySelector('.cc-value');
        if (v && pr.githubLabel) v.textContent = pr.githubLabel;
      }
    });
    // CV links
    document.querySelectorAll('a[href*="_CV_"]').forEach((a) => {
      if (a.href.includes('Professional') && pr.cvPro) a.href = pr.cvPro;
      if (a.href.includes('Academic') && pr.cvAca) a.href = pr.cvAca;
    });
    // photos
    if (pr.photo) {
      const heroImg = document.querySelector('.photo-wrap img');
      if (heroImg) heroImg.src = pr.photo;
    }
    if (pr.photoAbout) {
      const aboutImg = document.querySelector('.about-photo img');
      if (aboutImg) aboutImg.src = pr.photoAbout;
    }
  }

  /* ── dynamic interactions for CMS-rendered nodes ── */
  function initDynamic() {
    // reveal: mark visible on intersection
    try {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
      }, { threshold: 0.08 });
      document.querySelectorAll('.reveal:not(.visible)').forEach((el) => obs.observe(el));
    } catch (e) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
    }
    // carousels rotation for cms nodes
    document.querySelectorAll('.pf-car, .proj-visual').forEach((car) => {
      if (car.dataset.cmsInit) return;
      car.dataset.cmsInit = '1';
      const slides = Array.from(car.querySelectorAll('.cs'));
      const dots = Array.from(car.querySelectorAll('.csdot'));
      if (slides.length <= 1) return;
      let cur = 0, timer = null;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      car.addEventListener('mouseenter', () => { if (timer) { clearInterval(timer); timer = null; } });
      car.addEventListener('mouseleave', start);
      function start() {
        if (timer) return;
        timer = setInterval(() => {
          slides[cur].classList.remove('on'); if (dots[cur]) dots[cur].classList.remove('on');
          cur = (cur + 1) % slides.length;
          slides[cur].classList.add('on'); if (dots[cur]) dots[cur].classList.add('on');
        }, 3600);
      }
      start();
    });
    // animated counters (re-observe cms-rendered metric nodes)
    try { if (typeof window.initCounters === 'function') window.initCounters(); } catch (e) {}
    // lightbox for cms images
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    if (lightbox && lightboxImg && !lightbox.dataset.cmsInit) {
      lightbox.dataset.cmsInit = '1';
      document.addEventListener('click', (e) => {
        const img = e.target.closest ? e.target.closest('.pf-car img, .proj-visual img') : null;
        if (!img) return;
        const car = img.closest('.pf-car, .proj-visual');
        if (!car) return;
        const all = Array.from(car.querySelectorAll('img')).map((im) => im.src).filter(Boolean);
        const idx = Math.max(0, all.indexOf(img.src));
        lightboxImg.src = all[idx]; lightboxImg.alt = img.alt || 'Project';
        if (lightboxCaption) lightboxCaption.textContent = (idx + 1) + ' / ' + all.length;
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    }
    // generic video modal for data-cms-video buttons
    if (!document.getElementById('cms-video-modal')) {
      const ov = document.createElement('div');
      ov.className = 'modal-overlay';
      ov.id = 'cms-video-modal';
      ov.setAttribute('role', 'dialog');
      ov.innerHTML = '<div class="modal-box"><button class="modal-close">Close</button>' +
        '<video class="modal-video" controls preload="none"></video></div>';
      document.body.appendChild(ov);
      const close = () => {
        ov.classList.remove('open');
        const v = ov.querySelector('video');
        if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
      };
      ov.querySelector('.modal-close').addEventListener('click', close);
      ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      document.addEventListener('click', (e) => {
        const btn = e.target.closest ? e.target.closest('[data-cms-video]') : null;
        if (!btn) return;
        e.preventDefault();
        const src = btn.getAttribute('data-cms-video');
        const v = ov.querySelector('video');
        v.src = src; ov.classList.add('open'); v.play();
      });
    }
  }

  function renderAll() {
    if (!CMS.data) return;
    const lang = currentLang();
    CMS.lang = lang;
    patchI18nDicts(CMS.data);
    renderServices(CMS.data, lang);
    renderProjects(CMS.data, lang);
    renderSkills(CMS.data, lang);
    renderCerts(CMS.data, lang);
    renderFinmodel(CMS.data, lang);
    patchProfile(CMS.data);
    initDynamic();
    CMS.ready = true;
    document.dispatchEvent(new CustomEvent('cms:ready', { detail: { lang } }));
  }

  async function boot() {
    CMS.lang = currentLang();
    let base = null;
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (res.ok) base = await res.json();
    } catch (e) { base = null; }
    if (!base) return; // static fallback
    const draft = getDraft();
    CMS.data = draft ? deepMerge(base, draft) : base;

    /* ── application du brouillon : image OG + mode maintenance ── */
    try {
      const pr = CMS.data.profile || {};
      const hasDraft = !!draft;
      // image Open Graph (valeur simple, hors dictionnaire)
      if (hasDraft && pr.ogImage) {
        const og3 = document.querySelector('meta[property="og:image"]');
        if (og3) og3.setAttribute('content', pr.ogImage);
      }
      // Mode maintenance : écran d'attente plein écran
      if (hasDraft && pr.maintenance) {
        if (!document.getElementById('maintenance-screen')) {
          const div = document.createElement('div');
          div.id = 'maintenance-screen';
          div.innerHTML = '<div class="maint-box"><div class="maint-mark">E</div><h1>Le site est en maintenance</h1>' +
            '<p>Elom Samuel Toublou met à jour son portfolio.<br>Revenez dans quelques minutes.</p>' +
            '<div class="maint-dot"></div></div>';
          document.documentElement.appendChild(div);
          document.documentElement.style.overflow = 'hidden';
        }
      }
    } catch (e) {}
    // apply after I18N has loaded its dicts; retry a few times
    let tries = 0;
    const applyWhenReady = () => {
      tries++;
      const hasDicts = window.I18N && window.I18N.dicts && (window.I18N.dicts.en || window.I18N.dicts.fr);
      if (hasDicts || tries > 20) {
        if (window.I18N && window.I18N.dicts && window.I18N.dicts[CMS.lang]) {
          patchI18nDicts(CMS.data);
          try { window.I18N.apply(); } catch (e) {}
        }
        renderAll();
      } else {
        setTimeout(applyWhenReady, 150);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(applyWhenReady, 60));
    } else {
      setTimeout(applyWhenReady, 60);
    }
    document.addEventListener('i18n:changed', () => {
      /* le dict fraîchement chargé est brut : re-patcher puis ré-appliquer (SEO inclus) */
      if (CMS.data) {
        try {
          patchI18nDicts(CMS.data);
          if (window.I18N && window.I18N.apply) window.I18N.apply();
        } catch (e) {}
      }
      renderAll();
    });
    window.addEventListener('storage', (e) => {
      if (e.key === DRAFT_KEY) {
        const d = getDraft();
        if (d && base) { CMS.data = deepMerge(base, d); renderAll(); }
      }
    });
    document.addEventListener('cms:draft-updated', () => {
      const d = getDraft();
      if (d && base) { CMS.data = deepMerge(base, d); renderAll(); }
    });
  }

  boot();
})();

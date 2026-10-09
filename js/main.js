/* ══ main.js — interactions
   nav scroll, scrollspy, hamburger, video modals,
   image lightbox, carousels, scroll reveal */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {

    /* ══ NAV SCROLL + SCROLLSPY ══ */
    const nav = document.getElementById('nav');
    const navAnchors = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'))
      .filter(a => a.hash && a.hash.length > 1);
    const spySections = navAnchors
      .map(a => document.querySelector(a.hash))
      .filter(Boolean);

    window.addEventListener('scroll', () => {
      nav?.classList.toggle('scrolled', scrollY > 60);
      /* scroll progress bar */
      const doc = document.documentElement;
      const max = doc.scrollHeight - innerHeight;
      document.querySelector('.scroll-progress')?.style
        .setProperty('transform', 'scaleX(' + (max > 0 ? Math.min(scrollY / max, 1) : 0) + ')');
      if (!navAnchors.length) return;
      const pos = scrollY + 140;
      let current = null;
      spySections.forEach(sec => {
        if (sec.offsetTop <= pos) current = sec.id;
      });
      navAnchors.forEach(a => a.classList.toggle('active', !!current && a.hash === '#' + current));
    }, { passive: true });

    /* ══ HAMBURGER ══ */
    const hamburger = document.getElementById('nav-hamburger');
    const mobileMenu = document.getElementById('nav-mobile');
    const mobileClose = document.getElementById('nav-mobile-close');

    function openMobileMenu() {
      mobileMenu.classList.add('open'); hamburger.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      mobileClose?.focus();
    }
    function closeMobileMenu() {
      mobileMenu.classList.remove('open'); hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    hamburger?.addEventListener('click', () => {
      if (mobileMenu?.classList.contains('open')) closeMobileMenu(); else openMobileMenu();
    });
    mobileClose?.addEventListener('click', closeMobileMenu);
    document.querySelectorAll('.nav-mobile-link').forEach(link => link.addEventListener('click', closeMobileMenu));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobileMenu?.classList.contains('open')) closeMobileMenu();
    });

    /* ══ MODALS VIDÉO ══ */
    document.querySelectorAll('[data-modal]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const modal = document.getElementById(btn.dataset.modal);
        if (!modal) return;
        modal.classList.add('open');
        modal.querySelector('video')?.play();
      });
    });
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      const closer = modal.querySelector('.modal-close');
      closer?.addEventListener('click', () => closeModal(modal));
      modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
    });
    function closeModal(modal) {
      modal.classList.remove('open');
      const v = modal.querySelector('video');
      if (v) { v.pause(); v.currentTime = 0; }
    }
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
    });

    /* ══ LIGHTBOX ══ */
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    let lightboxImages = [];
    let lightboxIndex = 0;

    function openLightbox(imgs, index, projectName) {
      lightboxImages = imgs; lightboxIndex = index;
      lightboxImg.src = imgs[index]; lightboxImg.alt = projectName;
      lightboxCaption.textContent = (index + 1) + ' / ' + imgs.length;
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    }
    function lightboxNav(dir) {
      lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
      lightboxImg.src = lightboxImages[lightboxIndex];
      lightboxCaption.textContent = (lightboxIndex + 1) + ' / ' + lightboxImages.length;
    }
    document.getElementById('lightbox-close')?.addEventListener('click', closeLightbox);
    document.getElementById('lightbox-prev')?.addEventListener('click', () => lightboxNav(-1));
    document.getElementById('lightbox-next')?.addEventListener('click', () => lightboxNav(1));
    lightbox?.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', e => {
      if (!lightbox?.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lightboxNav(-1);
      if (e.key === 'ArrowRight') lightboxNav(1);
    });

    function attachLightbox(container, projectName) {
      const slides = Array.from(container.querySelectorAll('.cs'));
      slides.forEach((slide) => {
        const img = slide.querySelector('img');
        if (!img) return;
        img.addEventListener('click', () => {
          const validImgs = slides.map(s => s.querySelector('img'))
            .filter(im => im && im.naturalWidth > 0).map(im => im.src);
          const clickedIdx = validImgs.indexOf(img.src);
          if (validImgs.length > 0) openLightbox(validImgs, Math.max(0, clickedIdx), projectName);
        });
      });
    }

    /* ══ CAROUSEL ENGINE ══ */
    function initCar(container, ms) {
      const slides = Array.from(container.querySelectorAll('.cs'));
      const dots = Array.from(container.querySelectorAll('.csdot'));
      const name = container.dataset.carName || 'Project';
      let loaded = 0, checked = 0, cur = 0, timer = null;
      const vis = [];

      function onCheck() {
        checked++;
        if (checked < slides.length) return;
        if (loaded === 0) {
          dots.forEach(d => { if (d.parentElement) d.parentElement.style.display = 'none'; });
          return;
        }
        if (vis.length > 1) attachLightbox(container, name);
        startRotation();
      }
      slides.forEach(s => {
        const img = s.querySelector('img');
        if (!img) { onCheck(); return; }
        if (img.complete) {
          if (img.naturalWidth > 0) { loaded++; vis.push(s); } else s.style.display = 'none';
          onCheck();
        } else {
          img.addEventListener('load', () => { loaded++; vis.push(s); onCheck(); });
          img.addEventListener('error', () => { s.style.display = 'none'; onCheck(); });
        }
      });

      function startRotation() {
        const vdot = dots.slice(0, vis.length);
        if (vis.length <= 1) { vdot.forEach(d => d.style.display = 'none'); return; }
        vis.forEach((s, i) => s.classList.toggle('on', i === 0));
        vdot.forEach((d, i) => d.classList.toggle('on', i === 0));
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        /* pause on hover — reading time, no autoplay fight */
        container.addEventListener('mouseenter', () => { if (timer) { clearInterval(timer); timer = null; } });
        container.addEventListener('mouseleave', start);
        function start() {
          if (timer) return;
          timer = setInterval(() => {
            vis[cur].classList.remove('on'); vdot[cur]?.classList.remove('on');
            cur = (cur + 1) % vis.length;
            vis[cur].classList.add('on'); vdot[cur]?.classList.add('on');
          }, ms);
        }
        start();
      }
    }
    document.querySelectorAll('.pf-car').forEach(c => initCar(c, 3800));
    document.querySelectorAll('.proj-visual').forEach(c => initCar(c, 3200));

    /* ══ SCROLL REVEAL ══ */
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

    /* ══ COUNT-UP on visible numbers ══
       only numeric-leading values (100+, 7, 2+…); text metrics untouched.
       exposed globally so cms.js can re-init after re-rendering nodes */
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const numObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        numObs.unobserve(e.target);
        const el = e.target;
        const raw = el.textContent.trim();
        const m = raw.match(/^(\d[\d,\s.]*)(.*)$/);
        if (!m || prefersReduced) return;
        const end = parseInt(m[1].replace(/[\s,]/g, ''), 10);
        if (!isFinite(end) || end <= 0 || end > 100000) return;
        if (end >= 1900 && end <= 2100) return; /* years stay static */
        const suffix = m[2] || '';
        const dur = 900, t0 = performance.now();
        function tick(t) {
          const p = Math.min((t - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(end * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        el.textContent = '0' + suffix;
        requestAnimationFrame(tick);
      });
    }, { threshold: .5 });
    function initCounters() {
      const nums = document.querySelectorAll('.stat-n, .fm-stat .mn, .pf-metrics .mn');
      nums.forEach(el => {
        if (el.dataset.counted) return;
        el.dataset.counted = '1';
        numObs.observe(el);
      });
    }
    window.initCounters = initCounters;
    initCounters();
  });
})();

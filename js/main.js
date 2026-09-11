/* ══ main.js — all v2 interactions preserved & enhanced ══
   starfield, caret cursor, nav scroll, hamburger, video modals,
   image lightbox, carousels, scroll reveal, skill bars, finmodel tabs */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {

    /* ══ FOND ÉTOILÉ ══ */
    (function () {
      const canvas = document.getElementById('starfield');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let W, H, stars = [];
      const mouse = { x: -1000, y: -1000 };
      const STAR_COUNT = 150;
      const COLORS = ['#4A9EBF', '#2BBFA0', '#F06240', '#ffffff', '#D0EBF5'];
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
      function createStars() {
        stars = [];
        for (let i = 0; i < STAR_COUNT; i++) {
          stars.push({
            x: Math.random() * W, y: Math.random() * H,
            ox: 0, oy: 0, r: Math.random() * 1.5 + .5,
            vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
            alpha: Math.random(), color: COLORS[Math.floor(Math.random() * COLORS.length)]
          });
          stars[i].ox = stars[i].x; stars[i].oy = stars[i].y;
        }
      }
      function draw() {
        ctx.clearRect(0, 0, W, H);
        stars.forEach(s => {
          s.ox += s.vx; s.oy += s.vy;
          let dx = mouse.x - s.ox, dy = mouse.y - s.oy, dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) { let f = (100 - dist) / 100; s.x = s.ox - (dx / dist) * f * 50; s.y = s.oy - (dy / dist) * f * 50; }
          else { s.x = s.ox; s.y = s.oy; }
          if (s.ox < 0) s.ox = W; if (s.ox > W) s.ox = 0; if (s.oy < 0) s.oy = H; if (s.oy > H) s.oy = 0;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = s.color; ctx.globalAlpha = Math.max(.2, Math.min(1, s.alpha)); ctx.fill();
        });
        if (!reduced) requestAnimationFrame(draw);
      }
      window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
      window.addEventListener('resize', () => { resize(); createStars(); });
      resize(); createStars(); draw();
    })();

    /* ══ CURSEUR ══ */
    const caret = document.getElementById('caret');
    if (caret) {
      document.addEventListener('mousemove', e => { caret.style.left = e.clientX + 'px'; caret.style.top = e.clientY + 'px'; });
      document.querySelectorAll('a, button, .proj-card, .pf-card, .cert').forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('on-link'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('on-link'));
      });
    }

    /* ══ NAV SCROLL ══ */
    window.addEventListener('scroll', () => {
      document.getElementById('nav')?.classList.toggle('scrolled', scrollY > 60);
    });

    /* ══ HAMBURGER ══ */
    const hamburger = document.getElementById('nav-hamburger');
    const mobileMenu = document.getElementById('nav-mobile');
    const mobileClose = document.getElementById('nav-mobile-close');

    function openMobileMenu() {
      mobileMenu.classList.add('open'); hamburger.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function closeMobileMenu() {
      mobileMenu.classList.remove('open'); hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    hamburger?.addEventListener('click', openMobileMenu);
    mobileClose?.addEventListener('click', closeMobileMenu);
    document.querySelectorAll('.nav-mobile-link').forEach(link => link.addEventListener('click', closeMobileMenu));

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
      slides.forEach((slide, i) => {
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
      let loaded = 0, checked = 0;
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

      let cur = 0;
      function startRotation() {
        const vdot = dots.slice(0, vis.length);
        if (vis.length <= 1) { vdot.forEach(d => d.style.display = 'none'); return; }
        vis.forEach((s, i) => s.classList.toggle('on', i === 0));
        vdot.forEach((d, i) => d.classList.toggle('on', i === 0));
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        setInterval(() => {
          vis[cur].classList.remove('on'); vdot[cur]?.classList.remove('on');
          cur = (cur + 1) % vis.length;
          vis[cur].classList.add('on'); vdot[cur]?.classList.add('on');
        }, ms);
      }
    }
    document.querySelectorAll('.pf-car').forEach(c => initCar(c, 3800));
    document.querySelectorAll('.proj-visual').forEach(c => initCar(c, 3200));

    /* ══ SCROLL REVEAL ══ */
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

    /* ══ SKILL BARS ══ */
    const skObs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        document.querySelectorAll('.skill-fill').forEach(f => f.style.width = f.dataset.w + '%');
        skObs.disconnect();
      }
    }, { threshold: .2 });
    const sk = document.getElementById('skills');
    if (sk) skObs.observe(sk);

    /* ══ FIN MODEL TABS ══ */
    const fmImg = document.getElementById('fm-img');
    if (fmImg) {
      const fmAlts = {
        1: 'Financial model — Modele financier tab',
        2: 'Financial model — Data tab',
        3: 'Financial model — Hypothèses tab'
      };
      document.querySelectorAll('.fm-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.fm-tab').forEach(t => {
            t.classList.toggle('on', t === tab);
            t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
          });
          const n = tab.dataset.fm;
          fmImg.src = `assets/images/finmodel/finmodel-${n}.webp`;
          fmImg.alt = fmAlts[n] || 'Financial model';
        });
      });
    }
  });
})();

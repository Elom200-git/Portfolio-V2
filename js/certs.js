/* ══ Certificate protected viewer ══
   - Certificates served from obfuscated paths (v_*.jpg)
   - View-only: no <a href> to raw file, pointer-events disabled on img,
     drag disabled, context menu blocked inside the viewer only,
     keyboard-accessible open/close, focus management.
   The mapping below never exposes the original file names. */

(function () {
  'use strict';

  // obfuscated asset paths — sha256-derived, no original names exposed
  const CERTS = {
    'unicef':      'assets/images/certifications/v_d9c88b840369.jpg',
    'oif-dclic3':  'assets/images/certifications/v_4b61a16839ed.jpg',
    'oif-dclic2':  'assets/images/certifications/v_5c9b10effc14.jpg',
    'fcc-english': 'assets/images/certifications/v_f75689a9a4d0.jpg',
    'google-dm':   'assets/images/certifications/v_6b604d6a1a47.jpg',
    'coursera-1':  'assets/images/certifications/v_20783911bd72.jpg',
    'coursera-2':  'assets/images/certifications/v_af0c67c531b0.jpg',
    'work-1':      'assets/images/certifications/v_0628bf535d84.jpg',
    'work-2':      'assets/images/certifications/v_dda36ed5b4ca.jpg',
    'rank':        'assets/images/certifications/v_a01833e2867a.jpg',
    'diploma':     'assets/images/certifications/v_3b2da8af513b.jpg'
  };

  const viewer = document.getElementById('cert-viewer');
  const img = document.getElementById('cert-viewer-img');
  const closeBtn = document.getElementById('cert-viewer-close');
  const titleEl = document.getElementById('cert-viewer-title');
  let lastFocus = null;

  function open(key, label) {
    const src = CERTS[key];
    if (!src) return;
    lastFocus = document.activeElement;
    img.src = src;
    img.alt = (window.I18N && window.I18N.t) ? window.I18N.t('certifications.viewerTitle') : 'Certificate';
    if (label) img.alt = label;
    viewer.classList.add('open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    viewer.classList.remove('open');
    document.body.style.overflow = '';
    img.src = '';
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.cert[data-cert]').forEach(btn => {
      btn.addEventListener('click', () => {
        open(btn.dataset.cert, btn.querySelector('.cert-nm')?.textContent);
      });
    });
    closeBtn.addEventListener('click', close);
    viewer.addEventListener('click', e => { if (e.target === viewer) close(); });

    // block context menu inside the viewer only (view-only protection)
    viewer.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('keydown', e => {
      if (!viewer.classList.contains('open')) return;
      if (e.key === 'Escape') close();
    });
  });
})();

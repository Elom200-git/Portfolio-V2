/* ══ i18n — lightweight dependency-free localization ══
   Hydrates data-i18n (textContent), data-i18n-content (attribute content)
   and data-i18n-label (aria-label) from /i18n/{lang}.json.
   Persists choice in localStorage, swaps <html lang>, no reload. */

(function () {
  'use strict';

  const I18N = {
    dicts: {},
    lang: 'en',

    async load(lang) {
      if (!this.dicts[lang]) {
        const res = await fetch(`i18n/${lang}.json`);
        if (!res.ok) throw new Error(`i18n: ${lang}.json not found`);
        this.dicts[lang] = await res.json();
      }
      return this.dicts[lang];
    },

    t(key) {
      const d = this.dicts[this.lang];
      if (!d) return key;
      const parts = key.split('.');
      let v = d;
      for (const p of parts) {
        if (v == null) return key;
        v = v[p];
      }
      return (v == null) ? key : v;
    },

    apply() {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const v = this.t(el.getAttribute('data-i18n'));
        if (v != null) el.textContent = v;
      });
      document.querySelectorAll('[data-i18n-content]').forEach(el => {
        const v = this.t(el.getAttribute('data-i18n-content'));
        if (v != null) el.setAttribute('content', v);
      });
      document.querySelectorAll('[data-i18n-label]').forEach(el => {
        const v = this.t(el.getAttribute('data-i18n-label'));
        if (v != null) el.setAttribute('aria-label', v);
      });
      document.documentElement.lang = this.lang;
      document.title = this.t('meta.title');
    },

    async set(lang) {
      try {
        await this.load(lang);
      } catch (e) {
        console.error(e);
        return;
      }
      this.lang = lang;
      try { localStorage.setItem('elom-lang', lang); } catch (e) {}
      this.apply();
      document.querySelectorAll('#lang-en, #lang-mob-en').forEach(b => {
        b.classList.toggle('on', lang === 'en');
        b.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
      });
      document.querySelectorAll('#lang-fr, #lang-mob-fr').forEach(b => {
        b.classList.toggle('on', lang === 'fr');
        b.setAttribute('aria-pressed', lang === 'fr' ? 'true' : 'false');
      });
      document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
    },

    init() {
      let saved = null;
      try { saved = localStorage.getItem('elom-lang'); } catch (e) {}
      const lang = (saved === 'fr' || saved === 'en') ? saved : 'en';
      this.set(lang);
      document.querySelectorAll('#lang-en, #lang-mob-en').forEach(b =>
        b.addEventListener('click', () => this.set('en')));
      document.querySelectorAll('#lang-fr, #lang-mob-fr').forEach(b =>
        b.addEventListener('click', () => this.set('fr')));
    }
  };

  window.I18N = I18N;
  document.addEventListener('DOMContentLoaded', () => I18N.init());
})();

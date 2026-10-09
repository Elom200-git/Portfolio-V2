# Portfolio - Elom Samuel Toublou (v3)

Personal freelance portfolio of a data analyst / BI developer / financial modeler based in Lomé, Togo.

Bilingual (English default, French secondary), vanilla HTML/CSS/JS, no frameworks, no build step.

**Live:** deployed on Vercel (auto-deploys on every push to `main`).

## Setup

No build tools. To run locally, serve the folder over HTTP (the i18n dictionaries are fetched via `fetch()`, so double-clicking `index.html` won't load translations, a local server is required):

```bash
# any static server works, e.g.:
python -m http.server 8000
# then open http://localhost:8000
```

## Folder structure

```
/index.html              # single-page site, all sections
/css/main.css            # full design system (light, data-driven identity)
/js/i18n.js             # EN⇄FR engine (data-i18n hydration, localStorage persistence)
/js/certs.js            # protected certificate viewer (view-only)
/js/main.js             # carousels, lightbox, modals, scrollspy, reveal…
/js/cms.js              # data-driven layer: renders lists from data/site.json (+ draft preview)
/data/site.json         # canonical content (all sections, EN+FR), edited via back-office
/i18n/en.json           # English dictionary (default language)
/i18n/fr.json           # French dictionary
/admin/                 # back-office (login + dashboard + CRUD + export)
/assets/images/projects/       # project & profile images (WebP)
/assets/images/certifications/ # certificate scans (obfuscated filenames, view-only)
/assets/images/finmodel/       # financial model screenshots (WebP)
/assets/documents/cv/          # downloadable English CVs (PDF + source HTML)
/assets/videos/                # project demo videos (mp4)
```

## Skills

Skills are grouped editorially (no percentage bars): **Core expertise** (`excel`, `python`, `eco` ids), **Technologies** (`sql`, `pbi`, `econometrics` ids) and **Also working with** (`skills.extra`). Group titles live in `skills.coreTitle` / `skills.techTitle` / `skills.toolsTitle`.

## Back-office (`/admin/`)

Interface pro pour tout modifier sans toucher au code : hero, services, projets (ajout/suppression/duplication, images, vidéos, tags, métriques, liens), modélisation financière, compétences, certifications, **CV & Expériences** (synchronisation temps réel avec projets et certifications), à propos, contact/profil, bandeau défilant, médias, audience (analytics Upstash sans cookies).

- URL locale : `http://localhost:8000/admin/` (mot de passe par défaut : `admin123`, à changer dans Réglages).
- Module CV (`data.cv` dans `data/site.json`) :
  - Intègre l'intégralité du CV extrait du fichier Word (`CV_TOUBLOU_Elom_Samuel_Data.docx`).
  - **Synchronisation automatique** : Dès que l'administrateur ajoute ou modifie un projet ou une certification dans l'admin, le CV s'actualise instantanément !
  - Gestion des expériences professionnelles (CRUD complet, puces/missions bilingues, réordonnancement), formations, compétences clés et références.
  - Aperçu live au format A4 avec bascule FR/EN et bouton "Imprimer / PDF".
  - Page publique dynamique et imprimable en PDF : `/cv.html` (et `/assets/documents/cv/`).
- Fonctionnement : chaque frappe est sauvegardée en **brouillon local** (`localStorage`) avec **aperçu live** (iframe du site). Rien n'est mis en ligne tant que vous n'exportez pas.
- Mise en ligne : **Réglages et export → Tout télécharger** (`site.json` + `en.json` + `fr.json`) → remplacez `data/site.json`, `i18n/en.json`, `i18n/fr.json` dans le repo → `git add -A && git commit -m "update: contenu via back-office" && git push` (Vercel redéploie).
- Le tableau de bord signale les contenus **non publiés** (brouillon en avance sur le repo) et contrôle la **qualité** (titres vides, images inconnues, traductions manquantes, emails invalides).
- Projets et médias : **recherche + filtres**. Aperçu **desktop/mobile**, sauvegarde auto + `Ctrl+S`, import/export avec tailles de fichiers.
- Import : un `site.json` peut être réimporté depuis Réglages. Réinitialiser efface le brouillon local.
- Sécurité : protection par mot de passe **côté navigateur uniquement** (dissuasion, pas de vraie sécurité, normal pour un site statique). La page admin est en `noindex`. Pour une vraie restriction, protégez `/admin/` côté Vercel ou gardez le repo privé.
- Sans JS / SEO : le HTML statique d'origine reste en place comme fallback ; `cms.js` ne fait que le remplacer quand `data/site.json` charge.

## Editing translations

All user-visible strings live in `i18n/en.json` and `i18n/fr.json` (mirrored keys). In the HTML, strings are bound with:

- `data-i18n="key.path"` → replaces the element's text content
- `data-i18n-content="key.path"` → replaces a meta tag's `content` attribute
- `data-i18n-label="key.path"` → replaces an element's `aria-label`

To change copy: edit both JSON files, keep keys identical across languages, and the change is live on reload. The language choice persists in `localStorage` (`elom-lang`).

## Updating projects

Project cards live in `index.html` inside `<section id="projects">`. Each card uses:

- `.pf-card`, large featured cards (two-column layout, image carousel on the left)
- `.proj-card`, compact grid cards (three-column layout)

Carousels need no JS changes: add a `.cs` slide (containing an `<img>`) and a matching `.csdot` inside `.cs-dots`. The engine auto-detects loaded/broken images. Set the project name via `data-car-name="..."` on the `.pf-car` / `.proj-visual` container (used for lightbox alt text).

Videos: drop an `.mp4` in `assets/videos/`, add a modal block (copy an existing `modal-demo*`), and link it with a `data-modal="modal-id"` button.

## Updating certifications

1. Certificate images live in `assets/images/certifications/` under obfuscated names (`v_*.jpg`), **never** rename them to anything guessable, and never link them directly with `<a href>`; they must only be shown through the protected viewer (`js/certs.js`).
2. The mapping (cert key → obfuscated file) lives at the top of `js/certs.js`.
3. Cards live in `<section id="certifications">`; each clickable card carries `data-cert="key"`.

Status pills: `cp-done` (obtained) / `cp-prog` (in progress) / `cp-plan` (planned), labels come from the i18n dictionaries (`certifications.statusObtained`, etc.).

## CVs

The two English CVs (`Elom_Toublou_CV_Professional_EN.pdf`, `Elom_Toublou_CV_Academic_EN.pdf`) are freely downloadable from the hero and contact sections. Their editable HTML sources sit alongside them in `assets/documents/cv/`, edit, then re-print to PDF from a browser (Chrome → Print → Save as PDF, margins: none, background graphics: on).

## Deployment (Vercel)

The repo is connected to Vercel: every push to `main` auto-deploys. No config file needed (static output).

---

© Elom Samuel Toublou

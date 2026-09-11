# Portfolio — Elom Samuel Toublou (v3)

Personal freelance portfolio of a data analyst / BI developer / financial modeler based in Lomé, Togo.

Bilingual (English default, French secondary), vanilla HTML/CSS/JS — no frameworks, no build step.

**Live:** deployed on Vercel (auto-deploys on every push to `main`).

## Setup

No build tools. To run locally, serve the folder over HTTP (the i18n dictionaries are fetched via `fetch()`, so double-clicking `index.html` won't load translations — a local server is required):

```bash
# any static server works, e.g.:
python -m http.server 8000
# then open http://localhost:8000
```

## Folder structure

```
/index.html              # single-page site, all sections
/css/main.css            # full design system (dark data-driven identity)
/js/i18n.js             # EN⇄FR engine (data-i18n hydration, localStorage persistence)
/js/certs.js            # protected certificate viewer (view-only)
/js/main.js             # starfield, cursor, carousels, lightbox, modals, reveal…
/i18n/en.json           # English dictionary (default language)
/i18n/fr.json           # French dictionary
/assets/images/projects/       # project & profile images (WebP)
/assets/images/certifications/ # certificate scans (obfuscated filenames, view-only)
/assets/images/finmodel/       # financial model screenshots (WebP)
/assets/documents/cv/          # downloadable English CVs (PDF + source HTML)
/assets/videos/                # project demo videos (mp4)
```

## Editing translations

All user-visible strings live in `i18n/en.json` and `i18n/fr.json` (mirrored keys). In the HTML, strings are bound with:

- `data-i18n="key.path"` → replaces the element's text content
- `data-i18n-content="key.path"` → replaces a meta tag's `content` attribute
- `data-i18n-label="key.path"` → replaces an element's `aria-label`

To change copy: edit both JSON files, keep keys identical across languages, and the change is live on reload. The language choice persists in `localStorage` (`elom-lang`).

## Updating projects

Project cards live in `index.html` inside `<section id="projects">`. Each card uses:

- `.pf-card` — large featured cards (two-column layout, image carousel on the left)
- `.proj-card` — compact grid cards (three-column layout)

Carousels need no JS changes: add a `.cs` slide (containing an `<img>`) and a matching `.csdot` inside `.cs-dots`. The engine auto-detects loaded/broken images. Set the project name via `data-car-name="..."` on the `.pf-car` / `.proj-visual` container (used for lightbox alt text).

Videos: drop an `.mp4` in `assets/videos/`, add a modal block (copy an existing `modal-demo*`), and link it with a `data-modal="modal-id"` button.

## Updating certifications

1. Certificate images live in `assets/images/certifications/` under obfuscated names (`v_*.jpg`) — **never** rename them to anything guessable, and never link them directly with `<a href>`; they must only be shown through the protected viewer (`js/certs.js`).
2. The mapping (cert key → obfuscated file) lives at the top of `js/certs.js`.
3. Cards live in `<section id="certifications">`; each clickable card carries `data-cert="key"`.

Status pills: `cp-done` (obtained) / `cp-prog` (in progress) / `cp-plan` (planned) — labels come from the i18n dictionaries (`certifications.statusObtained`, etc.).

## CVs

The two English CVs (`Elom_Toublou_CV_Professional_EN.pdf`, `Elom_Toublou_CV_Academic_EN.pdf`) are freely downloadable from the hero and contact sections. Their editable HTML sources sit alongside them in `assets/documents/cv/` — edit, then re-print to PDF from a browser (Chrome → Print → Save as PDF, margins: none, background graphics: on).

## Deployment (Vercel)

The repo is connected to Vercel: every push to `main` auto-deploys. No config file needed (static output).

---

© Elom Samuel Toublou

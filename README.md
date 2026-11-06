# Dt Amna Transformation — Website + Admin Panel

A dynamic website for Dt Amna Transformation, with an admin panel for managing the site without touching code.

## Run it

Needs **Node.js 22.13 or newer** (uses the built-in SQLite database).

```bash
npm install
npm start
```

- Website: http://localhost:3000
- Admin panel: http://localhost:3000/admin

The **first time** you open `/admin`, it asks you to create the admin username and password. After that it shows the normal login.

## What the admin panel does

| Page | What you can do |
|---|---|
| **Analytics** | Visitors, page views, social media visits, booking/WhatsApp clicks, form leads, conversion rate (all compared with the previous period). Also: where visitors come from (Instagram, Facebook, TikTok, WhatsApp, Google…), which source turns into bookings, most-read blog posts with read-to-end rate, most-clicked links and buttons, top pages, devices, auto-generated "Key insights", and a tracking-link builder. |
| **Page sections** | Add new sections (12 types, including free-form "Custom content"), edit text and photos, drag to reorder, show/hide, duplicate, delete, and choose which ones appear in the top menu. |
| **Blog** | Write posts with a rich editor (headings, lists, links, images, YouTube videos), cover photo, summary, tags, drafts, scheduled publishing. |
| **Photos & media** | Upload photos (drag and drop), copy links, delete. Any photo field in the panel can also upload directly. |
| **Leads** | Every contact-form submission, with the platform the person came from, a WhatsApp button, and CSV export. |
| **Settings** | Brand name, logo, main colour, phone/WhatsApp, email, booking link, social links, header button, Google title/description, and your admin password. |

## Tracking social media accurately

Instagram, WhatsApp and some other apps often hide where a visitor came from. Use tracking links in your bio and posts. The Analytics page builds them for you, e.g.

```
https://yourdomain.com/?utm_source=instagram
https://yourdomain.com/?utm_source=facebook
https://yourdomain.com/?utm_source=tiktok
```

Your own visits are not counted while you are logged in to the admin panel.

## Project layout

```
server.js            Web server, pages and API
src/db.js            Database (SQLite file in data/site.db)
src/defaults.js      Starting content (loaded once on first run)
src/analytics.js     Visit / click / source tracking and reports
src/auth.js          Admin login
shared/schemas.js    Section types and their editable fields
views/               Page templates (one per section type in views/sections/)
public/              CSS, JS, images; uploads go in public/uploads/
admin/               Admin panel
```

## Going live

The site needs a host that runs Node.js (for example a VPS, Railway, Render or Hostinger's Node.js hosting); plain static hosting won't work. Keep these two folders on persistent storage and back them up:

- `data/` — the database (content, blog, leads, analytics)
- `public/uploads/` — uploaded photos

Optional environment variables: `PORT` (default 3000), `DATA_DIR`, `UPLOAD_DIR`. Serve the site over HTTPS so the admin login cookie is marked secure.

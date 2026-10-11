# AminZi Tailor

Counter app for **AminZi Fabrics & Tailors**: orders, Perahan/Tunban measurements, workshop stages, fabric rolls, perfume stock, tailor wages, receipts and labels.
Built from the *AminZi Glass* design handoff. **React 18 + TypeScript + Vite + Tailwind CSS v4**, Supabase (Postgres + RLS) as the shared database, offline-first.

---

## 1. Set up Supabase (once)

1. Supabase Dashboard → **SQL Editor** → **New query** → paste all of `supabase/migrations/20261010000000_init.sql` → **Run**.
   It creates the tables, row-level security, stock/payment ledgers, realtime, and the trigger that turns Auth users into Admins.
   Then do the same with `supabase/migrations/20261011000000_cash_book.sql` (the money book behind *Money in the shop*).
   It is safe to run again. Until it is run, the dashboard shows a reminder and counts customer payments only.
2. **Turn off public sign-up** (important): Authentication → Sign In / Providers → switch off **Allow new users to sign up**.
   Every Auth user becomes an Admin of the shop, so only you should be able to create them.
3. **Create the admins**: Authentication → Users → **Add user → Create new user** (email + password, tick *Auto Confirm User*).
   The database adds them to the shop as **Admin** automatically. Their display name is taken from user metadata `name`
   if you set it, otherwise from the email (`roohullamin@…` → "Roohullamin"). Users created before you ran the SQL are linked too.
4. Front-desk staff and tailors don't need Supabase accounts: an Admin adds them under **Users** and they sign in at the counter with a PIN.
   - Menu names in the Supabase dashboard change from time to time; search the dashboard if a label differs.

## 2. Connect the app

Copy `.env.example` to `.env` (already done if you received this with a `.env`) and fill in, from **Project Settings → API Keys**:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Only the **publishable** key goes here. The app refuses to start with a secret / `service_role` key.
`.env` is in `.gitignore` — don't commit it.

## 3. Run

```bash
npm install
npm start          # build + serve the fast production version: http://localhost:4173  ← use this at the counter
npm run dev        # development mode with live reload (much slower — for changing code only)
npm run build      # production build in dist/ (static files — any web host or a local server)
npm run i18n:check # lists any screen text missing from Dari or Pashto
```

**Speed.** `npm run dev` runs the unbundled development build and is several times slower than `npm start`; never judge speed in dev mode.
The glass panels are drawn by the graphics card: in Chrome/Edge keep *Settings → System → Use graphics acceleration when available* switched **on**.
The moving background (*Motion* in the bottom-right dock) is off by default; leave it off on older PCs.

## 4. Sign in

The sign-in screens use the Glass mockup's own design: the app behind a blurred scrim, with the rounded glass card in the middle.

- **Sign in** with the email and password you created in Supabase. *Forgot password?* emails a reset link. There is no sign-up.
- **Try the demo** opens a sample shop with the exact mock data from the design handoff (orders AT-1032…AT-1042, nine customers, six fabric rolls, five perfumes, five staff). It runs only in this browser, never touches Supabase, and needs no `.env`. *Exit demo* from the counter card leaves it.
- **Who is at the counter?** — pick your name. In the demo that signs you in with one click (as in the mockup); in a real shop each person enters a 4-digit PIN (set on first sign-in).

## How it works

| Area | What happens |
|---|---|
| Offline-first | Every change is applied on screen at once and saved in this PC's IndexedDB outbox. It is pushed to Supabase when the internet is up, in order. The pill at the top right shows *Offline · N saved on this PC*. The service worker caches the app so it opens without internet (after the first load). |
| Other counters | Realtime + a pull every 30 s. Two counters that issue the same order/customer number while offline: the later one is renumbered on sync. |
| Money & stock | `payments`, `fabric_movements`, `perfume_movements` are append-only ledgers. Triggers update `orders.paid`, `fabrics.metres_left`, `perfumes.stock`; direct edits of those totals are ignored by the database. A payment above the balance is rejected. |
| Security | RLS: a signed-in user only sees shops they are a member of (`shop_members`). Anonymous access is revoked. Counter PINs are a convenience lock between staff, hashed with PBKDF2 on the device; the real boundary is the shop sign-in. |
| Roles | Admin: everything (every Supabase Auth user is an Admin, enforced by the database; their role can't be changed or paused in the app). Front desk: no Users/Settings. Tailor: no Users/Settings/Perfumes, no stock edits — these two are enforced in the app only. Click a name under Users to edit role, phone, tailor wage rate or reset a PIN. |
| Money | Dashboard → *Money in the shop* (Admin and Front desk; tailors don't see it) = every customer payment (deposits and later payments) + fabric and perfume sales + other money in − money out. A payment, a *Sell 1 m* or a *Sell one* adds to it the moment it is recorded. *+ Money in* records opening cash or other income; *− Money out* records wages, rent, bills, stock purchases and other expenses. *All ↗* lists every movement. The book is append-only: to correct a mistake, record the opposite entry. |
| Wages | Pieces that reach **Ready** this week (Saturday–Friday) × the tailor's rate per piece (set under Users). |
| Printing | Receipt (80 mm) and label (50 × 30 mm) open the system print dialog. Choose the receipt/label printer there once and set it as default. |
| Backup | Settings → *Back up now* downloads a full `.json` copy (PINs removed) to copy to USB. A browser cannot write to a USB drive on its own, so the nightly switch is stored as a setting only; data is also kept in Supabase and on this PC. |
| Language | Settings → Language switches **every** screen: menus, headings, buttons, measurements (پیراهن/کمیس, تنبان/پرتوګ, شانه, آستین, یخن…), stages, roles, garments, colours, toasts, errors, notifications, help/FAQ, dates and month names, receipts and labels. Layout stays left-to-right (shop decision); Dari/Pashto text runs right-to-left inside it. Digits stay 0-9. Calendar: Solar Hijri (Afghan month names) or Gregorian. Names a shop types are shown as typed; the demo shop's names are translated too. |

## Styling (Tailwind CSS v4)

- `src/index.css` is the design system: `@import 'tailwindcss'`, Glass tokens mapped with `@theme inline`, base styles, keyframes, the `glass` / `glass-strong` utilities and a small `@layer components` (`card`, `btn`, `btn-acc`, `btn-glass`, `btn-chip`, `chip`, `input`, `field`, `eyebrow`, `list-btn`, `avatar`, `act`).
- Backdrops *Silk · Dusk · Alpine · Pearl* and six accents (teal, navy, crimson, amber, violet, ice) are picked in the bottom-right dock and remembered per PC. `ThemeRoot` sets the colour variables once per change (never on mouse move).
- Fonts: Geist (sans), Geist Mono, Playfair Display (headings), with Vazirmatn for Dari/Pashto. Self-hosted via @fontsource for offline use; only Latin + Arabic-script files are bundled.
- Toggle states use ARIA (`aria-pressed`, `aria-current`) with Tailwind variants.

## Translations

- All text is written in English in the code and passed through `t('…')` (`src/lib/i18n.ts`). Dari is in `src/lib/i18n-fa.ts`, Pashto in `src/lib/i18n-ps.ts`, keyed by the English text.
- Data the app ships (stages, roles, garments, colours, demo names) goes through `tv()` and the glossary at the bottom of those files.
- `npm run i18n:check` fails if any string is missing in either language, a `{placeholder}` differs, or Persian digits slipped in.

## Project layout

```
supabase/migrations/   SQL schema, RLS, triggers, RPC
src/lib/               types, constants, formatting + Solar Hijri, i18n, Supabase client, PIN hashing
src/data/              store.ts (outbox, IndexedDB, sync, realtime), apply.ts (local mirror of DB rules),
                       actions.ts (business actions), derive.ts (KPIs, wages, notifications)
src/pages/             Dashboard, Orders + Waitlist, Customers, Fabric/Perfume stock, Users/Settings/Help
src/sheets/            right-hand drawers: order detail, new order, measurements, forms, search, sync
src/auth/              shop sign-in, shop setup, counter PIN login
src/print/             receipt + label print layouts
```

## Known limits

- Every screen is translated, but the Dari and Pashto wording needs a native-speaker review before release (tailoring terms especially). Error messages that come straight from the Supabase server stay in English.
- Demo wages are calculated from the demo orders (pieces finished this week × rate), so they show smaller numbers than the mockup's fixed example (14/11/9 pieces).
- Backup is a manual download (a browser cannot write to a USB drive on its own); there is no restore screen yet.
- Staff roles are not enforced by the database (one shared shop login).
- Deleting customers, orders or stock items is not in the UI (by design for an audit trail; edit in Supabase if needed).
- Very large shops: each sync downloads all rows (paged); fine for thousands of orders, revisit beyond that.

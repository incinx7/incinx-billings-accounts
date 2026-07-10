# INCINX — Billing & Accounts (React rewrite, Phase 1)

This is the start of the React/Vite rewrite of your original single-file
`index.html` billing app. Phase 1 covers the **foundation**: project
structure, design system, shared state, and the app shell (sidebar, topbar,
lock screen, routing to all 16 pages). Individual modules (Invoices,
Clients, Expenses, etc.) are still placeholders — see "Roadmap" below.

## Setup

```bash
npm install
cp .env.example .env
# then fill in .env with your real Supabase URL / anon key / app password
npm run dev
```

Open the printed local URL (usually http://localhost:5173).

## What changed vs. the original file

- **Split into a real project**: `src/pages/*` (one file per sidebar page),
  `src/components/*` (Sidebar, Topbar, Layout, PinScreen, shared UI),
  `src/context/DBContext.jsx` (central state, replaces the global `DB`
  variable), `src/lib/*` (utils.js — all your calculation/formatting
  helpers ported 1:1; supabase.js — sync layer).
- **Design is preserved exactly** — all your CSS custom properties, fonts,
  and component classes were carried over into `src/index.css` unchanged.
- **Google Drive sync was removed** (per your request) — the app now syncs
  via localStorage + Supabase only.
- **Security fixes** (see below) — these were the two most urgent issues
  found in the original file.

## Security issues fixed

1. **Supabase `service_role` key removed from client code.** The original
   app shipped this key in the browser, which bypasses Row Level Security
   and gives full read/write/delete access to your *entire* Supabase
   project to anyone who views page source. The rewrite uses only the
   `anon` key. **You need to add RLS policies** on your `app_data` table
   allowing the `anon` role to select/insert/delete — see the comment in
   `src/lib/supabase.js` for exactly where.
2. **Hardcoded plaintext password removed from source.** It's now read from
   an environment variable (`VITE_APP_PASSWORD`) instead of being a literal
   string in the code. **Important caveat:** this is still not real
   authentication — Vite inlines env vars into the built JS bundle, so a
   determined person could still extract it from your deployed site, same
   as before. If you want real access control, the right fix is a proper
   auth provider (e.g. Supabase Auth with email/password or magic link) —
   worth doing in a later phase.

## Roadmap (remaining phases)

- **Phase 2 — Core CRUD modules**: Clients, Vendors, Projects, Petty Cash,
  Expenses, Expo & Events, Informal Income, Settings.
- **Phase 3 — Invoicing engine**: Invoices, Quotations, Proforma (shared
  line-item/tax logic and print templates).
- **Phase 4 — Dashboard & Reports**: Project P&L, Monthly Tracker, Reports
  & CA exports, Import Invoices.
- **Phase 5 — Auth & extras**: replace the password gate with real auth,
  and port the QR scanner if you're still using it.

## Notes

- `npm install` needs internet access, which wasn't available in the
  environment that generated this project — so it hasn't been run or
  tested end-to-end yet. Run it locally and let me know about any errors
  and I'll fix them before we move to Phase 2.

# 🧾 BillDesk — Bill Management Application

A full-stack bill manager built exactly on the architecture plan:

> **VS Code → GitHub → Vercel** (React frontend) → **Supabase** (Auth + REST API + Edge Functions) → **PostgreSQL** → **Twilio WhatsApp Business API** → user's phone.

The app ships with a **fully working Demo Mode** (mock backend, seeded data) so you can try everything instantly — connect Supabase credentials later to go live.

---

## ✨ Features

| Feature | Where |
|---|---|
| 🔐 **Animated login home** — glassmorphism card, drifting gradient orbs, floating chips, rotating logo ring, shimmer button (respects reduced-motion) | Home |
| 👤 Accounts are **created by the Master Admin** (no public sign-up): Add User with name, email, **password**, designation, role | Users page |
| ✏️ **Edit users**: change **user name**, designation, WhatsApp, profile image, and **set/change password** | Users page |
| 🚫 Members: view their own records only — **no Add-Record form, no Profile section** | Bills / sidebar |
| 📋 **Inward register** — inline Add Record form (admins) with Inward No, Bill Type, Date, Description, Claim ₹, e-office, Head of Account, CP No, Remarks | Bills page |
| 🔄 **Status workflow** — Processing → Submitted to Admin → Approved → Paid / Rejected, editable **inline per row** | Bills page |
| 👥 **Bills / Members tabs** + record search | Bills page |
| 📤 **Export CSV** of all filtered records | Bills page |
| 📎 Bill copy per record: **file upload** (Supabase Storage) **or Google Drive link** (validated + inline preview) | Bills page |
| 🙋 **Assigned-to column** — admins assign any officer to a record inline | Bills page |
| ✏️ **Edit / delete** any record (full edit modal) | Bills page |
| 👑 **Master Admin** — manage users, change roles (Member ↔ Sub Admin ↔ Master Admin), deactivate accounts, manage *everyone's* records | Bills/Members tab + Users page |
| 🛡️ **Sub Admin** — view all users, manage everyone's records (roles locked) | Bills/Members tab + Users page |
| ✏️ Profile: **name change**, **designation change**, **WhatsApp number**, **profile image** (upload or URL) | Profile page |
| 🎨 **6 themes** — Pearl Light, Midnight Dark (default, matches the register UI), Ocean Blue, Forest Green, Sunset Rose (all users) + **Royal Golden 👑 (Master Admin only)** | Themes page |
| 📊 Dashboard — monthly claims chart, claims by bill type, overdue/due-soon tracking | Dashboard page |
| 💬 WhatsApp bill reminders (bills with a due date within 3 days / overdue, 24-h de-dup) | Supabase Edge Function + Twilio |

### Roles & permissions

| | Member | Sub Admin | Master Admin |
|---|:-:|:-:|:-:|
| Manage own bills (add/edit/delete) | ✅ | ✅ | ✅ |
| View & manage **all** users' bills | — | ✅ | ✅ |
| View users list | — | ✅ (read-only) | ✅ |
| Change user roles / deactivate users | — | — | ✅ |
| **Royal Golden theme** | — | — | ✅ |

Security is enforced at **three levels**: UI (locked controls), backend API layer, and **Postgres RLS + triggers** (`supabase/migration.sql` — role-change guard, last-master-admin guard, and a trigger that silently strips `golden` from non-master profiles).

---

## 🚀 Quick start (Demo Mode — no backend needed)

```bash
npm install
npm run dev
```

Log in with the quick buttons (any password works):

- `master@demo.io` — **Master Admin** (Golden theme unlocked 👑)
- `sub@demo.io` — Sub Admin
- `user@demo.io` — Member

---

## 🌐 Go live (production path from the diagram)

### 1 · Supabase (backend)
1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → run **`supabase/migration.sql`** (tables, triggers, RLS, storage buckets, categories).
3. Auth → Providers → Email: enable. *(Optional: disable "Confirm email" for instant login while testing.)*
4. Sign up through the app, then run `supabase/promote-master-admin.sql` to make yourself **Master Admin**.

### 2 · Vercel (hosting + CI/CD)
1. Push this folder to a **GitHub** repo.
2. [vercel.com](https://vercel.com) → Import repo → framework **Vite** auto-detected.
3. Environment variables:
   - `VITE_SUPABASE_URL` = Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` = Project Settings → API → anon public key
4. Deploy. Every `git push` now auto-deploys (the CI/CD arrow in the diagram ✅).

### 3 · Twilio WhatsApp reminders (Edge Function + cron)
1. Get a Twilio account, enable **WhatsApp Sandbox** (or the WhatsApp Business API for production).
2. Deploy the function:
   ```bash
   npm i -g supabase && supabase login && supabase link --project-ref <PROJECT_REF>
   supabase secrets set TWILIO_ACCOUNT_SID=ACxx… TWILIO_AUTH_TOKEN=… \
     TWILIO_WHATSAPP_FROM=+14155238886 CRON_SECRET=<random-string>
   supabase functions deploy whatsapp-reminders --no-verify-jwt
   ```
3. Uncomment & adapt the **`cron.schedule`** block at the bottom of `supabase/migration.sql` (needs the `pg_cron` + `pg_net` extensions) — reminders then go out hourly to users whose bills are due within 3 days. Users must set their WhatsApp number on the Profile page.

---

## 📁 Project structure

```
billdesk/
├── src/
│   ├── pages/            Dashboard · Bills · Users · Profile · Appearance(Auth too)
│   ├── context.jsx       Auth / Theme / Toast providers
│   ├── ui.jsx            Icons, modals, badges, avatars
│   ├── charts.jsx        Dependency-free SVG bar & donut charts
│   └── lib/
│       ├── api.js             ← picks Demo Mode or Supabase automatically
│       ├── mockBackend.js     Demo backend (same API surface)
│       ├── supabaseBackend.js Production backend (Auth/DB/Storage)
│       └── supabaseClient.js
├── supabase/
│   ├── migration.sql          Full schema + RLS + guards + cron template
│   ├── promote-master-admin.sql
│   └── functions/whatsapp-reminders/index.ts   Twilio Edge Function
├── vercel.json · .env.example · index.html
```

## 🎨 Theme notes
- Themes are CSS-variable palettes (`src/index.css`), persisted per user (`profiles.theme`).
- **Royal Golden** is hidden from non-master users in the picker and topbar menu, rejected by the setter, and a DB trigger resets it to `light` if a master admin is demoted.

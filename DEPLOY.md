# 🚀 BillDesk — Full Deployment Guide (Supabase + GitHub + Vercel + Twilio)

Follow these steps in order. Total time: ~30–45 minutes. Everything below uses **free tiers**.

---

## STEP 0 — Get the source code
1. Download **`billdesk-source.zip`** from the workspace (I created it for you — it excludes `node_modules` and `dist`; Vercel builds those automatically).
2. Unzip it on your computer. You'll get the `billdesk/` folder.

---

## STEP 1 — Create the Supabase backend (do this BEFORE Vercel, you need its keys)

1. Go to **[supabase.com](https://supabase.com)** → **New project**
   - Name: `billdesk` · Set a strong **Database Password** (save it) · Region: **Mumbai (ap-south-1)** — best for Bengaluru
2. When it's ready, copy two values from **Project Settings → API**:
   - **Project URL** → e.g. `https://abcdefgh.supabase.co`
   - **anon public key** → long `eyJhbGciOi...` string
   - Also note your **Project Reference ID** (Settings → General) — you'll need it for Edge Functions.

### 1b. Create the database (tables, security, themes trigger)
3. In Supabase: **SQL Editor → New query** → open `billdesk/supabase/migration.sql`, copy **the entire file**, paste → **Run**.
   - ✅ This creates: `profiles`, `bills` (inward register), `bill types`, `payments`, RLS security policies, the Royal-Golden-theme trigger, role guards, storage buckets, and seeds the bill types.
4. **Authentication → Sign In / Providers → Email**: turn **OFF "Confirm email"** (admin-created users log in immediately).

---

## STEP 2 — Upload to GitHub

In the unzipped `billdesk` folder, open a terminal and run (replace `<your-username>`):

```bash
git init
git add .
git commit -m "BillDesk - initial release"
git branch -M main
git remote add origin https://github.com/<your-username>/billdesk.git
git push -u origin main
```

> Create the empty repo first on **github.com → New repository** (name: `billdesk`, Private is fine).
> `.gitignore` already excludes `node_modules`, `dist`, and `.env` — nothing sensitive gets uploaded.

---

## STEP 3 — Deploy to Vercel

1. Go to **[vercel.com](https://vercel.com)** → **Sign in with GitHub**
2. **Add New → Project** → **Import** your `billdesk` repo
3. Framework Preset: **Vite** (auto-detected) — leave build settings as-is
4. Open **Environment Variables** and add BOTH (tick Production, Preview, Development):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://abcdefgh.supabase.co` (your Project URL) |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` (your anon key) |

5. Click **Deploy** → in ~1 minute you get **`https://billdesk-<you>.vercel.app`** 🎉
   - The "DEMO MODE" pill is now **gone** — the app is talking to your real Supabase.
6. Back in **Supabase → Authentication → URL Configuration**: set **Site URL** to your Vercel URL (and add it under Redirect URLs). This makes sign-in links point to your live app.

---

## STEP 4 — Create the FIRST Master Admin (you!)

> **ℹ️ The "email" is just a login ID.** Users never sign up and never receive emails —
> only the Master Admin creates accounts (name, role, password) from the app's Users page.
> You can even use fake IDs like `ramesh@office.local`. This dashboard page is used **once**,
> to bootstrap the very first admin.

1. **Supabase → Authentication → Users → Add user → Create new user**
   - Email ID: `ramesh@office.local` (anything) · Password: strong one · ✅ **Auto Confirm User** (no email is sent)
2. **SQL Editor → New query** → run (change the ID to match!):
   ```sql
   update public.profiles
   set role = 'master_admin', theme = 'golden'
   where email = 'ramesh@office.local';
   ```
3. Open your Vercel URL → log in with that ID & password → you're the 👑 **Master Admin with the Golden theme**.
4. From **Users → ＋ Add user**, create all Sub Admins and Members yourself — their login ID, name, role and password. Share credentials with them securely. **You never need this Supabase page again.**

---

## STEP 5 — Edge Functions (user management + WhatsApp reminders)

The app needs **two** functions. Easiest way is the **Supabase Dashboard** (no command line):

### 5a. `admin-manage-user` (required — powers Add User & password changes)
1. **Supabase → Edge Functions → Create a new function** → name it exactly `admin-manage-user`
2. Replace the generated code with the contents of `billdesk/supabase/functions/admin-manage-user/index.ts` → **Deploy**.

### 5b. `whatsapp-reminders` (optional — the Twilio notifications)
1. Create another function named exactly `whatsapp-reminders`
2. Paste the contents of `billdesk/supabase/functions/whatsapp-reminders/index.ts` → **Deploy**.

### 5c. Secrets (needed by both)
**Project Settings → Edge Functions → Secrets** → add:

| Secret | Where to get it |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio Console dashboard (`AC…`) — see Step 6 |
| `TWILIO_AUTH_TOKEN` | Twilio Console → show token |
| `TWILIO_WHATSAPP_FROM` | Twilio sandbox/WhatsApp sender number, e.g. `+14155238886` |
| `CRON_SECRET` | Any long random string you invent (e.g. from a password generator) |

> CLI alternative: `npx supabase login` → `npx supabase link --project-ref <REF>` →
> `npx supabase functions deploy admin-manage-user` →
> `npx supabase functions deploy whatsapp-reminders --no-verify-jwt` →
> `npx supabase secrets set TWILIO_ACCOUNT_SID=… TWILIO_AUTH_TOKEN=… TWILIO_WHATSAPP_FROM=… CRON_SECRET=…`

---

## STEP 6 — Twilio WhatsApp (notifications)

1. Create a free account at **[twilio.com](https://www.twilio.com)**
2. **For testing (free):** Console → **Messaging → Try it out → Send a WhatsApp message** → join the sandbox from your phone by sending the shown code (e.g. `join xxxx`) to `+1 415 523 8886`. Each user who should receive reminders must join the sandbox once with their WhatsApp.
3. **For production:** apply for **WhatsApp Business API** senders inside Twilio (needs Meta Business verification) and use the approved sender number in `TWILIO_WHATSAPP_FROM`.
4. Copy your **Account SID** and **Auth Token** into the Supabase secrets (Step 5c).

### 6b. Schedule hourly reminders (optional)
1. **Supabase → Database → Extensions** → enable **`pg_cron`** and **`pg_net`**
2. **SQL Editor** → run the commented `cron.schedule` block at the bottom of `migration.sql` (uncomment it, and replace `<PROJECT_REF>`, `<ANON_KEY>`, `<YOUR_CRON_SECRET>`).
3. Any bill with a **due date** within 3 days (or overdue) now triggers a WhatsApp reminder to the assigned user's number (set on their user profile). Re-sends are suppressed for 24 h per bill.

---

## STEP 7 — Go-live checklist

- [ ] Login works at your `*.vercel.app` URL (no "DEMO MODE" pill)
- [ ] Master Admin: **Users → Add user** creates a working account (tests the Edge Function)
- [ ] Add a bill with a Google Drive link → inline preview opens
- [ ] Change a status inline (Processing → Submitted → Approved) — "Modified" column updates
- [ ] Export CSV downloads
- [ ] Switch themes incl. Royal Golden 👑 (as Master)
- [ ] Log in as a Member → sees only own/assigned bills, no admin controls
- [ ] Custom domain (optional): Vercel → Settings → Domains → add your domain, update Supabase Site URL to match

### Troubleshooting quick hits
| Symptom | Fix |
|---|---|
| "DEMO MODE" still shows on Vercel | Env vars missing/typo → re-add & **Redeploy** |
| `Failed to fetch` on login | Supabase Site URL not set, or email confirmation left ON |
| "Only the Master Admin can do this" when adding users | `admin-manage-user` function not deployed, or caller isn't `master_admin` in `profiles` |
| No WhatsApp arriving | Secrets missing; user's phone empty; Twilio sandbox not joined by recipient; cron not scheduled |
| New bill type needed | SQL Editor: `insert into categories (name, icon, color) values ('Civil Bill','🧱','#f97316');` |

---

## 💰 Costs at this scale
- **Supabase Free**: 500 MB DB, 50k MAU — plenty to start
- **Vercel Hobby**: free for personal/company internal apps
- **Twilio**: sandbox free; production WhatsApp = per-conversation fees (Meta) + Twilio numbers

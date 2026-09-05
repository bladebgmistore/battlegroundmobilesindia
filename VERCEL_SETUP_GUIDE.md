# Vercel Deployment Guide (Battlegrounds Mobile India Store)

This is a standard **Next.js 16 (App Router)** app — Vercel pe zero-config deploy hota hai.
Neeche 2 tarike hain. **Option A (GitHub integration) recommended** — har push pe auto-deploy.

---

## Option A — GitHub se deploy (recommended, 2 minute)

1. **PR merge karo**: is branch ka PR (`arena/01a0708a-battlegroundmobilesindia` → `main`) GitHub pe merge kar do, taaki `main` par latest code (Buy-Now-free CTAs + light theme + login-only checkout) aa jaye.

2. **Vercel pe import karo**:
   - [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → `bladebgmistore/battlegroundmobilesindia` select karo
   - GitHub connect karne ke liye ek baar "Authorize Vercel" karna padega

3. **Framework Preset**: Vercel khud **Next.js** detect kar lega (build command `npm run build`, output auto) — kuch change mat karo.

4. **Environment Variables** add karo (Project → Settings → Environment Variables):

   | Key | Required | Value |
   |---|---|---|
   | `DATABASE_URL` | ✅ Yes (production ke liye) | Neon/Postgres connection string (`postgresql://...sslmode=require`) — same jo abhi Netlify pe use ho raha hai |
   | `SMTP_HOST` | Optional | `smtp.gmail.com` (admin OTP email ke liye) |
   | `SMTP_PORT` | Optional | `465` |
   | `SMTP_USER` | Optional | aapki email |
   | `SMTP_PASS` | Optional | Gmail App Password (16-char) |
   | `OTP_FROM` | Optional | `Battleground India Store <you@gmail.com>` |

   > ⚠️ `DATABASE_URL` ke bina site chalti hai lekin **demo fallback mode** mein — orders/users persist nahi honge. Production mein hamesha set karo.

5. **Deploy** dabao — 2-3 min mein live: `https://<project-name>.vercel.app`

6. **Har push pe auto-deploy**: baad mein sirf `git push` karo, Vercel khud build kar dega. PRs ke liye preview URL bhi milta hai.

7. **(Optional) Custom domain**: Project → Settings → Domains → apna domain add karo. Domain lagane ke baad `src/app/layout.tsx` mein `metadataBase` URL bhi update kar dena (SEO ke liye).

---

## Option B — Vercel CLI se deploy (aapke computer par)

```bash
npm install -g vercel
vercel login                 # browser se login
vercel link                  # project link karo
vercel env add DATABASE_URL  # production DB string paste karo
vercel --prod                # production deploy
```

> 🔒 Token/chat mein credentials kabhi share na karein. CLI login aapke hi machine par hota hai.

---

## Netlify → Vercel shift notes

- `netlify.toml` Vercel ignore kar deta hai — delete karne ki zaroorat nahi (dono parallel chala sakte ho).
- `@netlify/plugin-nextjs` devDependency Vercel pe koi asar nahi daalti.
- Custom Cache-Control headers (`next.config.ts` ke `headers()`) Vercel pe fully supported hain.
- Current Netlify domain `metadataBase` (`src/app/layout.tsx`) mein set hai — Vercel domain primary banega to usko update karein.

---

## Post-deploy checklist

- [ ] `/api/health` 200 de raha hai
- [ ] Signup → checkout → order flow ek baar manually test karo (login ab checkout ke liye **compulsory** hai)
- [ ] Admin panel (`/admin`) login + catalog save test karo
- [ ] Payment QR aapke real UPI ID se generate ho raha hai (admin → Payment & Checkout Control)

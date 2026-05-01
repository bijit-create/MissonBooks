<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Mission Book — Question Generation App

Vite + React frontend, with Gemini calls proxied through Vercel serverless
functions. The backend rotates through a pool of Gemini API keys
(round-robin + failover on quota / invalid-key errors), so keys never reach
the browser and you can scale capacity by adding more keys.

## Architecture

- `src/` — React app. Calls `/api/*` over `fetch`. No Gemini SDK in the bundle.
- `api/` — Vercel serverless functions:
  - `api/validate-ncert.ts` — NCERT validation (text + Google search grounding)
  - `api/generate-questions.ts` — question generation (JSON output)
  - `api/generate-image.ts` — image generation
  - `api/edit-image.ts` — image edit
- `api/_lib/keys.ts` — round-robin key picker (reads `GEMINI_API_KEYS`).
- `api/_lib/gemini.ts` — wrapper that retries with the next key on 429 /
  invalid-key / permission errors, up to N attempts (N = key count).
- `server.ts` — Express dev server (Vite middleware + the same `api/*`
  handlers) so `npm run dev` works locally without `vercel dev`.

## Run locally

**Prerequisites:** Node.js 20+

1. `npm install`
2. Copy `.env.example` to `.env.local` and set:
   ```
   GEMINI_API_KEYS=your_key_1,your_key_2
   ```
3. `npm run dev` → open http://localhost:3000

## Deploy: GitHub → Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.env.local` is gitignored — keys never leave your machine.

### 2. Import the repo into Vercel

1. https://vercel.com/new → import the GitHub repo.
2. Vercel auto-detects **Vite** (build command and output directory are
   already set in `vercel.json`).
3. Under **Environment Variables**, add:
   - **Name:** `GEMINI_API_KEYS`
   - **Value:** `key1,key2` (comma-separated, no spaces)
   - **Environments:** Production, Preview, Development
4. Click **Deploy**.

### 3. Adding / rotating keys

To add or replace keys, edit the `GEMINI_API_KEYS` env var in
**Vercel → Project → Settings → Environment Variables** and redeploy
(Vercel → Deployments → ⋯ → Redeploy). No code change needed.

## Limits to know

- **Vercel request body cap is 4.5 MB.** PDF reference uploads are sent as
  base64 inline data, so keep the combined PDF payload under that limit.
- **Function timeout: 60 s** (set in `vercel.json`). Question generation
  with large PDFs may push against this on the Hobby plan.

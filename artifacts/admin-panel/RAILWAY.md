# Deploy Admin Panel ke Railway

Panduan pendek untuk hosting `@workspace/admin-panel` di Railway (gantikan Replit).

## 1. Push repo ke GitHub
Pastikan folder `Telegram-Commerce-Bot` ada di GitHub repo anda.

## 2. Buat service baru di Railway
1. Buka https://railway.app → **New Project** → **Deploy from GitHub repo**.
2. Pilih repo anda.
3. Selepas project dibuat, masuk **Settings** untuk service tersebut.

## 3. Tetapkan Root Directory
- **Settings → Service → Root Directory** = `artifacts/admin-panel`
- Railway akan auto-detect `nixpacks.toml` & `railway.toml` dalam folder ini.

> **PENTING:** Railway clone seluruh repo walaupun Root Directory set ke subfolder.
> `nixpacks.toml` akan `cd ../..` ke repo root untuk `pnpm install` supaya
> workspace dependency (`@workspace/api-client-react`) dapat di-resolve.
> Build output tetap masuk `artifacts/admin-panel/dist/public`.

## 4. Environment Variables
Tambah dalam **Variables**:

| Key | Value | Catatan |
|---|---|---|
| `PORT` | (Railway auto-set) | Jangan override |
| `BASE_PATH` | `/` | Default sudah `/` |
| `NODE_ENV` | `production` | |
| `API_PROXY_TARGET` | URL API server anda | Hanya untuk dev mode |

## 5. Build & Start
Sudah dikonfigurasi automatik:
- **Build**: `cd ../.. && pnpm --filter @workspace/admin-panel run build` (dari repo root)
- **Start**: `node server.mjs`

`server.mjs` ialah static file server (zero-dependency) yang serve `dist/public` dengan SPA fallback ke `index.html`.

## 6. Custom Domain (optional)
**Settings → Networking → Generate Domain** atau tambah custom domain anda sendiri.

## Apa yang berubah
- `vite.config.ts` — Replit plugin (`cartographer`, `dev-banner`, `runtime-error-modal`) dijadikan optional (load hanya bila `REPL_ID` ada). Railway build takkan crash sebab dia.
- `package.json` — `build` tak lagi force `PORT=3000 BASE_PATH=/`. Tambah script `start` untuk production.
- `server.mjs` — static server baru untuk production.
- `railway.toml` + `nixpacks.toml` — config Railway untuk admin-panel.

## Lokal dev (masih boleh pakai Replit kalau nak)
```bash
pnpm install
pnpm --filter @workspace/admin-panel run dev
```

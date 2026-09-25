This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Environment

All variables are listed in `.env.example`. Env files other than that template are gitignored.

| File | Used when | Where |
| --- | --- | --- |
| `.env.local` | `npm run dev` | your machine |
| `.env.production.local` | `npm run build` / `npm run start` | prod server |

Next.js load order in production is `.env.production.local` > `.env.local` > `.env.production` > `.env`, so keep **only** `.env.production.local` on the server — a stray `.env.local` there would override prod values.

`NEXT_PUBLIC_*` values are baked into the client bundle at build time; the rest (`FRAPPE_*`, `SESSION_SECRET`) are read at runtime.

## Deploy (own server)

```bash
# first time
git clone <repo> ayc-webapp && cd ayc-webapp

# copy prod secrets from your machine (never commit them)
scp .env.prod user@server:~/ayc-webapp/.env.production.local
ssh user@server 'chmod 600 ~/ayc-webapp/.env.production.local'

# build + run
npm ci
npm run build
pm2 start npm --name ayc -- start   # serves on :3000; put nginx + HTTPS in front
```

### Serving under `/aycapp`

Prod runs at `https://<domain>/aycapp`, dev at `http://localhost:3000/`. Set `NEXT_PUBLIC_BASE_PATH=/aycapp` in the server's `.env.production.local` (leave it unset locally) and rebuild — it feeds `basePath` in `next.config.mjs`. In code, wrap raw `fetch("/api/...")` URLs and plain asset paths with `withBase()` from `lib/paths.js`; `<Link>`, `router` and `redirect()` are prefixed by Next automatically.

nginx:

```nginx
location /aycapp {
    proxy_pass http://127.0.0.1:3000;   # no trailing slash — keeps the /aycapp prefix
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Updating: `git pull && npm ci && npm run build && pm2 restart ayc`.
Changed an env value? Edit `.env.production.local` on the server, then rebuild if a `NEXT_PUBLIC_*` value changed, otherwise just `pm2 restart ayc`.

Prod checklist:
- `SESSION_SECRET` differs from dev.
- `FRAPPE_BASE_URL` uses `https://`.
- Prod domain added in Firebase console → Authentication → Settings → Authorized domains.
- The session cookie gets `Secure` automatically when `NODE_ENV=production` (`lib/session.js`).

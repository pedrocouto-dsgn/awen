# Awen

A private, single-user creative reference bank for images and video, with AI-assisted tagging.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres + Auth) · Cloudflare R2 · Gemini API · Vercel.

> Setup instructions are filled in milestone by milestone. See the sections below.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Scripts: `npm run typecheck`, `npm run lint`, `npm run build`.

## Environment variables

See `.env.example`. Anything without the `NEXT_PUBLIC_` prefix is server-only and never reaches the browser.

# Frontend

The VOLTEX public website and administration interface, built with Next.js App Router, React, TypeScript, and Tailwind CSS. Its npm workspace name is `@voltex/web`.

## Source layout

```text
frontend/
├── src/app/(site)/       # Public pages, catalogue, and enquiry forms
├── src/app/admin/        # Sign-in and administration pages
├── src/components/      # Page sections, layout, forms, and UI components
├── src/lib/             # API clients, site content, and browser utilities
├── src/proxy.ts          # Initial admin navigation/session-cookie check
├── public/              # Branding and static images
├── next.config.ts       # Rewrites, security headers, images, and build tracing
└── .env.example         # Frontend environment template
```

Shared product types, pricing, and validation come from `packages/shared/`. Database access and authorization belong to the backend.

## Develop

Install and set up the repository from its root as described in [the main README](../README.md), then run:

```powershell
cd D:\Voltex-Main-Site
npm run dev:frontend
```

The frontend serves [http://localhost:3000](http://localhost:3000). Run the API separately with `npm run dev:backend`, or use `npm run dev` to start both. Root commands build the shared package before starting dependent applications.

## Environment

`npm run setup` creates `.env.local` from `.env.example` when it is missing. Existing values are preserved.

| Variable | Purpose | Local default |
| --- | --- | --- |
| `API_INTERNAL_URL` | Backend address for server requests and `/api` rewrites | `http://localhost:4000` |
| `NEXT_PUBLIC_SITE_URL` | Public URL for canonical links, sitemap, and social metadata | `http://localhost:3000` |

Browser clients call the site's own `/api` routes. Next.js forwards those requests to the configured backend. Never put server credentials in `NEXT_PUBLIC_*` variables; public variables are included in browser build output. Set production values before building.

## Build and validation

From the repository root:

```text
npm run build:frontend
npm run start:frontend
npm run typecheck
```

The build generates a standalone artifact and automatically copies `public/` and `.next/static/` into it through the repository's preparation helper. `start:frontend` runs the prepared server at `frontend/.next/standalone/frontend/server.js` and loads `frontend/.env.local` when present. See [production operations](../deploy/README.md) for artifact deployment and runtime settings.

The frontend's admin proxy performs an initial cookie-presence check. Protected API endpoints verify the signed session and enforce access independently; UI visibility is not an authorization mechanism.

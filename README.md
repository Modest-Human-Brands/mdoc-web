# MDoc Web

Vue 3 + TypeScript + Tailwind CSS v4 web app for creating documents from templates through the MDoc API (the "New document" wizard: Template → Brand → Details → Send).

## Getting started

```bash
bun install
cp .env.example .env.local   # optional, defaults work with the dev proxy
bun run dev                  # http://localhost:5173, proxies /api -> http://localhost:3002
```

Run the MDoc API (Nitro/H3) on port 3002 first, or set `VITE_API_PROXY_TARGET`.

## Scripts

| Script              | What it does                     |
| ------------------- | -------------------------------- |
| `bun run dev`       | Vite+ dev server                 |
| `bun run build`     | Production build into `dist/`    |
| `bun run lint`      | oxlint (type-aware) with autofix |
| `bun run format`    | oxfmt on `src/`                  |
| `bun run test:unit` | vitest (jsdom)                   |

## Configuration

| Variable                | Purpose                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`     | API origin. Empty uses same-origin `/api` (dev proxy). Set it at build time for production, also as the `API_BASE_URL` repo variable and the Docker build arg of the same name. |
| `VITE_API_PROXY_TARGET` | Dev only: target of the `/api` proxy.                                                                                                                                           |

## API contract

The API is described by the Postman collection in `postman/collections/MDoc RESTful API/`. Its example responses are used as test fixtures.

## Deployment

Docker image (nginx, SPA fallback) built by `.github/workflows/deploy.yml` on GitHub release. Requires the repo variables `USERNAME`, `SITE_URL`, `API_BASE_URL` and the secret `GH_PAT`. `gitleaks` is used by the pre-commit hook.

## License

Published under the [MIT](LICENSE) license.
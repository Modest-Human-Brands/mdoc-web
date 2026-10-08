# MDoc Web

Vue 3 + TypeScript + Tailwind CSS v4 web app for creating documents from templates through the MDoc API (the "New document" wizard: Template → Brand → Details → Review & download).

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

| Variable                                                            | Purpose                                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_PUBLIC_SITE_URL`                                              | Public URL of this app. Docker build arg `SITE_URL`.                                                                            |
| `VITE_MDOC_API_URL`                                                 | MDoc API origin. In development it is the target of the `/api` proxy; in production it is the API origin (build arg `API_URL`). |
| `VITE_DEFAULT_ORGANIZATION_ID`                                      | Organisation preset id (optional).                                                                                              |
| `VITE_MDOC_USER_ID`, `VITE_MDOC_CONTACT_ID`, `VITE_MDOC_PROJECT_ID` | Notion ids. Only read in development; in Docker pass them when the container starts.                                            |

Copy `.env.example` to `.env` (git-ignored) and fill it in.

## API contract

The API is described by the Postman collection in `postman/collections/MDoc RESTful API/`. Its example responses are used as test fixtures.

## AI / WebMCP

The wizard can be operated by AI agents. `src/mcp/` registers tools with **WebMCP** (`navigator.modelContext.registerTool`, Chrome 149 origin trial) and always publishes the same tools on `window.__mdocTools` (`list()` and `call(name, args)`) for agents that drive the page by script.

| Tool                                                      | What it does                                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `get_wizard_state`, `validate_form`, `get_preview_status` | Where the wizard is, what is still missing, the live preview status                                                  |
| `list_templates`, `get_template_schema`                   | Templates and their JSON Schema (fields, enums, required)                                                            |
| `select_template`, `go_to_step`                           | Choose a template, move between steps (router guards still apply)                                                    |
| `set_fields`, `add_row`, `remove_row`                     | Fill the form with dotted paths such as `project.deliverables.0.rate` (all-or-nothing, validated against the schema) |
| `set_organization`, `set_owner_ids`                       | Organisation id, Notion ids                                                                                          |
| `create_document`                                         | Creates the PDF and saves it to Notion. **Asks the human to confirm first.**                                         |
| `get_form_values`, `reset_wizard`                         | Inspect and reset                                                                                                    |

Try it: open the app, then in the console run `await __mdocTools.call('select_template', { templateId: 'invoice' })`. With Chrome's WebMCP enabled, the tools also show in the DevTools WebMCP tab.

Tools are same-origin only, never expose secrets, and reuse the store and API client, so the UI and agents always see the same state.

## Deployment

Docker image (nginx, SPA fallback) built by `.github/workflows/deploy.yml` on GitHub release. Requires the repo variables `USERNAME`, `SITE_URL`, `API_URL` and the secret `GH_PAT`. `gitleaks` is used by the pre-commit hook.

## Docker

```bash
bun run docker:build   # builds mdoc-web:dev
bun run docker:start   # runs it with --env-file .env on http://localhost:2000
```

Per-environment settings are **runtime** variables, not build arguments: when the container starts, `docker/runtime-config.sh` writes `/config.js` from `VITE_MDOC_USER_ID`, `VITE_MDOC_CONTACT_ID`, `VITE_MDOC_PROJECT_ID`, `VITE_DEFAULT_ORGANIZATION_ID` and `VITE_MDOC_API_URL`. Put them in `.env` (git-ignored; see `.env.example`) or pass `-e`. The image itself never contains them.

## License

Published under the [MIT](LICENSE) license.
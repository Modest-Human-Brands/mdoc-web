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

| Variable                | Purpose                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`     | API origin. Empty uses same-origin `/api` (dev proxy). Set it at build time for production, also as the `API_BASE_URL` repo variable and the Docker build arg of the same name. |
| `VITE_API_PROXY_TARGET` | Dev only: target of the `/api` proxy.                                                                                                                                           |

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

Docker image (nginx, SPA fallback) built by `.github/workflows/deploy.yml` on GitHub release. Requires the repo variables `USERNAME`, `SITE_URL`, `API_BASE_URL` and the secret `GH_PAT`. `gitleaks` is used by the pre-commit hook.

## Docker

```bash
bun run docker:build   # builds mdoc-web:dev
bun run docker:start   # runs it with --env-file .env.prod on http://localhost:2000
```

Per-environment settings are **runtime** variables, not build arguments: when the container starts, `docker/runtime-config.sh` writes `/config.js` from `MDOC_USER_ID`, `MDOC_CONTACT_ID`, `MDOC_PROJECT_ID`, `MDOC_ORGANIZATION_ID` and `MDOC_API_BASE_URL`. Put them in `.env.prod` (git-ignored; see `.env.example`) or pass `-e`. The image itself never contains them.

## License

Published under the [MIT](LICENSE) license.
#!/bin/sh
# Runs at container start (the nginx image executes /docker-entrypoint.d/*.sh) and writes
# /usr/share/nginx/html/config.js from the container's environment, so the same image works in every
# environment and values such as the Notion user id are never baked into the image or the repo.
#
#   docker run --env-file .env -p 2000:8080 mdoc-web
#
# Variables (all optional): VITE_MDOC_USER_ID, VITE_MDOC_CONTACT_ID, VITE_MDOC_PROJECT_ID, VITE_DEFAULT_ORGANIZATION_ID,
# VITE_MDOC_API_URL.
set -eu

TARGET="${MDOC_CONFIG_PATH:-/usr/share/nginx/html/config.js}"

# Makes a value safe inside a double-quoted JS string: drops line breaks, escapes backslashes and
# quotes, and breaks up "<" so a value can never close a surrounding <script> tag.
js_string() {
  printf '%s' "$1" | tr -d '\r\n' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g'
}

cat > "$TARGET" <<EOF
// Generated at container start by docker/runtime-config.sh. Do not edit.
window.__MDOC_CONFIG__ = {
  apiBaseUrl: "$(js_string "${VITE_MDOC_API_URL:-}")",
  siteUrl: "$(js_string "${VITE_PUBLIC_SITE_URL:-}")",
  organizationId: "$(js_string "${VITE_DEFAULT_ORGANIZATION_ID:-}")",
  userId: "$(js_string "${VITE_MDOC_USER_ID:-}")",
  contactId: "$(js_string "${VITE_MDOC_CONTACT_ID:-}")",
  projectId: "$(js_string "${VITE_MDOC_PROJECT_ID:-}")",
}
EOF

echo "runtime-config: wrote $TARGET"

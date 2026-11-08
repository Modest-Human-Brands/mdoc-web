#!/bin/sh
set -eu

TARGET="${MDOC_CONFIG_PATH:-/usr/share/nginx/html/config.js}"

js_string() {
  printf '%s' "$1" | tr -d '\r\n' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g'
}

cat > "$TARGET" <<EOF
window.__MDOC_CONFIG__ = {
  apiBaseUrl: "$(js_string "${VITE_MDOC_WEB_API_URL:-}")",
  siteUrl: "$(js_string "${VITE_MDOC_WEB_SITE_URL:-}")",
  organizationId: "$(js_string "${ORGANIZATION_ID:-}")",
  userId: "$(js_string "${VITE_MDOC_WEB_USER_ID:-}")",
  contactId: "$(js_string "${VITE_MDOC_WEB_CONTACT_ID:-}")",
  projectId: "$(js_string "${VITE_MDOC_WEB_PROJECT_ID:-}")",
  apiKey: "$(js_string "${VITE_MDOC_WEB_API_KEY:-}")",
}
EOF

echo "runtime-config: wrote $TARGET"

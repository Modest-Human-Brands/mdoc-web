#!/bin/sh
set -eu

TARGET="${MDOC_CONFIG_PATH:-/usr/share/nginx/html/config.js}"

js_string() {
  printf '%s' "$1" | tr -d '\r\n' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g'
}

cat > "$TARGET" <<EOF
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

#!/bin/sh
set -e

HTML_DIR="/usr/share/nginx/html"
ASSETS_DIR="$HTML_DIR/assets"
CONFIG_FILE="$ASSETS_DIR/config.json"
TEMPLATE_FILE="$ASSETS_DIR/config.template.json"

mkdir -p "$ASSETS_DIR"

echo "[entrypoint] Building runtime config..."

API_URL_CLEAN=$(echo "${API_URL}" \
  | tr -d ';' \
  | sed -E 's/^"(.*)"$/\1/' \
  | sed -E "s/^'(.*)'$/\1/")

if [ -z "$API_URL_CLEAN" ]; then
  API_URL_CLEAN="/api"
fi

export API_URL="$API_URL_CLEAN"

if [ -f "$TEMPLATE_FILE" ]; then
  envsubst \
    '${API_URL} ${COLOR_BG} ${COLOR_SURFACE} ${COLOR_BORDER} ${COLOR_TEXT} ${COLOR_TEXT_MUTED} ${COLOR_PRIMARY} ${COLOR_PRIMARY_FG} ${COLOR_SUCCESS} ${COLOR_SUCCESS_FG} ${COLOR_DANGER} ${COLOR_DANGER_FG}' \
    < "$TEMPLATE_FILE" \
    > "$CONFIG_FILE"
else
  cat > "$CONFIG_FILE" << EOL
{
  "API_URL": "${API_URL_CLEAN}",
  "THEME": {
    "COLOR_BG": "${COLOR_BG}",
    "COLOR_SURFACE": "${COLOR_SURFACE}",
    "COLOR_BORDER": "${COLOR_BORDER}",
    "COLOR_TEXT": "${COLOR_TEXT}",
    "COLOR_TEXT_MUTED": "${COLOR_TEXT_MUTED}",
    "COLOR_PRIMARY": "${COLOR_PRIMARY}",
    "COLOR_PRIMARY_FG": "${COLOR_PRIMARY_FG}",
    "COLOR_SUCCESS": "${COLOR_SUCCESS}",
    "COLOR_SUCCESS_FG": "${COLOR_SUCCESS_FG}",
    "COLOR_DANGER": "${COLOR_DANGER}",
    "COLOR_DANGER_FG": "${COLOR_DANGER_FG}"
  }
}
EOL
fi

chmod 644 "$CONFIG_FILE"

NGINX_TEMPLATE="/etc/nginx/templates/default.conf.template"
NGINX_CONF="/etc/nginx/conf.d/default.conf"
TMP_CONF="/etc/nginx/conf.d/default.conf.tmp"

if [ -z "$BACKEND_UPSTREAM" ] && [ -n "$API_URL_CLEAN" ]; then
  BACKEND_UPSTREAM=$(echo "$API_URL_CLEAN" | sed -E 's#(^https?://[^/]+).*$#\1#')
fi

if [ -n "$BACKEND_UPSTREAM" ]; then
  BACKEND_UPSTREAM_CLEAN=$(echo "$BACKEND_UPSTREAM" \
    | sed -E 's/^"(.*)"$/\1/' \
    | sed -E "s/^'(.*)'$/\1/")
  export BACKEND_UPSTREAM="$BACKEND_UPSTREAM_CLEAN"

  BACKEND_UPSTREAM_HOST=$(echo "$BACKEND_UPSTREAM" \
    | sed -E 's#^https?://([^/:]+)(:[0-9]+)?/?#\1#')
  export BACKEND_UPSTREAM_HOST
fi

if [ -n "$BACKEND_UPSTREAM" ] && [ -f "$NGINX_TEMPLATE" ]; then
  envsubst '${BACKEND_UPSTREAM} ${BACKEND_UPSTREAM_HOST}' < "$NGINX_TEMPLATE" > "$TMP_CONF" && mv "$TMP_CONF" "$NGINX_CONF"
fi

exec nginx -g 'daemon off;'

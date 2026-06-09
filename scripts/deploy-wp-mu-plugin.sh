#!/usr/bin/env bash
# Deploys the kghub-featured-image mu-plugin to the WordPress server.
# Run from project root: bash scripts/deploy-wp-mu-plugin.sh

set -e

source "$(dirname "$0")/../.env.server"

# Path to wp-content/mu-plugins on the WP server.
# Adjust WP_PATH if the WordPress install is in a different location.
WP_PATH="${WP_PATH:-/home/kghubweb/public_html/insights.kghub.ca}"
MU_PLUGINS_DIR="${WP_PATH}/wp-content/mu-plugins"
PLUGIN_FILE="wordpress/mu-plugins/kghub-featured-image.php"

echo "Deploying mu-plugin to ${DEPLOY_USER}@${SERVER_IP}:${MU_PLUGINS_DIR} ..."

# Create mu-plugins dir if it doesn't exist
sshpass -p "$DEPLOY_PASSWORD" ssh -p "$SERVER_SSH_PORT" "$DEPLOY_USER@$SERVER_IP" \
  "mkdir -p ${MU_PLUGINS_DIR}"

# Copy the plugin file
sshpass -p "$DEPLOY_PASSWORD" scp \
  -P "$SERVER_SSH_PORT" \
  "$PLUGIN_FILE" \
  "${DEPLOY_USER}@${SERVER_IP}:${MU_PLUGINS_DIR}/kghub-featured-image.php"

echo "Plugin deployed. Now add the secret to wp-config.php ..."

# Add KGHUB_WP_SECRET to wp-config.php (idempotent — skips if already present)
source "$(dirname "$0")/../.env"
SECRET="${WP_KGHUB_SECRET}"

sshpass -p "$DEPLOY_PASSWORD" ssh -p "$SERVER_SSH_PORT" "$DEPLOY_USER@$SERVER_IP" "
  WP_CONFIG='${WP_PATH}/wp-config.php'
  if grep -q 'KGHUB_WP_SECRET' \"\$WP_CONFIG\"; then
    echo 'Secret already present in wp-config.php — skipping.'
  else
    sed -i \"/^\\/\\* That's all/i define('KGHUB_WP_SECRET', '${SECRET}');\" \"\$WP_CONFIG\"
    echo 'Secret injected into wp-config.php.'
  fi
"

echo ""
echo "Done. Test with:"
echo "  curl -s -X POST https://insights.kghub.ca/wp-json/kghub/v1/set-featured-image \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'X-Kghub-Secret: ${SECRET}' \\"
echo "    -d '{\"post_id\": 2314, \"image_url\": \"https://kghub.tor1.digitaloceanspaces.com/articles/9fd41f1c-7952-4be7-a371-560f06a249cb/hero-featured-1780965347927.png\", \"title\": \"Test\"}'"

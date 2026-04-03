#!/usr/bin/env bash
set -euo pipefail

APP_NAME="umbra"
WEBROOT="/var/www/${APP_NAME}"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${APP_NAME}"

green()  { printf "\033[0;32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[0;33m%s\033[0m\n" "$*"; }
red()    { printf "\033[0;31m%s\033[0m\n" "$*"; }
step()   { echo; green "── $*"; }
die()    { red "error: $*"; exit 1; }

if [[ $EUID -ne 0 ]]; then
  die "run as root: sudo bash deploy.sh"
fi

# ── gather config ──────────────────────────────────────────────────────────────

if [[ -f /etc/umbra-deploy.env ]]; then
  source /etc/umbra-deploy.env
  yellow "loaded existing config from /etc/umbra-deploy.env"
  yellow "  NAVIDROME_URL = ${NAVIDROME_URL}"
  yellow "  SERVER_NAME   = ${SERVER_NAME}"
  echo
  read -rp "re-use this config? [Y/n] " reuse
  reuse="${reuse:-Y}"
  if [[ ! "$reuse" =~ ^[Yy]$ ]]; then
    unset NAVIDROME_URL SERVER_NAME
  fi
fi

if [[ -z "${NAVIDROME_URL:-}" ]]; then
  read -rp "Navidrome URL (e.g. http://localhost:4533): " NAVIDROME_URL
  [[ -z "$NAVIDROME_URL" ]] && die "Navidrome URL is required"
fi

if [[ -z "${SERVER_NAME:-}" ]]; then
  default_ip=$(hostname -I | awk '{print $1}')
  read -rp "Server domain or IP [${default_ip}]: " SERVER_NAME
  SERVER_NAME="${SERVER_NAME:-$default_ip}"
fi

cat > /etc/umbra-deploy.env <<EOF
NAVIDROME_URL=${NAVIDROME_URL}
SERVER_NAME=${SERVER_NAME}
EOF

# ── node.js ────────────────────────────────────────────────────────────────────

step "checking Node.js"

if ! command -v node &>/dev/null; then
  yellow "Node.js not found — installing via NodeSource (LTS)"
  apt-get update -qq
  apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
fi

node_ver=$(node --version)
green "node ${node_ver}"

# ── build ──────────────────────────────────────────────────────────────────────

step "installing dependencies"
npm ci --prefer-offline

step "building"
npm run build

green "build complete → dist/"

# ── nginx ──────────────────────────────────────────────────────────────────────

step "setting up nginx"

if ! command -v nginx &>/dev/null; then
  yellow "installing nginx"
  apt-get update -qq
  apt-get install -y nginx
fi

mkdir -p "$WEBROOT"
cp -a dist/. "$WEBROOT/"
chown -R www-data:www-data "$WEBROOT"
chmod -R 755 "$WEBROOT"

cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${WEBROOT};
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 1024;

    location /rest/ {
        proxy_pass ${NAVIDROME_URL};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 120s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|woff2?|ttf|svg|ico|png|jpg|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
NGINX

if [[ ! -L "$NGINX_ENABLED" ]]; then
  ln -s "$NGINX_CONF" "$NGINX_ENABLED"
fi

if [[ -f /etc/nginx/sites-enabled/default ]]; then
  rm /etc/nginx/sites-enabled/default
  yellow "removed default nginx site"
fi

nginx -t
systemctl enable nginx
systemctl reload nginx

# ── firewall (ufw) ─────────────────────────────────────────────────────────────

if command -v ufw &>/dev/null; then
  step "opening port 80 in ufw"
  ufw allow "Nginx HTTP" &>/dev/null || ufw allow 80/tcp
fi

# ── done ───────────────────────────────────────────────────────────────────────

echo
green "────────────────────────────────────────"
green "  Umbra is live at http://${SERVER_NAME}"
green "────────────────────────────────────────"
echo
yellow "to update later: sudo bash deploy.sh"
yellow "nginx logs:       sudo tail -f /var/log/nginx/error.log"

#!/usr/bin/env bash
# TanzRaum auf einem eigenen Linux-Server (z. B. IONOS VPS, Ubuntu 22.04/24.04) installieren ODER aktualisieren.
#
# Aufruf im entpackten Paket-Ordner (als root):
#     bash installieren.sh
#
# Erstinstallation: Node.js 22, nginx, HTTPS (Let's Encrypt), Firewall, Dienst "tanzraum".
# Erneuter Aufruf mit einem neuen Paket: nur die App-Dateien werden ersetzt und die App neu gestartet.
# Die Datei /opt/tanzraum/.env bleibt dabei erhalten.

set -euo pipefail

DOMAIN="tanzraum.app"
APP_DIR="/opt/tanzraum"
PORT="3000"
QUELLE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then echo "Bitte als root ausführen (sudo bash installieren.sh)."; exit 1; fi
if [ ! -f "$QUELLE/server.js" ]; then echo "server.js fehlt – bitte im entpackten TanzRaum-Paket ausführen."; exit 1; fi

schritt() { echo; echo "==> $*"; }

# ---------- Grundpakete ----------
if ! command -v nginx >/dev/null || ! command -v certbot >/dev/null; then
  schritt "Systempakete installieren (nginx, certbot, Firewall)"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y nginx certbot python3-certbot-nginx ufw rsync curl ca-certificates
fi

# ---------- Node.js 22 ----------
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  schritt "Node.js 22 installieren"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# ---------- Auslagerungsspeicher (kleine Server mit 1 GB RAM) ----------
if [ ! -f /swapfile ] && [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 2000 ]; then
  schritt "1 GB Auslagerungsspeicher anlegen"
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

# ---------- Benutzer und Dateien ----------
id tanzraum >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin tanzraum
mkdir -p "$APP_DIR"
schritt "App-Dateien nach $APP_DIR kopieren"
# .env auf dem Server bleibt erhalten; installieren.sh/LIESMICH werden nicht mitkopiert
rsync -a --delete --exclude ".env" --exclude "installieren.sh" "$QUELLE"/ "$APP_DIR"/
if [ ! -f "$APP_DIR/.env" ]; then cp "$QUELLE/.env" "$APP_DIR/.env"; fi
chown -R tanzraum:tanzraum "$APP_DIR"
chmod 640 "$APP_DIR/.env"

# ---------- Dienst (startet automatisch, auch nach Neustart/Absturz) ----------
cat > /etc/systemd/system/tanzraum.service <<EOF
[Unit]
Description=TanzRaum (Next.js)
After=network.target

[Service]
Type=simple
User=tanzraum
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable tanzraum >/dev/null
schritt "App (neu) starten"
systemctl restart tanzraum

# ---------- nginx (nur beim ersten Mal) ----------
if [ ! -f /etc/nginx/sites-available/tanzraum ]; then
  schritt "nginx einrichten"
  cat > /etc/nginx/sites-available/tanzraum <<EOF
# Unbekannte Hostnamen abweisen
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/tanzraum /etc/nginx/sites-enabled/tanzraum
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
fi

# ---------- Firewall ----------
if ! ufw status | grep -q "Status: active"; then
  schritt "Firewall aktivieren (SSH, HTTP, HTTPS)"
  ufw allow OpenSSH >/dev/null
  ufw allow "Nginx Full" >/dev/null
  ufw --force enable
fi

# ---------- HTTPS ----------
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  EIGENE_IPS="$(hostname -I)"
  DNS_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')"
  if [ -n "$DNS_IP" ] && echo " $EIGENE_IPS " | grep -q " $DNS_IP "; then
    schritt "HTTPS-Zertifikat holen (Let's Encrypt)"
    read -r -p "E-Mail-Adresse für Zertifikats-Hinweise: " MAIL
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect --agree-tos -m "$MAIL" -n
  else
    echo
    echo "!!  $DOMAIN zeigt noch nicht auf diesen Server (DNS: ${DNS_IP:-keine Antwort}, Server: $EIGENE_IPS)."
    echo "    Stelle bei IONOS die DNS-Einträge um, warte bis sie wirken, und rufe dann dieses Skript erneut auf –"
    echo "    es holt dann das HTTPS-Zertifikat."
  fi
fi

sleep 2
if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/login"; then
  echo; echo "Fertig: TanzRaum läuft. Status: systemctl status tanzraum · Protokoll: journalctl -u tanzraum -f"
else
  echo; echo "Die App antwortet noch nicht. Protokoll ansehen: journalctl -u tanzraum -n 50"
  exit 1
fi

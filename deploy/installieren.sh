#!/usr/bin/env bash
# TanzRaum auf einem eigenen Linux-Server (z. B. netcup VPS, Debian 12/13 oder Ubuntu 22.04/24.04) installieren ODER aktualisieren.
#
# Aufruf im entpackten Paket-Ordner (als root):
#     bash installieren.sh
#
# Erstinstallation: Node.js 22, nginx, HTTPS (Let's Encrypt), Firewall, Dienst "tanzraum".
# Erneuter Aufruf mit einem neuen Paket: die App-Dateien werden ersetzt und die App neu gestartet; die nginx-Puffer\n# fuer Anmelde-Cookies werden bei Bedarf ergaenzt (conf.d/tanzraum-proxy-puffer.conf).
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

# ---------- nginx: Puffer fuer Antwort-Header (bei jedem Aufruf) ----------
# Anmelden und Passwort-Zuruecksetzen antworten mit dem Supabase-Sitzungs-Cookie (je nach Konto 3-4 KB, von Supabase
# in mehrere Cookies aufgeteilt). Mit dem nginx-Standard (proxy_buffer_size = 4 KB) passen diese Antwort-Header
# nicht in den Puffer: nginx meldet "upstream sent too big header" und liefert 502 statt der Antwort -> im Browser
# "Application error", das Cookie kommt nie an, der Link aus der E-Mail ist aber bereits verbraucht.
# Eigene Datei in conf.d (http-Ebene), damit die von certbot angepasste Site-Konfiguration unberuehrt bleibt.
PUFFER_CONF=/etc/nginx/conf.d/tanzraum-proxy-puffer.conf
PUFFER_INHALT='# TanzRaum: Platz fuer grosse Antwort-Header (Supabase-Sitzungs-Cookies). Verwaltet von installieren.sh.
proxy_buffer_size 16k;
proxy_buffers 8 16k;
proxy_busy_buffers_size 32k;'
if [ "$(cat "$PUFFER_CONF" 2>/dev/null)" != "$PUFFER_INHALT" ]; then
  schritt "nginx: Puffer fuer Anmelde-Cookies einrichten"
  printf '%s\n' "$PUFFER_INHALT" > "$PUFFER_CONF"
  if nginx -t 2>/tmp/tanzraum-nginx-test.txt; then
    systemctl reload nginx
  else
    rm -f "$PUFFER_CONF"
    echo "!!  nginx lehnt $PUFFER_CONF ab – Datei wieder entfernt. Meldung von nginx -t:"
    sed 's/^/      /' /tmp/tanzraum-nginx-test.txt
    if ! nginx -t 2>/dev/null; then
      echo "    Die nginx-Konfiguration ist auch ohne diese Datei fehlerhaft (siehe Meldung oben)."
    else
      echo "    Vermutlich ist proxy_buffer_size schon an anderer Stelle gesetzt (siehe Meldung oben)."
    fi
  fi
fi
# Aktiv, wenn irgendwo ein ausreichend grosser Puffer (mind. 8 KB) gesetzt ist – auch ausserhalb dieser Datei
if nginx -T 2>/dev/null | awk '$1 == "proxy_buffer_size" { v = $2; sub(";", "", v); n = v + 0; if (v ~ /[kK]$/) n *= 1024; if (v ~ /[mM]$/) n *= 1048576; if (n >= 8192) ok = 1 } END { exit !ok }'; then
  echo "    nginx-Puffer fuer Anmelde-Cookies: aktiv"
else
  echo "!!  nginx-Puffer fuer Anmelde-Cookies: NICHT aktiv – Anmelden/Passwort-Reset koennen mit 502 scheitern."
fi
# Google Maps: nur pruefen, ob die Schluessel eingetragen sind (Werte werden nie ausgegeben)
for SCHLUESSEL in GOOGLE_MAPS_BROWSER_KEY GOOGLE_MAPS_SERVER_KEY; do
  if grep -Eq "^${SCHLUESSEL}=.+" "$APP_DIR/.env"; then
    echo "    ${SCHLUESSEL}: eingetragen"
  else
    echo "!!  ${SCHLUESSEL}: fehlt in $APP_DIR/.env – Google-Karte bzw. Ortssuche sind bis dahin aus (siehe LIESMICH)."
  fi
done

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

# ---------- Pruefen: laeuft wirklich die neue Version? ----------
# Die Seite enthaelt die Build-Kennung. Antwortet auf dem Port ein anderer (alter) Prozess, passen Seiten und
# Server nicht zusammen ("Failed to find Server Action", "Application error").
BUILD_ID="$(cat "$APP_DIR/.next/BUILD_ID")"
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/login" 2>/dev/null | grep -q "$BUILD_ID"; then
    echo; echo "Fertig: TanzRaum läuft (Version $BUILD_ID). Status: systemctl status tanzraum · Protokoll: journalctl -u tanzraum -f"
    exit 0
  fi
  sleep 1
done
echo
if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/login" 2>/dev/null; then
  echo "!!  Auf Port $PORT antwortet NICHT die gerade installierte Version ($BUILD_ID)."
  echo "    Vermutlich läuft dort noch ein anderer, alter Prozess. Belegt wird der Port von:"
  ss -ltnp "sport = :$PORT" 2>/dev/null | sed 's/^/      /' || true
  echo "    Status des Dienstes: systemctl status tanzraum"
else
  echo "Die App antwortet noch nicht. Protokoll ansehen: journalctl -u tanzraum -n 50"
fi
exit 1

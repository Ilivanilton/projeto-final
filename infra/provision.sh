#!/usr/bin/env bash
# Provisionamento do servidor (Debian 13) - executar como root: sudo bash provision.sh <IP_PUBLICO>
# Pré-requisito: a pasta infra/ copiada para /tmp/infra e a chave pública de deploy em /tmp/infra/deploy.pub
set -euo pipefail

PUBLIC_IP="${1:?informe o IP público}"
INFRA=/tmp/infra
export DEBIAN_FRONTEND=noninteractive

echo "==> 1. Atualizando o sistema e instalando pacotes"
apt-get update -q
apt-get -y -q upgrade
apt-get -y -q install nginx nodejs npm fail2ban python3-systemd ufw unattended-upgrades snapd rsync curl

echo "==> 2. Atualizações automáticas de segurança"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> 3. Firewall do sistema (UFW): somente 22, 80 e 443"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> 4. Usuários: 'deploy' (GitHub Actions) e 'app' (executa a aplicação, sem shell)"
id app &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin app
id deploy &>/dev/null || useradd --create-home --shell /bin/bash deploy
passwd -l deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
install -m 600 -o deploy -g deploy "$INFRA/deploy.pub" /home/deploy/.ssh/authorized_keys
install -m 440 "$INFRA/sudoers/deploy" /etc/sudoers.d/deploy
visudo -cf /etc/sudoers.d/deploy

echo "==> 5. Diretórios da aplicação e arquivo de ambiente"
install -d -m 2750 -o deploy -g app /opt/projeto-final
install -d -m 750 /etc/projeto-final
install -m 644 "$INFRA/systemd/projeto-final.service" /etc/systemd/system/projeto-final.service
systemctl daemon-reload
systemctl enable projeto-final

echo "==> 6. SSH somente por chave"
install -m 644 "$INFRA/ssh/99-hardening.conf" /etc/ssh/sshd_config.d/99-hardening.conf
sshd -t
systemctl reload ssh

echo "==> 7. Fail2Ban: 4 erros => 24h de banimento"
install -m 644 "$INFRA/fail2ban/jail.local" /etc/fail2ban/jail.local
systemctl enable fail2ban
systemctl restart fail2ban

echo "==> 8. Nginx (etapa HTTP para o desafio ACME)"
install -d -m 755 /var/www/letsencrypt
rm -f /etc/nginx/sites-enabled/default
install -m 644 "$INFRA/nginx/projeto-final-http.conf" /etc/nginx/sites-available/projeto-final
ln -sf /etc/nginx/sites-available/projeto-final /etc/nginx/sites-enabled/projeto-final
nginx -t
systemctl reload nginx

echo "==> 9. Certbot (snap) e certificado Let's Encrypt para o IP"
snap install core
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot
certbot --version

install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'HOOK'
#!/bin/sh
systemctl reload nginx
HOOK
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

if [ ! -d /etc/letsencrypt/live/projeto-final ]; then
  certbot certonly --non-interactive --agree-tos --register-unsafely-without-email \
    --webroot -w /var/www/letsencrypt \
    --preferred-profile shortlived \
    --ip-address "$PUBLIC_IP" \
    --cert-name projeto-final
fi

echo "==> 10. Nginx com HTTPS + PQC + redirecionamento"
install -m 644 "$INFRA/nginx/projeto-final.conf" /etc/nginx/sites-available/projeto-final
nginx -t
systemctl reload nginx

echo "==> Provisionamento concluído"

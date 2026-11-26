#!/bin/sh
# Gera a rota /whisper/ do Nginx na subida do container.
#
# A transcrição de áudio da extensão AdvoxChat roda na Edge Function
# "transcrever" (Supabase), que precisa chegar ao faster-whisper do servidor.
# Esse container só tem nome dentro da rede Docker (dokploy-network), então o
# Nginx do Advox faz a ponte — protegida por um segredo que só a função tem.
#
# Variáveis (Dokploy → advox → Environment):
#   WHISPER_SEGREDO   obrigatório; sem ele a rota responde 404
#   WHISPER_UPSTREAM  padrão http://faster-whisper:8000
set -eu
ARQ=/etc/nginx/snippets/whisper.conf
mkdir -p /etc/nginx/snippets

if [ -z "${WHISPER_SEGREDO:-}" ]; then
  echo 'location /whisper/ { return 404; }' > "$ARQ"
  echo "[Advox] whisper: WHISPER_SEGREDO vazio, rota /whisper/ desligada"
  exit 0
fi

UPSTREAM="${WHISPER_UPSTREAM:-http://faster-whisper:8000}"
cat > "$ARQ" <<CONF
location /whisper/ {
    if (\$http_authorization != "Bearer ${WHISPER_SEGREDO}") { return 401; }
    client_max_body_size 26m;
    proxy_read_timeout 180s;
    proxy_send_timeout 180s;
    # Resolve na hora (DNS do Docker): se o whisper estiver fora, só esta rota falha.
    resolver 127.0.0.11 valid=30s ipv6=off;
    set \$whisper_up ${UPSTREAM};
    rewrite ^/whisper/(.*)\$ /\$1 break;
    proxy_set_header Authorization "Bearer local";
    proxy_set_header Host \$proxy_host;
    proxy_pass \$whisper_up;
}
CONF
echo "[Advox] whisper: rota /whisper/ -> ${UPSTREAM}"

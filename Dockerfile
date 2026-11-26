# Multi-stage build: compila o Vite e serve via Nginx leve

# ---------- Stage 1: build ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Cache de dependências
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copia o resto e builda
COPY . .

# Aceita VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY como build args
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

RUN npm run build

# ---------- Stage 2: serve ----------
FROM nginx:1.27-alpine AS runner

# Config customizada do Nginx (SPA + cache + gzip)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Rota /whisper/ (transcrição de áudio) — gerada na subida a partir das envs
COPY docker/40-whisper.sh /docker-entrypoint.d/40-whisper.sh
RUN chmod +x /docker-entrypoint.d/40-whisper.sh \
 && mkdir -p /etc/nginx/snippets \
 && echo 'location /whisper/ { return 404; }' > /etc/nginx/snippets/whisper.conf

# Copia o build estático
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80 3000
CMD ["nginx", "-g", "daemon off;"]

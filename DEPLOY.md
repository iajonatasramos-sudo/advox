# Guia de Deploy — Advox em VPS Hostinger via Dokploy

Este guia leva o Advox do **localhost** ao **https://app.advoxtelecom.com.br** usando:

- **GitHub** → guarda o código (https://github.com/iajonatasramos-sudo/advox)
- **VPS Hostinger** com **Dokploy** → hospeda o frontend
- **Supabase Cloud** → continua sendo o backend (não muda nada)

```
┌─────────┐  git push  ┌─────────┐    auto-deploy    ┌─────────┐
│ Seu Mac │ ─────────> │ GitHub  │  ─────────────>  │ Dokploy │
└─────────┘            └─────────┘                   │  / VPS  │
                                                     └────┬────┘
                                                          │ user acessa
                                                          ▼
                                                ┌──────────────────┐
                                                │app.advoxtelecom.com.br│
                                                └────────┬─────────┘
                                                         │ chamadas API
                                                         ▼
                                                   ┌──────────┐
                                                   │ Supabase │
                                                   └──────────┘
```

---

## Parte 1 — Subir o código no GitHub

### 1.1. Inicializa o git no projeto

No terminal local:

```bash
cd /Users/jonatasramosdejesus/Documents/VSCODE/ADVOX
git init
git branch -m main
```

### 1.2. Verifica o `.gitignore`

Tem que estar ignorando:
- `node_modules/`
- `dist/`
- `.env`, `.env.local`, `.env.*.local`

⚠️ **Confirme** com:
```bash
grep -E "env|node_modules|dist" .gitignore
```

Suas credenciais Supabase (`.env.local`) **NÃO** podem ir pro GitHub.

### 1.3. Primeiro commit

```bash
git add .
git status              # confira que .env.local NÃO está na lista
git commit -m "Initial commit — Advox CRM telecom + jurídico"
```

### 1.4. Conecta com o repositório remoto

```bash
git remote add origin https://github.com/iajonatasramos-sudo/advox.git
git push -u origin main
```

Se pedir autenticação:
- **Username:** seu usuário GitHub
- **Password:** use um **Personal Access Token** (não a senha) — gere em https://github.com/settings/tokens

---

## Parte 2 — Configurar Dokploy

### 2.1. Acesse seu painel Dokploy

Geralmente em `https://dokploy.SEUDOMINIO.com` ou `http://IP_DA_VPS:3000`.

### 2.2. Crie um novo projeto

- **Projects → Create project**
- Nome: `advox`

### 2.3. Crie uma aplicação dentro do projeto

- **Create application**
- Tipo: **Application** (não "Compose")
- Build type: **Dockerfile** (o Dockerfile já está no repositório)

### 2.4. Configure a fonte (GitHub)

- **Provider:** GitHub
- Se for o primeiro repo, conecte sua conta GitHub ao Dokploy (autorize o app)
- **Repository:** `iajonatasramos-sudo/advox`
- **Branch:** `main`
- **Build path:** `/` (raiz)
- **Auto deploy:** ✅ ON (cada `git push` redeploya sozinho)

### 2.5. Configure variáveis de ambiente

Em **Environment**:

```
VITE_SUPABASE_URL=https://ubnceeshmwzgwarprbht.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_eKFndTSCmM2wmr2BDhtxlw_cf_oJU5p
```

Marca como **Build Arguments** também (o Vite precisa dessas vars **no build**, não em runtime).

> No Dokploy isso normalmente é uma única seção "Environment variables" que serve tanto pra build args quanto runtime. Se houver opção separada, marque "Build args".

### 2.6. Configure o domínio

Em **Domains**:

- **Add domain**
- Host: `app.advoxtelecom.com.br`
- Port: `80` (o Nginx interno do container escuta na 80)
- HTTPS: ✅ ON (Dokploy usa Traefik com Let's Encrypt automaticamente)
- Certificate: Let's Encrypt

> Antes disso, **aponta o DNS**: registro A `app.advoxtelecom.com.br` → IP da sua VPS.

### 2.7. Deploy

- **Deploy** (botão grande)
- Dokploy clona o repo, builda o Docker (multi-stage Node → Nginx), sobe o container
- Acompanhe os logs — a primeira vez leva 2-4 min
- Quando concluir, abre `https://app.advoxtelecom.com.br` no navegador

---

## Parte 3 — Configurar Supabase para o domínio de produção

**Não muda hospedagem nenhuma do Supabase.** São só 3 ajustes pra autorizar `app.advoxtelecom.com.br` a falar com o backend.

No Dashboard Supabase (https://supabase.com/dashboard) do seu projeto Advox:

### 3.1. Site URL e Redirect URLs

**Authentication → URL Configuration:**

- **Site URL:**
  ```
  https://app.advoxtelecom.com.br
  ```

- **Redirect URLs** (uma por linha):
  ```
  https://app.advoxtelecom.com.br/**
  http://localhost:5173/**
  ```
  Mantém o `localhost` pra você continuar desenvolvendo.

Save.

### 3.2. Email confirmation (recomendado ON em produção)

Em dev você desativou pra usar emails fake. Em produção, religue:

- **Authentication → Providers → Email** → toggle **"Confirm email" ON**

Os emails sairão com o `Site URL` que você definiu acima.

### 3.3. (Se for usar) Google OAuth

- No **Google Cloud Console** → seu OAuth Client → **Authorized redirect URIs**, adicione:
  ```
  https://ubnceeshmwzgwarprbht.supabase.co/auth/v1/callback
  ```

---

## Parte 4 — Configurar DNS

No painel do registrador do seu domínio (Hostinger, Registro.br, etc.):

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A    | `app` (subdomínio `app.advoxtelecom.com.br`) | IP da sua VPS | 3600 |

Aguarde 5–30 min pro DNS propagar. Confira:
```bash
dig app.advoxtelecom.com.br +short
# Deve retornar o IP da VPS
```

---

## Parte 5 — Primeiro admin

Depois do deploy estar no ar, crie sua conta admin:

### 5.1. Acessa `https://app.advoxtelecom.com.br`

Vai cair na tela de Login.

### 5.2. Se cadastra normalmente (Cadastre-se)

Cria com um email real.

### 5.3. No SQL Editor do Supabase, vira admin:

```sql
update profiles
set papel = 'admin', status = 'ativo'
where email = 'seu@email.com';
```

### 5.4. Volta no app e dá hard reload

Vai cair direto no painel Admin.

---

## Parte 6 — Atualizações futuras (deploy automático)

A partir de agora, **qualquer `git push origin main` redeploya sozinho**:

```bash
cd /Users/jonatasramosdejesus/Documents/VSCODE/ADVOX
# ...edita código...
git add .
git commit -m "minha alteração"
git push
```

O Dokploy detecta o push (via webhook do GitHub), rebuilda o Docker, e troca o container sem downtime (rolling deploy).

Para acompanhar:
- Dokploy → seu app → **Deployments** mostra histórico
- Logs em tempo real durante o build

---

## Parte 7 — Manutenção

### Ver logs do app

Dokploy → app → **Logs** (tail em tempo real).

### Reiniciar a aplicação

Dokploy → app → **Actions → Restart**.

### Rollback

Dokploy → **Deployments** → escolhe um deploy anterior → **Redeploy**.

### Backup do Supabase

Plano **Free**: backup manual via Database → Backups → Download.
Plano **Pro** (~US$25/mês): backup diário automático.

---

## Checklist final antes de divulgar

- [ ] `dig app.advoxtelecom.com.br` retorna o IP da VPS
- [ ] `https://app.advoxtelecom.com.br` abre sem warning de SSL
- [ ] Login com email/senha funciona
- [ ] Cadastro novo cria conta + email de confirmação chega
- [ ] Convites funcionam (testa abrindo URL `?invite=TOKEN` em aba anônima)
- [ ] Drag-and-drop persiste após reload
- [ ] Upload de documento funciona
- [ ] Realtime funciona (alteração em uma aba aparece em outra)
- [ ] Site URL no Supabase está com `https://app.advoxtelecom.com.br`
- [ ] Email confirmation ON no Supabase
- [ ] Primeiro admin definido no banco
- [ ] Backup do Supabase agendado (manual no Free, automático no Pro)

---

## Resumindo: quem hospeda o quê

| Parte | Onde fica | Você configura |
|------|-----------|----------------|
| Código fonte | GitHub | git push manual |
| Build + container | Dokploy (na VPS) | Automático via Dockerfile |
| Frontend servido | Nginx dentro do container Docker | Automático |
| Reverse proxy + HTTPS | Traefik (dentro do Dokploy) | Configura domínio no painel |
| Banco/Auth/Storage | Supabase Cloud | Não muda — só ajusta URLs autorizadas |
| Domínio (DNS) | Registrador | Aponta A record pro IP da VPS |

---

## Possíveis problemas e soluções rápidas

### "Build falhou no Dokploy"
- Veja os logs do build no painel
- Causa comum: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` não estão como Build Args
- Solução: adicionar como build args na config da aplicação

### "Site abre mas dá erro de CORS / 401 no login"
- O `Site URL` no Supabase ainda está apontando pra `localhost` ou domínio errado
- Vai em **Authentication → URL Configuration**, corrige, save

### "Email de confirmação não chega"
- Em dev você desativou "Confirm email"; em prod ligue de novo
- Cheque a caixa de spam
- Pode personalizar templates em **Authentication → Email Templates**

### "Recarregar uma rota dá 404"
- O `nginx.conf` já tem `try_files $uri /index.html` — SPA fallback
- Se acontecer, verifique se o arquivo `nginx.conf` foi incluído no build do container (deve estar em `/etc/nginx/conf.d/default.conf`)

### "Drag-and-drop não persiste em produção"
- Verifique se a publication do Supabase realtime inclui as tabelas (`profiles`, `leads`, `casos`, `tarefas`, `notificacoes`)
- A migration `0004_enable_realtime.sql` cobre isso

### "Mudei o código, push pro GitHub, mas o site não atualiza"
- Confere em Dokploy se o deploy foi disparado (Deployments)
- Webhook pode estar com problema; trigger manual: Dokploy → **Deploy**
- Se demorar muito, hard reload o browser (Cmd+Shift+R) — pode estar em cache

---

## Custos esperados

| Item | Custo mensal |
|------|--------------|
| VPS Hostinger KVM 2 (4GB) | ~R$ 30–50 |
| Domínio `.com.br` | ~R$ 4 (anual ~R$ 50) |
| Supabase Free (1 GB DB + 1 GB Storage) | R$ 0 |
| **Total inicial** | **~R$ 35/mês** |
| Quando passar de ~100 usuários ativos: Supabase Pro | +US$ 25 (~R$ 130) |

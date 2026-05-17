# Setup do backend (Supabase)

Este projeto usa **Supabase** para banco de dados (Postgres) + autenticação (email/senha + Google OAuth) + storage de documentos.

## 1. Criar o projeto

1. Crie conta em **https://supabase.com** (free tier serve para começar)
2. **New Project** → escolha um nome (ex: `advox-prod`), uma região (ex: `South America (São Paulo)`), defina uma senha forte para o banco e clique em **Create**
3. Aguarde ~2 min até o projeto provisionar

## 2. Pegar as credenciais

No dashboard do projeto:
- **Project Settings → API**
- Copie:
  - **Project URL** → `VITE_SUPABASE_URL`
  - **anon / public key** → `VITE_SUPABASE_ANON_KEY` (esta é pública, vai no frontend)

Crie o arquivo `.env.local` na raiz do projeto a partir do `.env.example`:

```bash
cp .env.example .env.local
# edite .env.local com os valores reais
```

Depois disso, restart do `npm run dev`.

## 3. Rodar o schema SQL

No dashboard do Supabase:
- **SQL Editor → New query**
- Copie todo o conteúdo de [`supabase/migrations/0001_initial_schema.sql`](migrations/0001_initial_schema.sql)
- Cole e clique em **Run**

Isso cria:
- Enums (papel, status, operadora, pipelines)
- Tabelas: `revendas`, `profiles`, `leads`, `casos`, `tarefas`, `notas`, `documentos`, `prazos`, `convites`, `auditoria`
- Row Level Security policies por papel (Admin / Coord / Rep / Advogado)
- Trigger automático: ao criar usuário em `auth.users`, cria `profile` pendente
- Trigger de auditoria em mudanças importantes
- View `revenda_stats` para contadores agregados

## 4. Habilitar Google OAuth

1. **Google Cloud Console** → criar projeto → **APIs & Services → Credentials**
2. **Create Credentials → OAuth client ID → Web application**
3. Em **Authorized redirect URIs**, adicione:
   ```
   https://<seu-projeto>.supabase.co/auth/v1/callback
   ```
4. Copie **Client ID** e **Client Secret**
5. No Supabase: **Authentication → Providers → Google → Enable** → cole Client ID + Secret → **Save**

Configure também as URLs do app em **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:5173` (dev) ou seu domínio em produção
- **Redirect URLs**: adicione `http://localhost:5173/**` e o domínio de produção

## 5. Criar o primeiro Admin

Após cadastrar-se pela tela de signup do app (qualquer email), abra o **SQL Editor** e rode:

```sql
update profiles
set papel = 'admin', status = 'ativo'
where email = 'seu-email@dominio.com';
```

Agora você é Admin e pode convidar Coords e Advogados pela interface.

## 6. Storage para documentos (opcional, fase 5)

Em **Storage → New bucket**:
- Nome: `documentos`
- Public: **false** (privado)
- File size limit: `10 MB` (ou conforme regra)

Política de upload/leitura virá em migration futura.

## Backup / migração para self-host

Quando quiser sair do Supabase Cloud:
- **Database → Backups** baixa um dump completo do Postgres
- O dump roda em qualquer Postgres 14+ na sua VPS
- O Supabase é open-source (https://supabase.com/docs/guides/self-hosting) — pode subir um Docker Compose com auth + storage + DB completo

## Variáveis de ambiente

| Var | Onde | Pública? |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` | sim (vai pro bundle) |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | sim (protegida por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | só no servidor/backoffice — **nunca** no frontend | **NÃO** — bypassa RLS |

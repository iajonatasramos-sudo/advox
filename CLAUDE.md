# Advox — Contexto para Claude

Este arquivo dá ao Claude Code o contexto necessário para entender e evoluir o projeto sem precisar reler tudo. **Sempre leia antes de começar uma sessão.**

---

## Visão geral

**Advox** é um CRM SaaS que conecta vendedores de telecom (reps), suas revendas (operadoras parceiras) e um escritório de advocacia. O fluxo central: vendedor identifica cliente preso em contrato abusivo → "Desbloquear Cliente" (wizard) → escritório recebe o caso, atua, libera → comissão de êxito flui.

**Stakeholders / papéis no sistema (`enum papel`):**

- `rep` — Representante / vendedor de telecom. Cadastra leads, faz follow-up, indica casos para o jurídico.
- `coord` — Coordenador da Revenda (gestor de um grupo de reps). Aprova reps da revenda, vê pipeline agregado, pode operar como vendedor.
- `advogado` — Atua nos casos jurídicos atribuídos.
- `admin` — Visão sistêmica, configurações, convida coords/advogados, reatribui casos.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | **Vite + React 18 + TypeScript** |
| Hospedagem do frontend | **VPS Hostinger** (via Dokploy → Docker) |
| Backend (DB + Auth + Storage) | **Supabase Cloud** (project ref: `ubnceeshmwzgwarprbht`) |
| Realtime | Supabase Realtime (WebSocket) — usado para kanban, notificações, lista de profiles |
| Storage de documentos | Supabase Storage, bucket privado `documentos` |
| Estilização | CSS-in-JS (inline styles) + variáveis CSS no [src/styles.css](src/styles.css) — sem Tailwind, sem CSS Modules |
| Build/deploy | `npm run build` → `dist/` → Nginx via Dockerfile |
| Lint/test | Apenas type-check (`tsc --noEmit`) — sem ESLint nem testes E2E ainda |

---

## Estrutura de pastas

```
src/
  main.tsx            entrypoint — wraps com AuthProvider + DataProvider
  App.tsx             shell: topbar + sidebar + route guard por papel
  auth.tsx            AuthProvider, Login, Cadastro, AceitarConvite, PendingApproval, telas de erro
  rep.tsx             Telas do Representante (Dashboard, kanban+lista, Lead Detail, Tarefas, Casos)
  coord.tsx           Telas do Coordenador (Dashboard, Meu Time, Leads da Equipe, Casos, Tarefas)
  adv.tsx             Telas do Advogado (Dashboard kanban, Caso Detail, Prazos)
  admin.tsx           Telas do Admin (Visão Geral, Revendas, Reps, Advogados, Leads, Casos, Auditoria, Config)
  shared.tsx          Telas compartilhadas (Perfil, NotifPanel, Onboarding, Error 404/500)
  modal.tsx           Modal Desbloquear Cliente (wizard 4 passos)
  invite-modal.tsx    Modal de convidar usuário (gera link com token)
  docs.tsx            Componente DocumentosLista (upload/download para Supabase Storage)
  ui.tsx              Primitivos (Btn, Badge, Input, KPI, Section, Tabs, Avatar, etc.)
  icons.tsx           ~50 ícones SVG inline (objeto `Ic.*`)
  data.ts             Tipos legados + USERS mock (alguns campos ainda referenciados)
  store.tsx           DEPRECATED — context que tinha leads/casos mock (substituído por useLive*)
  styles.css          Tokens CSS (paleta Sinal: navy + magenta) + utilitários responsivos
  vite-env.d.ts       Tipagem do import.meta.env

  lib/
    supabase.ts       Cliente Supabase configurado (lê env vars do Vite)
    database.types.ts Tipos TypeScript das tabelas do schema (escritos à mão — não autogerados)
    data-live.tsx     ⭐ Hooks live (useLiveLeads, useLiveCasos, useLiveTarefas,
                      useLiveNotificacoes, useLiveConvites, useLiveAuditoria) +
                      mutations (createLead, updateLead, createCaso, createConvite, etc.) +
                      tipos UI com joins (UiLead, UiCaso, UiTarefa)

supabase/
  README.md           Como configurar o projeto Supabase do zero
  migrations/
    0001_initial_schema.sql       Schema completo: enums + 10 tabelas + RLS + audit triggers
    0002_fix_trigger.sql          Robustez do handle_new_auth_user
    0003_drop_trigger_use_frontend.sql   Remove trigger, frontend cria profile
    0004_enable_realtime.sql      Add tabelas ao publication supabase_realtime
    0005_revendas_public_read.sql Anon pode ler revendas ativas (signup)
    0006_invites_rpc.sql          get_invite / aceitar_convite (security definer)
    0007_storage_docs.sql         Policies do bucket documentos
    0008_notificacoes.sql         Tabela + triggers que criam notificações automáticas
    0009_aceites_termos.sql       Tabela LGPD de aceites versionados

Dockerfile          Multi-stage: node:20-alpine builda, nginx:alpine serve
nginx.conf          Config do Nginx dentro do container (SPA + cache + gzip + security)
.dockerignore       Exclui node_modules, dist, .env, supabase/, etc.

DEPLOY.md           Guia passo a passo de deploy (GitHub + Dokploy + Hostinger VPS)
ROADMAP.md          Status das fases do projeto
README.md           (se existir) Resumo público
CLAUDE.md           Este arquivo
```

---

## Modelo de dados (resumo)

```
revendas        ──< profiles (rep, coord)       ──< leads
                                                      ├──── casos ──── advogado_id → profiles
                                                      ├──── tarefas
                                                      ├──── notas
                                                      ├──── documentos (em Storage)
                                                      └──── prazos

convites        ──> profiles (quem convidou)
notificacoes    ──> profiles (destinatário)
aceites_termos  ──> profiles (signatário, com versão)
auditoria       ──> profiles (actor — pode ser null pra sistema)
```

**Convenções importantes:**
- Toda tabela com `created_at` e `updated_at`. `updated_at` é atualizado por trigger `set_updated_at`.
- Auditoria automática em `leads`, `casos`, `profiles`, `revendas` via trigger `log_audit`.
- Soft delete via `status = 'suspenso'` em `profiles` e `revendas` (não dropamos linhas).
- Notificações criadas automaticamente em eventos chave (caso atribuído, status muda, caso liberado, rep aprovado).

---

## RLS — Row Level Security

**RLS está habilitado em todas as tabelas.** Cada papel vê só o que pode:

| Tabela | Admin | Coord (da revenda) | Rep (próprio) | Advogado (atribuído) |
|---|---|---|---|---|
| `profiles` | tudo | profiles da revenda + edita reps | só o próprio | só o próprio |
| `revendas` | tudo | só a própria + edita | listar ativos | listar ativos |
| `leads` | tudo | leads da revenda | só os seus | leads com caso atribuído |
| `casos` | tudo | casos da revenda | casos dos seus leads | casos atribuídos |
| `tarefas` | tudo | tarefas do time | só as criadas | — |
| `notas` | tudo | não-internas do time | não-internas dos seus leads | internas dos seus casos + não-internas |
| `documentos` | tudo | docs do time | docs dos seus leads | docs dos seus casos |
| `auditoria` | tudo | — | só ações próprias | só ações próprias |
| `notificacoes` | — (RLS só usuário próprio) | só próprias | só próprias | só próprias |

**RPC functions (security definer):**
- `get_invite(token)` — anon, retorna info do convite válido
- `aceitar_convite(token, user_id)` — autenticado, ativa profile + marca convite usado

---

## Fluxos críticos

### Cadastro de Representante
1. Acessa Cadastro → seleciona revenda da lista → digita nome/email/senha
2. `supabase.auth.signUp()` → cria em `auth.users`
3. Frontend cria profile em `public.profiles` (papel=`rep`, status=`pendente`, revenda_id)
4. Registra aceite de termos
5. Mostra "Aguardando aprovação"
6. Coord da revenda recebe na tela Meu Time, clica Aprovar
7. Realtime no profile → app reativo redireciona pro Painel

### Convite (Admin → Coord/Advogado; Coord → Rep)
1. Tela "Representantes" / "Advogados" / "Meu Time" → botão Convidar
2. Modal pede email (+ papel se for Admin, + revenda se for Admin convidando Coord)
3. Insere em `convites` com token aleatório
4. Frontend mostra URL: `https://app/<rota>?invite=TOKEN`
5. Convidado abre URL → AceitarConvite component → RPC `get_invite(token)` → mostra form com nome/senha
6. Submit → `supabase.auth.signUp()` → cria profile → RPC `aceitar_convite(token, userId)` → ativa profile com papel/revenda do convite

### Desbloquear Cliente (Modal wizard)
1. Rep clica "Desbloquear" no top do app ou no Lead Detail
2. Wizard 4 passos: escolhe se é novo ou existente → dados → tipo do caso → confirmação
3. Submit:
   - Se novo: cria `lead` (status=`travado`)
   - Se existente: muda lead para `travado`
   - Cria `caso` (status=`recebido`)
   - Liga `lead.advox_caso_id = caso.id`
4. Trigger `notif_caso_criado` notifica advogado (se atribuído na criação) — geralmente Admin atribui depois

### Drag-and-drop (kanban)
- Cards têm `draggable={true}`, colunas têm `onDrop`
- Ao soltar: `updateLead(id, { status })` ou `updateCaso(id, { status })`
- Realtime propaga mudança para outros usuários

---

## Convenções de código

- **Sem libs adicionais sem necessidade.** Não usar lodash, axios, react-query, dnd-kit, etc. Mantemos o bundle enxuto. HTML5 DnD nativo basta.
- **Estilização inline** com `style={{...}}` ou variáveis CSS (`var(--ink)`, `var(--navy)`). Apenas classes utilitárias em [src/styles.css](src/styles.css) (responsive, scrollbar, anim).
- **Import dos hooks live** em vez do store antigo: `useLiveLeads`, `useLiveCasos`, etc. de `./lib/data-live`. O `useStore` ainda existe mas está deprecated.
- **Tipos com join** terminam em `Ui*` (UiLead, UiCaso, UiTarefa). Os tipos crus do DB são `DbLead`, etc., não exportados.
- **Mutations** retornam `{ data?, error?: string }` — nunca lançam. Frontend trata `error` mostrando mensagem.
- **Realtime via `useChannel`** helper em [src/lib/data-live.tsx](src/lib/data-live.tsx). Sempre cleanup com `removeChannel`.
- **PostgREST embed ambíguo** quando há múltiplas FKs entre 2 tabelas: usar nome explícito do constraint. Ex: `revenda:revendas!leads_revenda_id_fkey(nome)`.
- **i18n** — toda interface em pt-BR. Sem prep para multi-idioma agora.
- **Console logs** com prefixo `[Advox]` para facilitar filtragem no DevTools.
- **Não criar arquivos `.md` extras** sem o usuário pedir. README/DEPLOY/ROADMAP/CLAUDE já cobrem.

---

## Comandos do dia-a-dia

```bash
# Dev
npm run dev                 # vite na porta 5173

# Verificações
npx tsc --noEmit            # type-check (não emite arquivos)
npm run build               # build de produção em dist/
npm run preview             # serve o dist/ localmente em :4173

# Deploy (Dokploy faz auto via Docker, mas se quiser manual)
docker build -t advox-frontend \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_ANON_KEY=... .
docker run -p 8080:80 advox-frontend
```

---

## Variáveis de ambiente

```
VITE_SUPABASE_URL          https://ubnceeshmwzgwarprbht.supabase.co
VITE_SUPABASE_ANON_KEY     sb_publishable_* (formato novo, é PÚBLICA por design)
```

- **Local dev:** arquivo `.env.local` (no .gitignore, nunca commitar)
- **Build no Docker:** `--build-arg` passa pro Vite (que substitui no bundle)
- **Dokploy:** define como Environment Variables na UI da aplicação

⚠️ **Nunca** colocar a `service_role` key no frontend ou em variável `VITE_*`. Ela é só pra Edge Functions / scripts server-side.

---

## Gotchas / dores conhecidas

1. **Chrome às vezes trava no auth load** com localStorage stale. Adicionei timeout de 8s + botão "Limpar sessão e recarregar" + dedup de loadProfile. Se reaparecer, verificar logs `[Advox]` no console.
2. **React StrictMode em dev** monta efeitos duas vezes. O loadProfile usa cache module-level (`inflightProfile`) pra dedupar. Em prod (sem StrictMode) o problema não existe.
3. **Realtime requer publication.** Se uma tabela nova for criada, lembrar de `alter publication supabase_realtime add table <nome>`.
4. **Cold start do Supabase** na primeira request pode levar 3-5s. Por isso o timeout de 10s no loadProfile + retry automático.
5. **`sb_publishable_*` key (formato 2025)** é suportada pelo supabase-js >= 2.46. Estamos em 2.105+, sem problema.
6. **Embed ambíguo** entre profiles ↔ revendas (rep_id e coord_id) precisa usar nome explícito da constraint na query.

---

## O que ainda não está pronto (futuro)

Ver [ROADMAP.md](ROADMAP.md) para o panorama completo. Resumo do que falta:

- **Emails transacionais customizados** (convites, notificações por email) — precisa Edge Function + Resend/SendGrid
- **Páginas estáticas de Termos / Política de Privacidade** (textos legais publicados)
- **Detalhe completo do Representante** (Admin clica e vê histórico)
- **Importar leads via CSV/Excel**
- **Testes E2E (Playwright)**
- **CI/CD com GitHub Actions** (Dokploy já cobre auto-deploy do push)
- **Push notifications web** (PWA)

---

## Como o Claude deve agir aqui

- **Não delegar entendimento.** Antes de mudar, leia o arquivo afetado.
- **Não criar libs nem scaffolds.** A app é deliberadamente lean.
- **Mudanças em RLS exigem migration nova** — não modifique policies existentes em arquivos antigos.
- **Não rodar comandos destrutivos no banco** sem confirmação explícita do usuário.
- **Se for criar migration nova,** use o próximo número sequencial em `supabase/migrations/00NN_descricao.sql`.
- **Em telas novas,** seguir o padrão dos componentes existentes (Section, Btn, Input, etc., variáveis CSS).
- **Usuário tem preferência salva "considere sempre yes"** — não pergunte por aprovações em escolhas reversíveis. Ainda confirme antes de operações destrutivas (force push, drop, deletar registros do banco).

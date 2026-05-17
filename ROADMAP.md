# Advox — Roadmap

Sistema CRM Telecom + Jurídico. Frontend em **Vite + React + TS**, backend em **Supabase** (Postgres + Auth + Storage), hospedagem prevista em **VPS própria** (frontend) + **Supabase Cloud** (backend).

---

## Estado atual: ✅ Frontend completo · ✅ Auth funcionando · 🔜 Migrando para dados reais

Estamos no **fim da Fase 3** e prestes a iniciar a **Fase 4**.

---

## 📦 Frontend (pré-backend) — ✅ Concluído

Construído antes da decisão de backend. Tudo isso já está rodando.

- [x] Scaffold Vite + React + TS, dependências, build limpo
- [x] Sistema visual ("Sinal" — azul-elétrico + magenta) com fontes Geist/JetBrains/Newsreader
- [x] **Personas** com telas dedicadas: Representante, Coordenador (revenda), Advogado, Admin
- [x] **~25 telas** implementadas:
  - 5 do Representante (Dashboard kanban+lista, Lead Detail, Tarefas, Casos)
  - 5 do Coordenador (Painel, Meu Time, Leads da Equipe, Casos, Tarefas)
  - 3 do Advogado (Dashboard kanban, Caso Detail, Prazos)
  - 7 do Admin (Visão Geral, Representantes, Advogados, Todos Leads, Todos Casos, Auditoria, Configurações)
  - Telas auxiliares: Perfil, Notificações, Onboarding, 404/500
- [x] **Modal Desbloquear Cliente** — wizard 4 passos
- [x] **Responsividade mobile** completa (drawer sidebar, tabs scrolláveis, grids que empilham, modais full-screen)
- [x] **Drag-and-drop** nos kanbans (Rep, Adv, Coord) — funciona localmente

---

## 🚀 Backend — fases planejadas

### Fase 1 — Setup Supabase ✅ Concluída

- [x] Conta + projeto Supabase Cloud criados (`ubnceeshmwzgwarprbht`)
- [x] `@supabase/supabase-js` instalado
- [x] `.env.local` configurado (URL + anon key)
- [x] Cliente Supabase tipado (`src/lib/supabase.ts`)
- [x] Tipos TypeScript do schema (`src/lib/database.types.ts`)
- [x] `.gitignore` protegendo credenciais

### Fase 2 — Schema + RLS ✅ Concluída

- [x] Migration [`0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql) com 10 tabelas e 7 enums
- [x] Row Level Security por papel (Admin / Coord / Rep / Advogado)
- [x] Triggers de auditoria automática (leads, casos, profiles, revendas)
- [x] View `revenda_stats` para contadores agregados
- [x] Migration [`0002_fix_trigger.sql`](supabase/migrations/0002_fix_trigger.sql) — robustez no trigger de signup
- [x] Migration [`0003_drop_trigger_use_frontend.sql`](supabase/migrations/0003_drop_trigger_use_frontend.sql) — frontend cria profile (mais previsível)

### Fase 3 — Autenticação ✅ Concluída

- [x] `AuthProvider` ([src/auth.tsx](src/auth.tsx)) com session + profile + realtime
- [x] Tela de **Login** (email/senha)
- [x] Tela de **Cadastro de Representante** (com seleção de revenda)
- [x] **Google OAuth** (botão pronto — falta habilitar provider no Dashboard)
- [x] Tela de **"Aguardando aprovação"** + botão "Verificar agora"
- [x] Tela de **acesso bloqueado** (suspenso/recusado)
- [x] Tela de **recuperação de senha**
- [x] **Route guards** (loading / login / pending / app)
- [x] Realtime: status do profile atualiza sem reload
- [x] Topbar exibe papel real, botão **Sair**
- [x] Mensagens de erro humanizadas
- [x] Safety timeouts e tela de erro do profile (rede de segurança)

### Fase 4 — Migrar mocks para Supabase 🔜 **PRÓXIMA**

Substituir `useStore` (mocks) por queries reais do Supabase. **Esta é a fase que torna o sistema "vivo".**

- [ ] **Revendas**: tela Admin lista/cria/edita revendas do banco
- [ ] **Profiles** (usuários): Admin Representantes + Coord Meu Time vêm do banco
- [ ] **Leads**:
  - Listagem (Rep Dashboard kanban+lista, Coord Leads, Admin Todos Leads)
  - Criar lead (botão "Novo Lead")
  - Editar lead (no detalhe)
  - Drag-and-drop **persiste** mudança de status
  - **Realtime** — mover card no Rep aparece pro Coord/Admin em tempo real
- [ ] **Casos**:
  - Listagem (Adv kanban, Rep Casos, Coord Casos, Admin Todos Casos)
  - Criar caso via Modal Desbloquear (já existe a UI, falta gravar)
  - Update de status no detalhe (Advogado)
- [ ] **Tarefas**: criar, completar, listar (Rep Tarefas + Coord Tarefas da Equipe)
- [ ] **Notas/Timeline** no lead detail + caso detail (insert real)
- [ ] **Prazos** (Adv Prazos)
- [ ] **Auditoria** (Admin Auditoria) — já é populada por trigger, só ler
- [ ] Loading + error states em todas as telas

**Estimativa**: a maior das fases — ~10-15 sessões de trabalho dependendo do detalhe.

### Fase 5 — Aprovações + Convites + UI Admin completa ✅ Concluída

- [x] **Coord aprova/recusa Reps** direto na UI (botões na tela "Meu Time")
- [x] **Admin aprova/recusa Coords e Advogados** direto na UI
- [x] **Sistema de convites** com link compartilhável:
  - Admin → convida Coord/Advogado
  - Coord → convida Reps da própria revenda
  - Token de 7 dias armazenado em `convites`
  - Tela pública "Aceitar convite" (URL `?invite=TOKEN`)
  - RPC `get_invite` / `aceitar_convite` (security-definer)
- [x] **Admin cadastra/edita revendas** via UI
- [x] **Reatribuir casos** (Admin → trocar advogado responsável)
- [x] **Suspender/reativar** usuários
- [ ] Tela de **detalhe do Representante** (histórico do rep — futuro)
- [ ] Envio real de email do convite (hoje gera só o link; futuro: Edge Function + Resend)

### Fase 6 — Storage de Documentos ✅ Concluída

- [x] Bucket `documentos` no Supabase Storage (criar manualmente — instruções na migration 0007)
- [x] Migration `0007_storage_docs.sql` com policies do bucket
- [x] Upload de PDF/imagem em leads (aba Documentos) — componente `DocumentosLista`
- [x] Upload de PDF/imagem em casos (aba Documentos)
- [x] Download com URL assinada (privada, expira em 60s)
- [x] Policies vinculadas às policies da tabela `documentos` (Rep só vê dos seus leads, Advogado só dos seus casos, etc.)
- [x] Realtime — quando alguém faz upload, aparece pra todos sem reload
- [ ] Compressão/preview de imagens (deixado pra futuro)

### Fase 7 — Notificações & Comunicação (parcial)

- [x] **Tabela `notificacoes`** com RLS (usuário só vê próprias)
- [x] **Triggers automáticos** criam notificações em eventos chave:
  - Caso atribuído a advogado → notifica advogado
  - Caso muda de status → notifica rep + coord
  - Caso liberado → notificação destacada para rep + coord
  - Rep aprovado → notifica o rep
- [x] **Feed in-app** no sininho do topbar (com contador de não-lidas)
- [x] **Realtime** — notificação chega sem reload
- [x] **Marcar como lida** (individual ou todas)
- [ ] **Templates de email transacional** (precisa Edge Function + Resend/SendGrid)
- [ ] **WhatsApp Business API** (opcional, futuro)
- [ ] **Push notifications** web (opcional, futuro PWA)

### Fase 8 — LGPD & Compliance ✅ Concluída

- [x] **Exportar meus dados** (tela Perfil → LGPD → gera JSON com profile + leads + casos + tarefas + notas)
- [x] **Excluir minha conta** (suspende conta + logout)
- [x] **Audit log** automático em leads/casos/profiles/revendas
- [x] **Aceite de termos** registrado na tabela `aceites_termos` (versionado, com IP/user-agent)
- [x] Aceite automático no signup público + ao aceitar convite
- [x] Visualização dos aceites no Perfil → Privacidade LGPD
- [ ] **Política de privacidade** + **Termos de uso** publicados como página (textos legais — produção)

### Fase 9 — Deploy & Produção 🟡 Guia pronto, execução pelo usuário

- [x] **[`DEPLOY.md`](DEPLOY.md)** — guia completo passo a passo
- [x] Code splitting (React/Supabase/app em chunks separados)
- [x] Build de produção limpo (`npm run build`)
- [ ] Executar na VPS — Nginx + Let's Encrypt + DNS configurados
- [ ] Authentication URL Configuration no Supabase com o domínio de prod
- [ ] Google OAuth com redirect URI de prod
- [ ] Backup automático/manual configurado
- [ ] Monitoramento básico (uptime, erros)
- [ ] CI/CD simples (futuro — GitHub Actions)

### Fase 10 — Polish (após produção)

- [ ] Testes E2E (Playwright) cobrindo signup, aprovação, criar lead, mover kanban, desbloquear
- [ ] Performance: lazy-load de rotas pesadas, code-splitting
- [ ] Acessibilidade (WCAG AA)
- [ ] Migração opcional para **Supabase self-hosted** na sua VPS (zero dependência de fornecedor)
- [ ] Iteração com feedback dos usuários reais

---

## 📊 Progresso resumido

| Fase | Status | Tamanho |
|------|--------|---------|
| Frontend (telas + visual + responsivo + DnD) | ✅ | grande |
| 1 — Setup Supabase | ✅ | pequena |
| 2 — Schema + RLS | ✅ | média |
| 3 — Autenticação | ✅ | grande |
| 4 — Mocks → Supabase | ✅ | grande |
| 5 — Aprovações + Convites + UI Admin | ✅ | média |
| 6 — Storage de Documentos | ✅ | pequena |
| 7 — Notificações (in-app + triggers) | 🟡 | parcial (email é Edge Function — futuro) |
| 8 — LGPD | ✅ | completa (faltam textos legais) |
| 9 — Deploy | 🟡 | guia pronto — execução na VPS |
| 10 — Polish | ⏳ | contínua |

**Resumo:** 8 fases concluídas + 2 parciais. O **código está pronto para produção**. Falta apenas executar o deploy (seguindo [`DEPLOY.md`](DEPLOY.md)) e, opcionalmente, configurar emails transacionais. O sistema está funcionalmente completo.

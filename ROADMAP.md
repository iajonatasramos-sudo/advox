# Advox — Roadmap

Sistema CRM Telecom + Jurídico. Frontend em **Vite + React + TS**, backend em **Supabase** (Postgres + Auth + Storage + Realtime), frontend hospedado em **VPS Hostinger via Dokploy** (Docker + Nginx).

_Última revisão: 23/11/2026 — varredura completa de código + testes de RLS em Postgres local._

---

## Estado atual

**Funcionalmente completo para os 4 papéis, com dados reais.** A varredura de 23/11/2026 encontrou falhas de segurança sérias no banco (qualquer usuário podia virar admin) e bugs de uso real. As correções estão na migration `0013` e nos ajustes de frontend do mesmo dia.

> ✅ **23/11/2026:** produção estava sem 0009, 0011 e 0012 (projeto tinha ficado pausado). Aplicadas 0009, 0011, 0012, 0013 e 0014 e verificadas (escalonamento rep→admin bloqueado, anon só lê revendas ativas).
>
> ⚠️ Projeto Supabase está no **plano free** — pausa após 7 dias sem uso. Considerar Pro antes de clientes reais. Ligar "Leaked password protection" em Authentication.

---

## ✅ Concluído

### Frontend base
- [x] Vite + React + TS, sistema visual "Sinal", responsivo (drawer, modais full-screen)
- [x] ~25 telas para Rep, Coord, Advogado e Admin + Perfil, Notificações, Onboarding, 404/500
- [x] Wizard **Desbloquear Cliente** (4 passos)
- [x] Kanban com drag-and-drop persistindo no banco
- [x] ErrorBoundary + cache local (SWR) de profile e listas
- [x] Branding por revenda (logo + cor primária)

### Supabase
- [x] Schema completo (10 tabelas + notificações + aceites), enums, triggers de `updated_at` e auditoria
- [x] RLS em todas as tabelas, helpers `security definer` (sem recursão — migration 0010)
- [x] Realtime em profiles, leads, casos, tarefas, revendas, notificações (+ notas, documentos, convites, auditoria, prazos na 0013)
- [x] Storage privado `documentos` (URL assinada de 60s) + bucket público `revenda-logos`

### Auth e usuários
- [x] Login, cadastro de Rep com escolha de revenda, recuperação de senha, Google OAuth (botão pronto)
- [x] Telas "Aguardando aprovação" e "Acesso bloqueado"; status reativo via realtime
- [x] Convites com token de 7 dias (Admin → Coord/Advogado; Coord → Rep) via RPC
- [x] Aprovar / recusar / suspender / reativar usuários; reatribuir advogado

### Dados reais por tela
| Papel | Tela | Status |
|---|---|---|
| Rep | Dashboard kanban/lista, Novo Lead, Lead Detail, Casos | ✅ |
| Rep | Tarefas | ✅ (criação corrigida em 23/11) |
| Rep | Desbloquear | ✅ (valor, retry e descrição corrigidos em 23/11) |
| Coord | Painel, Meu Time, Leads da Equipe, Casos | ✅ |
| Coord | Tarefas | 🟡 só leitura (não cria; marcar tarefa de outro não tem efeito) |
| Advogado | Kanban, Caso Detail (status, notas, documentos) | ✅ |
| Advogado | Prazos | 🟡 só leitura — falta UI de criar/editar (banco já permite após 0013) |
| Admin | Visão Geral, Representantes, Advogados, Leads, Casos, Auditoria | ✅ |
| Admin | Revendas | ✅ suspender/reativar passa a funcionar após 0013 |
| Admin | Configurações | ❌ mock (webhooks, templates, editor de pipeline não salvam) |

### LGPD
- [x] Exportar meus dados (JSON), excluir conta (suspensão), aceite de termos versionado, auditoria automática

### Deploy
- [x] Dockerfile multi-stage + Nginx (SPA, gzip, cache), [DEPLOY.md](DEPLOY.md), code splitting
- [x] Rodando via Dokploy na VPS (porta interna 3000)

---

## 🔒 Varredura 23/11/2026 — o que foi corrigido

Testado com 67 cenários (32 ataques + 35 fluxos legítimos) aplicando todas as migrations num Postgres 17 local com shim do Supabase. **Antes da 0013: 23 ataques funcionavam e 9 fluxos legítimos falhavam. Depois: 67/67 OK.**

### Banco — migration `0013_security_hardening.sql`
- [x] **Crítico:** usuário podia se promover a admin / se cadastrar como admin / se reativar após suspenso → trigger `guard_profile_changes`
- [x] Contas pendentes/suspensas perdem acesso a dados (`current_papel()` só vale para ativos)
- [x] Rep criava caso em lead alheio, já "liberado" ou com advogado escolhido → policy `casos_insert_scoped`
- [x] Advogado trocava `lead_id` do caso para ler lead de outro → trigger `guard_caso_changes`
- [x] Documento forjado dava acesso a arquivo de terceiros; upload em pasta alheia → path amarrado ao lead/caso acessível
- [x] `revenda_stats` ignorava RLS (anon via tudo) e somava faturamento em dobro → `security_invoker` + subqueries
- [x] `aceitar_convite` confiava no `user_id` do cliente → usa `auth.uid()` + email do `auth.users`; cria o profile se faltar
- [x] Rep/coord moviam lead para outra revenda/rep; notas, tarefas e docs em lead/caso alheio → `WITH CHECK`
- [x] Coord alterava nome/status da própria revenda; cor aceitava CSS arbitrário → trigger `guard_revenda_changes`
- [x] Funções `security definer` sem `search_path` fixo
- [x] Admin não via revenda suspensa (não conseguia reativar)
- [x] Rep/coord não viam nome do advogado nem notas/docs do caso; advogado não via docs do lead
- [x] Faltavam policies: excluir documento/tarefa, atualizar/excluir prazo, revogar convite

### Frontend
- [x] Rep que se cadastrava sozinho ficava **sem revenda** (nunca aparecia para o coord) → `revenda_id` no metadata do signUp
- [x] "Nova tarefa" sempre falhava (mandava o nome da empresa como `lead_id`)
- [x] Valores em formato BR: "48.000" era salvo como 48 → `parseBRL`
- [x] Prazos apareciam **um dia antes** (fuso UTC) → `parseDateOnly`
- [x] Horário de tarefa deslocado 3h (datetime-local sem fuso)
- [x] Wizard: retry criava lead duplicado; erros ignorados; descrição e WhatsApp do cliente eram descartados (agora viram a 1ª nota do caso)
- [x] Notas e documentos novos não apareciam sem trocar de aba; excluir documento deixava registro quebrado
- [x] Cache de dados vazava entre usuários na mesma aba após logout
- [x] Nome da revenda no topo vinha de mock; botão "Sair" da sidebar não funcionava
- [x] Nginx: headers de segurança não eram enviados no HTML; asset inexistente retornava HTML com 404

---

## 🔜 Próximos passos (por prioridade)

### 1. Imediato
- [x] Migrations 0009–0014 aplicadas em produção (23/11)
- [x] Smoke test dos fluxos no banco (19 cenários, 23/11): cadastro, aprovação, convite, desbloquear, documento, isolamento
- [ ] Smoke test pela UI logada (depende de login manual)
- [ ] Conferir em Authentication → Settings se **confirmação de email** está ligada (afeta o fluxo de convite — ver abaixo)

### 2. Bugs conhecidos ainda abertos
- [ ] **Convite com confirmação de email ligada:** sem sessão após o signUp, o RPC falha. Precisa de tela "aceitar convite" para usuário já logado e `emailRedirectTo` preservando `?invite=`. Mesmo caso: quem já tem conta não consegue aceitar convite
- [x] Travamento no load de auth (reproduzido em prod 23/11): `onAuthStateChange` não chama mais o Supabase dentro do callback — loadProfile adiado com setTimeout(0)
- [ ] Kanban sem update otimista nem tratamento de erro; mover para/de `travado` não cria/desvincula caso
- [ ] Caso `liberado` não atualiza o lead (fica `travado`) nem preenche `liberado_em`
- [ ] `sla_dias` / `dias_indicacao` nunca são calculados (sempre 0) — alerta de "parados > 5 dias" nunca dispara
- [ ] Urgência de tarefa é manual (não deriva de `quando`); KPIs "do mês" contam todo o período
- [ ] Wizard aberto por coord/admin só lista os próprios leads; pode criar 2º caso para lead que já teve caso
- [ ] Tema da revenda persiste na tela de login após logout
- [ ] `database.types.ts` desatualizado (faltam `notificacoes`, `aceites_termos`, RPCs) — daí os `as never`
- [ ] Erros ainda via `alert()` em coord/admin

### 3. Funcionalidades faltando
- [ ] UI de criar/editar **prazos** (Advogado)
- [ ] Criar tarefas/leads pelo Coord
- [ ] Honorários editáveis (hoje fixo em 20% na tela)
- [ ] Botões sem ação: Exportar (Rep/Admin), Ligar/WhatsApp/Email no lead, busca do Advogado e do wizard
- [ ] Admin → Configurações (hoje mock)
- [ ] Importar leads via CSV
- [ ] Detalhe do Representante (histórico)
- [ ] LGPD: export sem aceites/notificações/documentos; "excluir conta" não agenda exclusão real

### 4. Produção
- [ ] Domínio + SSL + URLs de redirect no Supabase (Auth) + Google OAuth de prod
- [ ] Emails transacionais (convite, notificações) — Edge Function + Resend
- [ ] Páginas de Termos de Uso e Política de Privacidade
- [ ] Backup, monitoramento (uptime/erros), CSP e HSTS
- [ ] Dockerfile falhar o build se `VITE_*` estiverem vazias

### 5. Polish
- [ ] Testes E2E (Playwright) + transformar a suíte de RLS em teste automatizado no repo
- [ ] Debounce/filtro nos canais realtime (hoje cada evento refaz a query inteira)
- [ ] Acessibilidade (WCAG AA)

---

## 📊 Progresso resumido

| Área | Status |
|---|---|
| Frontend (telas, visual, responsivo, DnD) | ✅ |
| Schema + RLS | ✅ após 0013 (pendente aplicar em prod) |
| Autenticação + convites | 🟡 falta fluxo com confirmação de email |
| Dados reais em todas as telas | 🟡 Prazos/Config/Tarefas do Coord incompletos |
| Documentos | ✅ |
| Notificações in-app | ✅ (email pendente) |
| LGPD | 🟡 falta textos legais e exclusão real |
| Deploy | 🟡 rodando; falta domínio/SSL/backup/monitoramento |
| Testes automatizados | ❌ |

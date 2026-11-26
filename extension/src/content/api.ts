// Acesso ao Supabase do Advox direto da extensão. Tudo passa pelas mesmas
// policies RLS do app web: o representante só vê e altera os próprios leads.
import { createClient, type Session } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// A sessão vive no chrome.storage: o localStorage da página é do WhatsApp.
const storageChrome = {
  getItem: (k: string) => new Promise<string | null>((r) => chrome.storage.local.get(k, (res) => r((res[k] as string) ?? null))),
  setItem: (k: string, v: string) => new Promise<void>((r) => chrome.storage.local.set({ [k]: v }, () => r())),
  removeItem: (k: string) => new Promise<void>((r) => chrome.storage.local.remove(k, () => r())),
};

export const sb = createClient(URL, KEY, {
  auth: { storage: storageChrome, storageKey: 'advox_sessao', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export const APP_URL = 'https://app.advoxtelecom.com.br';

export type Perfil = { id: string; nome: string; papel: string; status: string; revenda_id: string | null };
export type Lead = {
  id: string; empresa: string; contato: string; telefone: string | null; email: string | null;
  operadora: string; valor: number; status: string; fim_fidelidade: string | null;
  motivo_perda: string | null; advox_caso_id: string | null; cidade: string | null; uf: string | null;
  rep_id: string; created_at: string;
};
export type Nota = { id: string; texto: string; tipo: string; created_at: string };
export type Tarefa = { id: string; descricao: string; quando: string | null; tipo: string; completed: boolean };

export const ETAPAS = [
  { id: 'novo', label: 'Novo Lead' },
  { id: 'contato', label: 'Em Contato' },
  { id: 'proposta', label: 'Proposta Enviada' },
  { id: 'travado', label: 'Travado (Advox)' },
  { id: 'aguardando', label: 'Aguardando Liberação' },
  { id: 'negociacao', label: 'Negociação Final' },
  { id: 'fechado', label: 'Fechado' },
  { id: 'perdido', label: 'Perdido' },
];
export const OPERADORAS = ['Vivo', 'TIM', 'Claro', 'Oi'];
export const MOTIVOS_PERDA = [
  'Preço / proposta não competitiva', 'Ficou na operadora atual', 'Multa de fidelidade alta',
  'Sem retorno do cliente', 'Fechou com concorrente', 'Sem perfil / não qualificado', 'Outro',
];
export const TIPOS_ATIVIDADE = [
  { id: 'ligacao', label: 'Ligação' }, { id: 'whatsapp', label: 'WhatsApp' }, { id: 'visita', label: 'Visita' },
  { id: 'reuniao', label: 'Reunião' }, { id: 'email', label: 'E-mail' }, { id: 'tarefa', label: 'Tarefa' },
];

const msg = (e: { message?: string } | null | undefined) => e?.message ?? 'Erro desconhecido';

// ─────────────── Sessão ───────────────

export async function sessaoAtual(): Promise<Session | null> {
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function entrar(email: string, senha: string): Promise<string | null> {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (!error) return null;
  if (/invalid login/i.test(error.message)) return 'E-mail ou senha incorretos.';
  return error.message;
}

export async function sair() { await sb.auth.signOut(); }

export async function meuPerfil(userId: string): Promise<Perfil | null> {
  const { data } = await sb.from('profiles').select('id, nome, papel, status, revenda_id').eq('id', userId).maybeSingle();
  return (data as Perfil | null) ?? null;
}

export async function nomeDaRevenda(id: string): Promise<string | null> {
  const { data } = await sb.from('revendas').select('nome').eq('id', id).maybeSingle();
  return (data as { nome: string } | null)?.nome ?? null;
}

// ─────────────── Telefone ───────────────

/** Só dígitos; BR sem DDI (10/11) ganha 55 — igual a public.normaliza_telefone. */
export function normalizaTelefone(v: string | null | undefined): string | null {
  const d = (v ?? '').replace(/\D/g, '');
  if (!d) return null;
  return d.length === 10 || d.length === 11 ? '55' + d : d;
}

/** Variações com e sem o 9º dígito (o WhatsApp de números antigos vem sem o 9). */
export function variantesTelefone(v: string): string[] {
  const d = normalizaTelefone(v);
  if (!d) return [];
  const out = new Set([d]);
  if (d.startsWith('55') && d.length === 13 && d[4] === '9') out.add(d.slice(0, 4) + d.slice(5));
  if (d.startsWith('55') && d.length === 12) out.add(d.slice(0, 4) + '9' + d.slice(4));
  return [...out];
}

export function fmtTelefone(v: string | null | undefined): string {
  const d = (v ?? '').replace(/\D/g, '');
  const n = d.startsWith('55') && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return v ? `+${d}` : '';
}

export function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function parseBRL(v: string): number {
  const s = (v ?? '').replace(/[^\d.,]/g, '');
  if (!s) return 0;
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /\.\d{3}$/.test(s) ? s.replace(/\./g, '') : s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
}

// ─────────────── Leads ───────────────

const LEAD_COLS = 'id, empresa, contato, telefone, email, operadora, valor, status, fim_fidelidade, motivo_perda, advox_caso_id, cidade, uf, rep_id, created_at';

export async function leadPorTelefone(telefone: string): Promise<Lead | null> {
  const vs = variantesTelefone(telefone);
  if (!vs.length) return null;
  const { data, error } = await sb.from('leads').select(LEAD_COLS).in('telefone', vs).order('updated_at', { ascending: false }).limit(1);
  if (error) { console.error('[Advox] leadPorTelefone', error); return null; }
  return (data?.[0] as Lead | undefined) ?? null;
}

export async function buscarLeads(termo: string): Promise<Lead[]> {
  const t = termo.trim().replace(/[%,()]/g, ' ');
  if (t.length < 2) return [];
  const { data } = await sb.from('leads').select(LEAD_COLS).or(`empresa.ilike.%${t}%,contato.ilike.%${t}%`).order('updated_at', { ascending: false }).limit(8);
  return (data as Lead[] | null) ?? [];
}

export async function criarLead(perfil: Perfil, campos: { empresa: string; contato: string; telefone: string; operadora: string; valor: number; fim_fidelidade: string | null }): Promise<{ lead?: Lead; erro?: string }> {
  if (!perfil.revenda_id) return { erro: 'Sua conta não está vinculada a uma revenda.' };
  const { data, error } = await sb.from('leads').insert({
    ...campos, telefone: normalizaTelefone(campos.telefone), status: 'novo', origem: 'WhatsApp',
    rep_id: perfil.id, revenda_id: perfil.revenda_id,
  }).select(LEAD_COLS).single();
  return error ? { erro: msg(error) } : { lead: data as Lead };
}

/** Vincula o telefone da conversa a um lead que já existia sem WhatsApp. */
export async function vincularTelefone(leadId: string, telefone: string): Promise<string | null> {
  const { error } = await sb.from('leads').update({ telefone: normalizaTelefone(telefone) }).eq('id', leadId);
  return error ? msg(error) : null;
}

export async function moverLead(leadId: string, status: string, motivo?: string): Promise<string | null> {
  const { error } = await sb.from('leads').update({ status, motivo_perda: status === 'perdido' ? motivo ?? null : null }).eq('id', leadId);
  return error ? msg(error) : null;
}

// ─────────────── Histórico e atividades ───────────────

export async function notasDoLead(leadId: string): Promise<Nota[]> {
  const { data } = await sb.from('notas').select('id, texto, tipo, created_at').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(5);
  return (data as Nota[] | null) ?? [];
}

export async function criarNota(perfil: Perfil, leadId: string, texto: string, tipo = 'whatsapp'): Promise<string | null> {
  const { error } = await sb.from('notas').insert({ lead_id: leadId, autor_id: perfil.id, texto, tipo, interno: false });
  return error ? msg(error) : null;
}

export async function proximaAtividade(leadId: string): Promise<Tarefa | null> {
  const { data } = await sb.from('tarefas').select('id, descricao, quando, tipo, completed').eq('lead_id', leadId).eq('completed', false).order('quando', { ascending: true, nullsFirst: false }).limit(1);
  return (data?.[0] as Tarefa | undefined) ?? null;
}

export async function criarAtividade(perfil: Perfil, leadId: string, a: { descricao: string; tipo: string; quando: string | null }): Promise<string | null> {
  const { error } = await sb.from('tarefas').insert({
    autor_id: perfil.id, lead_id: leadId, descricao: a.descricao, tipo: a.tipo,
    quando: a.quando ? new Date(a.quando).toISOString() : null, prioridade: 'media', urgencia: 'hoje',
  });
  return error ? msg(error) : null;
}

// ─────────────── Jurídico (mesmo fluxo do wizard Desbloquear Cliente) ───────────────

export async function indicarAoJuridico(perfil: Perfil, lead: Lead, d: { tipo: string; multa: number; descricao: string }): Promise<{ casoId?: string; erro?: string }> {
  const { error: e1 } = await sb.from('leads').update({ status: 'travado', motivo_perda: null }).eq('id', lead.id);
  if (e1) return { erro: `Falha ao atualizar o lead: ${msg(e1)}` };
  const { data: caso, error: e2 } = await sb.from('casos').insert({
    lead_id: lead.id, status: 'recebido', tipo: d.tipo, multa: d.multa, sla_dias: 0, dias_indicacao: 0,
    prox_passo: 'Aguardando atribuição de advogado',
  }).select('id').single();
  if (e2 || !caso) return { erro: `Falha ao criar o caso: ${msg(e2)}` };
  const { error: e3 } = await sb.from('leads').update({ advox_caso_id: caso.id }).eq('id', lead.id);
  if (e3) console.error('[Advox] vincular caso', e3);
  const contexto = [d.descricao.trim(), lead.telefone && `WhatsApp do cliente: ${fmtTelefone(lead.telefone)}`, 'Indicado pela extensão do WhatsApp.'].filter(Boolean).join('\n\n');
  await sb.from('notas').insert({ caso_id: caso.id, autor_id: perfil.id, texto: contexto, tipo: 'nota', interno: false });
  return { casoId: caso.id as string };
}

// ─────────────── Fidelidade ───────────────

export function diasParaFidelidade(fim: string | null): number | null {
  if (!fim) return null;
  const [y, m, d] = fim.split('-').map(Number);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - hoje.getTime()) / 86400000);
}

// ─────────────── Pastas de conversas (salvas no servidor) ───────────────

export type Pasta = { id: string; nome: string; cor: string; ordem: number };
export type ConversaPasta = { pasta_id: string; chat_id: string; telefone: string | null; nome: string | null };
export type Categoria = { id: string; dono_id: string; revenda_id: string | null; nome: string; cor: string; ordem: number };
export type MensagemRapida = {
  id: string; dono_id: string; revenda_id: string | null; categoria_id: string | null;
  titulo: string; atalho: string | null; texto: string; ordem: number; usos: number;
};

export async function listarPastas(): Promise<Pasta[]> {
  const { data } = await sb.from('wa_pastas').select('id, nome, cor, ordem').order('ordem').order('created_at');
  return (data as Pasta[] | null) ?? [];
}

export async function listarConversasPastas(): Promise<ConversaPasta[]> {
  const { data } = await sb.from('wa_pasta_conversas').select('pasta_id, chat_id, telefone, nome');
  return (data as ConversaPasta[] | null) ?? [];
}

export async function criarPasta(nome: string, cor: string, ordem: number): Promise<{ id?: string; erro?: string }> {
  const { data, error } = await sb.from('wa_pastas').insert({ nome: nome.trim(), cor, ordem }).select('id').single();
  return error ? { erro: msg(error) } : { id: (data as { id: string }).id };
}

export async function editarPasta(id: string, patch: Partial<Pick<Pasta, 'nome' | 'cor' | 'ordem'>>): Promise<string | null> {
  const { error } = await sb.from('wa_pastas').update(patch).eq('id', id);
  return error ? msg(error) : null;
}

export async function excluirPasta(id: string): Promise<string | null> {
  const { error } = await sb.from('wa_pastas').delete().eq('id', id);
  return error ? msg(error) : null;
}

export async function colocarNaPasta(pastaId: string, c: { chatId: string; telefone: string | null; nome: string }): Promise<string | null> {
  const { error } = await sb.from('wa_pasta_conversas').upsert({ pasta_id: pastaId, chat_id: c.chatId, telefone: c.telefone, nome: c.nome });
  return error ? msg(error) : null;
}

export async function tirarDaPasta(pastaId: string, chatId: string): Promise<string | null> {
  const { error } = await sb.from('wa_pasta_conversas').delete().eq('pasta_id', pastaId).eq('chat_id', chatId);
  return error ? msg(error) : null;
}

// ─────────────── Mensagens rápidas e categorias (salvas no servidor) ───────────────

export async function listarCategorias(): Promise<Categoria[]> {
  const { data } = await sb.from('mensagens_categorias').select('id, dono_id, revenda_id, nome, cor, ordem').order('ordem').order('nome');
  return (data as Categoria[] | null) ?? [];
}

export async function salvarCategoria(c: { id?: string; nome: string; cor: string; revenda_id: string | null; ordem?: number }): Promise<{ id?: string; erro?: string }> {
  const campos: Record<string, unknown> = { nome: c.nome.trim(), cor: c.cor, revenda_id: c.revenda_id };
  if (c.ordem !== undefined) campos.ordem = c.ordem;
  const r = c.id
    ? await sb.from('mensagens_categorias').update(campos).eq('id', c.id).select('id').single()
    : await sb.from('mensagens_categorias').insert(campos).select('id').single();
  return r.error ? { erro: msg(r.error) } : { id: (r.data as { id: string }).id };
}

export async function excluirCategoria(id: string): Promise<string | null> {
  const { error } = await sb.from('mensagens_categorias').delete().eq('id', id);
  return error ? msg(error) : null;
}

export async function listarMensagens(): Promise<MensagemRapida[]> {
  const { data } = await sb.from('mensagens_rapidas')
    .select('id, dono_id, revenda_id, categoria_id, titulo, atalho, texto, ordem, usos')
    .order('ordem').order('titulo');
  return (data as MensagemRapida[] | null) ?? [];
}

export async function salvarMensagem(m: {
  id?: string; titulo: string; atalho: string | null; texto: string; revenda_id: string | null; categoria_id: string | null;
}): Promise<string | null> {
  const campos = {
    titulo: m.titulo.trim(), atalho: m.atalho?.trim().toLowerCase() || null, texto: m.texto,
    revenda_id: m.revenda_id, categoria_id: m.categoria_id,
  };
  const { error } = m.id
    ? await sb.from('mensagens_rapidas').update(campos).eq('id', m.id)
    : await sb.from('mensagens_rapidas').insert(campos);
  if (error && /atalho_check|check constraint/i.test(error.message)) return 'Atalho inválido: use só letras minúsculas, números, - ou _ (até 20).';
  return error ? msg(error) : null;
}

export async function excluirMensagem(id: string): Promise<string | null> {
  const { error } = await sb.from('mensagens_rapidas').delete().eq('id', id);
  return error ? msg(error) : null;
}

/** Soma 1 no contador da mensagem (filtro "Usadas"). */
export async function marcarUso(id: string) {
  await sb.rpc('mensagem_usada', { p_id: id });
}

/** Avisa quando pastas, conversas, categorias ou mensagens mudarem (neste ou em outro computador). */
export function observarDados(cb: () => void): () => void {
  const ch = sb.channel(`advox-ext-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_pastas' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_pasta_conversas' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens_rapidas' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens_categorias' }, cb)
    .subscribe();
  return () => { sb.removeChannel(ch); };
}

// ─────────────── Contatos do WhatsApp (painel AdvoxChat → Contatos) ───────────────

export type ContatoWa = { id: string; interesses: string | null; ultimo_contato: string };

/** Toda conversa aberta (não grupo) vira contato no painel, como no BuildChat. */
export async function registrarContatoWa(c: { chatId: string; nome: string; telefone: string | null }): Promise<ContatoWa | null> {
  const { data, error } = await sb.from('wa_contatos')
    .upsert({ chat_id: c.chatId, nome: c.nome || null, telefone: normalizaTelefone(c.telefone), ultimo_contato: new Date().toISOString() }, { onConflict: 'dono_id,chat_id' })
    .select('id, interesses, ultimo_contato').single();
  if (error) { console.warn('[Advox] registrarContatoWa', error.message); return null; }
  return data as ContatoWa;
}

export async function salvarInteresses(id: string, interesses: string): Promise<string | null> {
  const { error } = await sb.from('wa_contatos').update({ interesses: interesses.trim() || null }).eq('id', id);
  return error ? msg(error) : null;
}

/**
 * Abre o Painel AdvoxChat já logado. A aba nasce ANTES do await (o clique
 * ainda vale como gesto e o Chrome não bloqueia); a Edge Function devolve um
 * link de uso único e o painel troca por uma sessão própria.
 */
export async function abrirPainel(aba = 'contatos') {
  const janela = window.open('about:blank', '_blank');
  const base = `${APP_URL}/?painel=advoxchat&aba=${encodeURIComponent(aba)}`;
  let url = base;
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      const r = await fetch(`${URL}/functions/v1/painel-sessao`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: KEY, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.token_hash) url = `${base}#advox_th=${encodeURIComponent(j.token_hash)}`;
    }
  } catch (e) { console.warn('[Advox] abrirPainel', e); }
  if (janela) janela.location.href = url; else window.open(url, '_blank');
}

/** {{nome}}, {{empresa}}, {{operadora}}, {{eu}} */
export function aplicarVariaveis(t: string, v: Record<string, string>) {
  return t.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? '');
}

// ─────────────── Minha Agenda (mesmas tabelas do app: tarefas e anotacoes) ───────────────

export type Atividade = {
  id: string; descricao: string; quando: string | null; tipo: string; completed: boolean;
  lead_id: string | null; autor_id: string;
  lead: { id: string; empresa: string; contato: string | null } | null;
  autor: { id: string; nome: string } | null;
};

/** Cor de cada etiqueta (tipo de atividade) — a mesma paleta do app. */
export const COR_TIPO: Record<string, string> = {
  ligacao: '#2563eb', whatsapp: '#16a34a', visita: '#7c3aed', reuniao: '#d97706', email: '#0d9488', tarefa: '#64748b',
};
export const rotuloTipo = (t: string) => TIPOS_ATIVIDADE.find((x) => x.id === t)?.label ?? t;

/** "eu" = só as minhas; "time" = tudo que a RLS deixa ver (coordenador vê o time). */
export async function listarAgenda(perfil: Perfil, escopo: 'eu' | 'time'): Promise<Atividade[]> {
  let q = sb.from('tarefas')
    .select('id, descricao, quando, tipo, completed, lead_id, autor_id, lead:leads(id, empresa, contato), autor:profiles!tarefas_autor_id_fkey(id, nome)')
    .order('quando', { ascending: true, nullsFirst: false })
    .limit(1000);
  if (escopo === 'eu') q = q.eq('autor_id', perfil.id);
  const { data, error } = await q;
  if (error) { console.error('[Advox] agenda', error); return []; }
  return (data as unknown as Atividade[]) ?? [];
}

export async function salvarAtividade(perfil: Perfil, a: { id?: string; descricao: string; tipo: string; quando: string | null; lead_id: string | null }): Promise<string | null> {
  const campos = { descricao: a.descricao, tipo: a.tipo, quando: a.quando, lead_id: a.lead_id };
  const { error } = a.id
    ? await sb.from('tarefas').update(campos).eq('id', a.id)
    : await sb.from('tarefas').insert({ ...campos, autor_id: perfil.id, prioridade: 'media', urgencia: 'hoje' });
  return error ? msg(error) : null;
}

export async function concluirAtividade(id: string, feito: boolean): Promise<string | null> {
  const { error } = await sb.from('tarefas').update({ completed: feito, completed_at: feito ? new Date().toISOString() : null }).eq('id', id);
  return error ? msg(error) : null;
}

export async function apagarAtividade(id: string): Promise<string | null> {
  const { error } = await sb.from('tarefas').delete().eq('id', id);
  return error ? msg(error) : null;
}

export type Anotacao = { id: string; titulo: string; conteudo: string; categoria: string | null; updated_at: string };

export async function listarAnotacoes(): Promise<Anotacao[]> {
  const { data, error } = await sb.from('anotacoes').select('id, titulo, conteudo, categoria, updated_at').order('updated_at', { ascending: false });
  if (error) console.error('[Advox] anotacoes', error);
  return (data as Anotacao[] | null) ?? [];
}

export async function salvarAnotacao(perfil: Perfil, n: { id?: string; titulo: string; conteudo: string; categoria: string | null }): Promise<{ id?: string; erro?: string }> {
  const campos = { titulo: n.titulo, conteudo: n.conteudo, categoria: n.categoria };
  const { data, error } = n.id
    ? await sb.from('anotacoes').update(campos).eq('id', n.id).select('id').single()
    : await sb.from('anotacoes').insert({ ...campos, dono_id: perfil.id }).select('id').single();
  return error ? { erro: msg(error) } : { id: (data as { id: string }).id };
}

export async function apagarAnotacao(id: string): Promise<string | null> {
  const { error } = await sb.from('anotacoes').delete().eq('id', id);
  return error ? msg(error) : null;
}

// ─────────────── Transcrição de áudio (Edge Function "transcrever") ───────────────

const LIMITE_AUDIO = 25 * 1024 * 1024;

/** Manda o áudio e devolve o texto. Erros sobem com a mensagem amigável. */
export async function transcreverAudio(audio: Blob): Promise<string> {
  if (audio.size === 0) throw new Error('Não consegui ler este áudio. Toque nele uma vez e tente de novo.');
  if (audio.size > LIMITE_AUDIO) throw new Error('Áudio maior que 25 MB.');
  const token = (await sessaoAtual())?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre de novo na sua conta.');

  const corpo = new FormData();
  corpo.append('file', audio, 'audio.ogg');
  const r = await fetch(`${URL}/functions/v1/transcrever`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: KEY },
    body: corpo,
  });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; texto?: string; erro?: string } | null;
  if (j?.ok && j.texto?.trim()) return j.texto.trim();
  if (j?.erro) throw new Error(j.erro);
  if (r.status === 401) throw new Error('Sessão expirada. Entre de novo na sua conta.');
  throw new Error(`Falha ao transcrever (${r.status}).`);
}

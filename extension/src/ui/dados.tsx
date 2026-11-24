// Estado da extensão: pastas, conversas nas pastas, categorias e mensagens
// rápidas (tudo do servidor, em tempo real) + a conversa aberta e o lead dela.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  listarPastas, listarConversasPastas, listarMensagens, listarCategorias, observarDados, leadPorTelefone, registrarContatoWa, type ContatoWa,
  type Pasta, type ConversaPasta, type MensagemRapida, type Categoria, type Perfil, type Lead,
} from '@/content/api';
import { contatoAtivo, observarConversa, type Contato } from '@/content/wa';
import { soDigitos } from '@/lib/utils';

export type Variaveis = Record<'nome' | 'empresa' | 'operadora' | 'eu', string>;

type Dados = {
  perfil: Perfil;
  pastas: Pasta[];
  conversas: ConversaPasta[];
  categorias: Categoria[];
  mensagens: MensagemRapida[];
  carregado: boolean;
  recarregar: () => void;
  /** Quantas conversas há em cada pasta. */
  contagem: Record<string, number>;
  /** Pastas em que uma conversa está (casando pelo id do WhatsApp ou pelo telefone). */
  pastasDaConversa: (chatId: string, telefone: string | null) => string[];
  contato: Contato | null;
  /** undefined = procurando; null = conversa sem lead no Advox. */
  lead: Lead | null | undefined;
  recarregarLead: () => void;
  vars: Variaveis;
  /** Registro da conversa no painel AdvoxChat (interesses etc.). */
  contatoWa: ContatoWa | null;
};

const Ctx = createContext<Dados | null>(null);

export function useDados(): Dados {
  const d = useContext(Ctx);
  if (!d) throw new Error('useDados fora do DadosProvider');
  return d;
}

export function DadosProvider({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [conversas, setConversas] = useState<ConversaPasta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [mensagens, setMensagens] = useState<MensagemRapida[]>([]);
  const [carregado, setCarregado] = useState(false);

  const recarregar = useCallback(() => {
    Promise.all([listarPastas(), listarConversasPastas(), listarCategorias(), listarMensagens()]).then(([p, c, cat, m]) => {
      setPastas(p); setConversas(c); setCategorias(cat); setMensagens(m); setCarregado(true);
    });
  }, []);

  useEffect(() => {
    recarregar();
    let timer = 0;
    // Várias mudanças seguidas (ex.: excluir pasta com conversas) viram uma recarga só.
    const parar = observarDados(() => { window.clearTimeout(timer); timer = window.setTimeout(recarregar, 300); });
    window.addEventListener('focus', recarregar);
    return () => { parar(); window.clearTimeout(timer); window.removeEventListener('focus', recarregar); };
  }, [recarregar]);

  const contagem = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of conversas) out[c.pasta_id] = (out[c.pasta_id] ?? 0) + 1;
    return out;
  }, [conversas]);

  const pastasDaConversa = useCallback((chatId: string, telefone: string | null) => {
    const tel = soDigitos(telefone);
    return [...new Set(conversas
      .filter((c) => c.chat_id === chatId || (tel.length >= 8 && soDigitos(c.telefone) === tel))
      .map((c) => c.pasta_id))];
  }, [conversas]);

  // ── Conversa aberta + lead ──
  const [contato, setContato] = useState<Contato | null>(null);
  const [lead, setLead] = useState<Lead | null | undefined>(undefined);

  useEffect(() => {
    contatoAtivo().then(setContato);
    return observarConversa(setContato);
  }, []);

  const recarregarLead = useCallback(async () => {
    if (!contato?.telefone || contato.ehGrupo) { setLead(null); return; }
    setLead(await leadPorTelefone(contato.telefone));
  }, [contato?.telefone, contato?.ehGrupo]);

  useEffect(() => { setLead(undefined); recarregarLead(); }, [recarregarLead]);

  // Regra do CRM (igual ao BuildChat): conversa aberta vira contato no painel.
  const [contatoWa, setContatoWa] = useState<ContatoWa | null>(null);
  useEffect(() => {
    setContatoWa(null);
    if (!contato || contato.ehGrupo || !contato.chatId.includes('@')) return;
    let vivo = true;
    registrarContatoWa(contato).then((c) => vivo && setContatoWa(c));
    return () => { vivo = false; };
  }, [contato?.chatId]);
  // O que muda no app web aparece aqui: recarrega ao voltar para a aba e a cada 30s.
  useEffect(() => {
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') recarregarLead(); }, 30000);
    window.addEventListener('focus', recarregarLead);
    return () => { window.clearInterval(t); window.removeEventListener('focus', recarregarLead); };
  }, [recarregarLead]);

  const vars = useMemo<Variaveis>(() => ({
    nome: (lead?.contato || contato?.nome || '').split(' ')[0],
    empresa: lead?.empresa ?? '',
    operadora: lead?.operadora ?? 'operadora atual',
    eu: perfil.nome.split(' ')[0],
  }), [lead?.contato, lead?.empresa, lead?.operadora, contato?.nome, perfil.nome]);

  const valor = useMemo<Dados>(() => ({
    perfil, pastas, conversas, categorias, mensagens, carregado, recarregar, contagem, pastasDaConversa,
    contato, lead, recarregarLead, vars, contatoWa,
  }), [perfil, pastas, conversas, categorias, mensagens, carregado, recarregar, contagem, pastasDaConversa, contato, lead, recarregarLead, vars, contatoWa]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

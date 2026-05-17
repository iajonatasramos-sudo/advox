export type Stage = {
  id: string;
  label: string;
  color: string;
};

export type Lead = {
  id: string;
  empresa: string;
  contato: string;
  cnpj: string;
  cidade: string;
  uf: string;
  operadora: string;
  valor: number;
  status: string;
  proximo: string;
  tag: string;
  origem: string;
  advoxCaso?: string;
  rep: string;
  revenda: string;
};

export type Caso = {
  id: string;
  leadId: string;
  cliente: string;
  contato: string;
  uf: string;
  operadora: string;
  multa: number;
  tipo: string;
  status: string;
  valor?: number;
  diasIndicacao: number;
  rep: string;
  advogado: string;
  sla: number;
  prox: string;
  liberadoEm?: string;
};

export type Tarefa = {
  id: string;
  desc: string;
  lead: string;
  leadId: string;
  quando: string;
  prioridade: "alta" | "média" | "baixa";
  atrasada: boolean;
  hoje: boolean;
  urg: "hoje" | "atrasada" | "semana" | "proxima";
};

export type Notif = {
  id: string;
  tipo: "caso" | "tarefa" | "mensagem" | "sistema";
  texto: string;
  quando: string;
  lida: boolean;
};

export type Advogado = {
  id: string;
  nome: string;
  oab: string;
  uf: string;
  atribuidos: number;
  resolvidos: number;
  tempoMedio: number;
  status: "Ativo" | "Suspenso";
};

export type Representante = {
  id: string;
  nome: string;
  revenda: string;
  uf: string;
  cidade: string;
  operadoras: string[];
  leads: number;
  indicados: number;
  status: "Ativo" | "Pendente" | "Suspenso";
  desde: string;
};

export type Auditoria = {
  id: string;
  quem: string;
  papel: string;
  acao: string;
  alvo: string;
  quando: string;
  detalhe: string;
};

export type Prazo = {
  id: string;
  caso: string;
  cliente: string;
  tipo: string;
  data: string;
  em: string;
  urg: "hoje" | "semana" | "proximas";
};

export type Persona = "rep" | "coord" | "adv" | "admin";

export type User = {
  nome: string;
  papel: string;
  email: string;
  revenda?: string;
  oab?: string;
  uf: string;
  whats: string;
};

export type KpiCard = {
  label: string;
  valor: string;
  delta: string;
  trend: "up" | "down" | "neutral";
};

export const PIPELINE_COMERCIAL: Stage[] = [
  { id: "novo",        label: "Novo Lead",            color: "var(--pc-novo)" },
  { id: "contato",     label: "Em Contato",           color: "var(--pc-contato)" },
  { id: "proposta",    label: "Proposta Enviada",     color: "var(--pc-proposta)" },
  { id: "travado",     label: "Travado (Advox)",      color: "var(--pc-travado)" },
  { id: "aguardando",  label: "Aguardando Liberação", color: "var(--pc-aguardando)" },
  { id: "negociacao",  label: "Negociação Final",     color: "var(--pc-negociacao)" },
  { id: "fechado",     label: "Fechado",              color: "var(--pc-fechado)" },
  { id: "perdido",     label: "Perdido",              color: "var(--pc-perdido)" },
];

export const PIPELINE_JURIDICO: Stage[] = [
  { id: "recebido",      label: "Lead Recebido",       color: "var(--pj-recebido)" },
  { id: "analise",       label: "Em Análise",          color: "var(--pj-analise)" },
  { id: "contato",       label: "Contato Inicial",     color: "var(--pj-contato)" },
  { id: "honorarios",    label: "Proposta Honorários", color: "var(--pj-honorarios)" },
  { id: "contratou",     label: "Cliente Contratou",   color: "var(--pj-contratou)" },
  { id: "documentacao",  label: "Documentação",        color: "var(--pj-documentacao)" },
  { id: "extrajudicial", label: "Extrajudicial",       color: "var(--pj-extrajudicial)" },
  { id: "judicial",      label: "Judicial",            color: "var(--pj-judicial)" },
  { id: "liberado",      label: "Liberado",            color: "var(--pj-liberado)" },
  { id: "naoliberado",   label: "Não Liberado",        color: "var(--pj-naoliberado)" },
  { id: "recusou",       label: "Recusou",             color: "var(--pj-recusou)" },
];

export const OPERADORAS = ["Vivo", "TIM", "Claro", "Oi"];

export const fmtBRL = (n: number) =>
  "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const fmtBRLDec = (n: number) =>
  "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

export const LEADS: Lead[] = [
  { id: "L-2841", empresa: "Construtora Vértice Sul", contato: "Mariana Albuquerque", cnpj: "32.481.902/0001-44", cidade: "Florianópolis", uf: "SC", operadora: "Vivo", valor: 48000, status: "novo",       proximo: "Hoje 14:30", tag: "Pós-pago", origem: "Indicação", rep: "Lucas Ferreira",  revenda: "Conecta Sul Telecom" },
  { id: "L-2840", empresa: "Logística Mont Blanc",    contato: "Roberto Fonseca",     cnpj: "11.227.554/0001-08", cidade: "Curitiba",       uf: "PR", operadora: "TIM",  valor: 72500, status: "novo",       proximo: "Hoje 16:00", tag: "Frota M2M", origem: "Landing", rep: "Marina Carvalho", revenda: "Conecta Sul Telecom" },
  { id: "L-2839", empresa: "Distribuidora Atlas",     contato: "Patrícia Loureiro",   cnpj: "08.992.111/0001-91", cidade: "Belo Horizonte", uf: "MG", operadora: "Claro", valor: 31200, status: "contato",    proximo: "Amanhã 09:00", tag: "Pós-pago", origem: "Cold call", rep: "Pedro Henrique",  revenda: "Conecta Sul Telecom" },
  { id: "L-2838", empresa: "Engevix Engenharia",      contato: "Henrique Sanches",    cnpj: "55.301.882/0001-22", cidade: "São Paulo",      uf: "SP", operadora: "Vivo",  valor: 124000, status: "contato",   proximo: "Sex 10:30", tag: "Corporate", origem: "Inbound", rep: "Lucas Ferreira",  revenda: "Conecta Sul Telecom" },
  { id: "L-2837", empresa: "Hospital Santa Lúcia",    contato: "Dra. Vânia Mendes",   cnpj: "44.118.207/0001-55", cidade: "Salvador",       uf: "BA", operadora: "Oi",    valor: 89000, status: "proposta",   proximo: "Seg 11:00", tag: "Hospitalar", origem: "Indicação", rep: "Marina Carvalho", revenda: "Conecta Sul Telecom" },
  { id: "L-2836", empresa: "Têxtil Riograndense",     contato: "Cláudio Berger",      cnpj: "12.998.301/0001-77", cidade: "Porto Alegre",   uf: "RS", operadora: "TIM",   valor: 56400, status: "proposta",   proximo: "Hoje 17:30", tag: "Pós-pago", origem: "Landing", rep: "Pedro Henrique",  revenda: "Conecta Sul Telecom" },
  { id: "L-2835", empresa: "Frigorífico Pampa",       contato: "Olívia Coutinho",     cnpj: "09.844.661/0001-12", cidade: "Bagé",           uf: "RS", operadora: "Vivo",  valor: 142000, status: "travado",   proximo: "—",          tag: "Multa rescisória", origem: "Cold call", advoxCaso: "C-1089", rep: "Lucas Ferreira",  revenda: "Conecta Sul Telecom" },
  { id: "L-2834", empresa: "Construnorte Materiais",  contato: "Túlio Marques",       cnpj: "77.221.094/0001-33", cidade: "Manaus",         uf: "AM", operadora: "Claro", valor: 38500, status: "travado",    proximo: "—",          tag: "Fidelidade", origem: "Indicação", advoxCaso: "C-1088", rep: "Lucas Ferreira",  revenda: "Conecta Sul Telecom" },
  { id: "L-2833", empresa: "AgroFértil Cooperativa",  contato: "Lúcia Sperandio",     cnpj: "23.668.401/0001-09", cidade: "Cascavel",       uf: "PR", operadora: "Vivo",  valor: 98700, status: "aguardando", proximo: "—",          tag: "Renovação", origem: "Indicação", advoxCaso: "C-1087", rep: "Lucas Ferreira",  revenda: "Conecta Sul Telecom" },
  { id: "L-2832", empresa: "Posto Caminhos do Sul",   contato: "Rafael Ostrowski",    cnpj: "06.778.992/0001-41", cidade: "Lages",          uf: "SC", operadora: "TIM",   valor: 22800, status: "aguardando", proximo: "—",          tag: "Multa", origem: "Cold call", advoxCaso: "C-1086", rep: "Lucas Ferreira",  revenda: "Conecta Sul Telecom" },
  { id: "L-2831", empresa: "Editora Pampulha",        contato: "Beatriz Drummond",    cnpj: "55.992.013/0001-66", cidade: "Belo Horizonte", uf: "MG", operadora: "Oi",    valor: 41200, status: "negociacao", proximo: "Hoje 18:00", tag: "Migração", origem: "Inbound", rep: "Marina Carvalho", revenda: "Conecta Sul Telecom" },
  { id: "L-2830", empresa: "Distribuidora Norte Sul", contato: "Fernando Karam",      cnpj: "88.103.557/0001-72", cidade: "Recife",         uf: "PE", operadora: "Vivo",  valor: 67900, status: "negociacao", proximo: "Amanhã 15:00", tag: "Corporate", origem: "Indicação", rep: "Pedro Henrique",  revenda: "Conecta Sul Telecom" },
  { id: "L-2829", empresa: "Cerâmica Itacolomi",      contato: "Adriana Pessoa",      cnpj: "32.001.778/0001-50", cidade: "Vitória",        uf: "ES", operadora: "Claro", valor: 53000, status: "fechado",    proximo: "—",          tag: "Pós-pago", origem: "Landing", rep: "Aline Tavares",   revenda: "MaxRevenda" },
  { id: "L-2828", empresa: "Transportes Aurora",      contato: "Joaquim Vasques",     cnpj: "11.667.302/0001-19", cidade: "Goiânia",        uf: "GO", operadora: "Vivo",  valor: 84600, status: "fechado",    proximo: "—",          tag: "Frota M2M", origem: "Cold call", rep: "Sandra Bittencourt", revenda: "BSB Conecta" },
  { id: "L-2827", empresa: "Padaria Estrela Dalva",   contato: "Marcos Calheiros",    cnpj: "09.553.118/0001-87", cidade: "Aracaju",        uf: "SE", operadora: "Oi",    valor: 6800,  status: "perdido",    proximo: "—",          tag: "Pequeno porte", origem: "Cold call", rep: "Bruno Camargo",   revenda: "Telecom Sertão" },
];

export const CASOS: Caso[] = [
  { id: "C-1089", leadId: "L-2835", cliente: "Frigorífico Pampa",       contato: "Olívia Coutinho",  uf: "RS", operadora: "Vivo",  multa: 142000, tipo: "Multa rescisória",     status: "analise",      diasIndicacao: 1,  rep: "Lucas Ferreira", advogado: "Dra. Camila Soares",   sla: 1, prox: "Análise contratual" },
  { id: "C-1088", leadId: "L-2834", cliente: "Construnorte Materiais",  contato: "Túlio Marques",    uf: "AM", operadora: "Claro", multa: 38500,  tipo: "Fidelidade vencida",   status: "contato",      diasIndicacao: 3,  rep: "Lucas Ferreira", advogado: "Dr. Rodrigo Penteado", sla: 2, prox: "Aguardar resposta cliente" },
  { id: "C-1087", leadId: "L-2833", cliente: "AgroFértil Cooperativa",  contato: "Lúcia Sperandio",  uf: "PR", operadora: "Vivo",  multa: 98700,  tipo: "Renovação automática", status: "honorarios",   valor: 7400,  diasIndicacao: 6,  rep: "Lucas Ferreira", advogado: "Dra. Camila Soares",   sla: 6, prox: "Cliente decidir contratação" },
  { id: "C-1086", leadId: "L-2832", cliente: "Posto Caminhos do Sul",   contato: "Rafael Ostrowski", uf: "SC", operadora: "TIM",   multa: 22800,  tipo: "Multa rescisória",     status: "contratou",    diasIndicacao: 9,  rep: "Lucas Ferreira", advogado: "Dr. Rodrigo Penteado", sla: 2, prox: "Coletar procuração" },
  { id: "C-1085", leadId: "L-2820", cliente: "Mecânica BoaPraça",       contato: "Igor Almeida",     uf: "MG", operadora: "Vivo",  multa: 18200,  tipo: "Fidelidade",           status: "documentacao", diasIndicacao: 12, rep: "Aline Tavares",  advogado: "Dra. Camila Soares",   sla: 4, prox: "Reunir faturas 12m" },
  { id: "C-1084", leadId: "L-2818", cliente: "Cooperativa Vinícola Serra", contato: "Heitor Borghetti", uf: "RS", operadora: "Claro", multa: 64000, tipo: "Renovação automática", status: "extrajudicial", diasIndicacao: 18, rep: "Aline Tavares", advogado: "Dr. Rodrigo Penteado", sla: 3, prox: "Resposta da operadora" },
  { id: "C-1083", leadId: "L-2815", cliente: "Auto Posto Tropical",     contato: "Vinícius Faria",   uf: "BA", operadora: "Oi",    multa: 31000,  tipo: "Multa rescisória",     status: "judicial",     diasIndicacao: 24, rep: "Aline Tavares",  advogado: "Dra. Mariana Klemtz",  sla: 7, prox: "Audiência 22/05" },
  { id: "C-1082", leadId: "L-2810", cliente: "Indústria Plastex",       contato: "Sílvia Comte",     uf: "SP", operadora: "Vivo",  multa: 78400,  tipo: "Multa rescisória",     status: "liberado",     diasIndicacao: 28, rep: "Lucas Ferreira", advogado: "Dra. Camila Soares",   sla: 0, prox: "—", liberadoEm: "11/05/2026" },
  { id: "C-1081", leadId: "L-2808", cliente: "ProLog Cargas",           contato: "André Wenceslau",  uf: "PR", operadora: "TIM",   multa: 52000,  tipo: "Fidelidade",           status: "liberado",     diasIndicacao: 32, rep: "Aline Tavares",  advogado: "Dr. Rodrigo Penteado", sla: 0, prox: "—", liberadoEm: "08/05/2026" },
  { id: "C-1080", leadId: "L-2804", cliente: "Hortifrúti Bom Preço",    contato: "Janaína Galvão",   uf: "GO", operadora: "Oi",    multa: 9800,   tipo: "Renovação",            status: "naoliberado",  diasIndicacao: 41, rep: "Aline Tavares",  advogado: "Dra. Mariana Klemtz",  sla: 0, prox: "—" },
  { id: "C-1079", leadId: "L-2801", cliente: "Padaria Sol Nascente",    contato: "Eduardo Pieres",   uf: "RJ", operadora: "Claro", multa: 12400,  tipo: "Fidelidade",           status: "recusou",      diasIndicacao: 44, rep: "Lucas Ferreira", advogado: "—",                    sla: 0, prox: "—" },
];

export const TAREFAS: Tarefa[] = [
  { id: "T-501", desc: "Ligar para Mariana Albuquerque sobre proposta",      lead: "Construtora Vértice Sul",   leadId: "L-2841", quando: "Hoje, 14:30", prioridade: "alta",  atrasada: false, hoje: true,  urg: "hoje" },
  { id: "T-502", desc: "Enviar tabela de preços corporate por WhatsApp",     lead: "Engevix Engenharia",        leadId: "L-2838", quando: "Hoje, 16:00", prioridade: "média", atrasada: false, hoje: true,  urg: "hoje" },
  { id: "T-503", desc: "Confirmar reunião de fechamento",                    lead: "Distribuidora Norte Sul",   leadId: "L-2830", quando: "Hoje, 18:00", prioridade: "alta",  atrasada: false, hoje: true,  urg: "hoje" },
  { id: "T-504", desc: "Retornar ligação — Túlio (Construnorte)",            lead: "Construnorte Materiais",    leadId: "L-2834", quando: "Ontem",       prioridade: "alta",  atrasada: true,  hoje: false, urg: "atrasada" },
  { id: "T-505", desc: "Verificar status do caso jurídico C-1086",           lead: "Posto Caminhos do Sul",     leadId: "L-2832", quando: "Há 2 dias",   prioridade: "média", atrasada: true,  hoje: false, urg: "atrasada" },
  { id: "T-506", desc: "Enviar proposta revisada",                           lead: "Hospital Santa Lúcia",      leadId: "L-2837", quando: "Seg, 11:00",  prioridade: "alta",  atrasada: false, hoje: false, urg: "semana" },
  { id: "T-507", desc: "Reunião kick-off — migração",                        lead: "Editora Pampulha",          leadId: "L-2831", quando: "Qua, 09:30",  prioridade: "média", atrasada: false, hoje: false, urg: "semana" },
  { id: "T-508", desc: "Pedir documentos para indicação Advox",              lead: "Logística Mont Blanc",      leadId: "L-2840", quando: "Qui, 14:00",  prioridade: "baixa", atrasada: false, hoje: false, urg: "semana" },
  { id: "T-509", desc: "Revisar contrato Patrícia Loureiro",                 lead: "Distribuidora Atlas",       leadId: "L-2839", quando: "Próx semana", prioridade: "média", atrasada: false, hoje: false, urg: "proxima" },
];

export const NOTIFS: Notif[] = [
  { id: "N-1", tipo: "caso",     texto: "Caso C-1087 — AgroFértil avançou para Proposta Honorários",   quando: "há 14 min", lida: false },
  { id: "N-2", tipo: "tarefa",   texto: "Tarefa atrasada: Retornar ligação — Túlio (Construnorte)",     quando: "há 1h",     lida: false },
  { id: "N-3", tipo: "caso",     texto: "Cliente contratou: C-1086 — Posto Caminhos do Sul",            quando: "há 3h",     lida: false },
  { id: "N-4", tipo: "mensagem", texto: "Dra. Camila Soares deixou uma nota em C-1089",                 quando: "há 5h",     lida: true  },
  { id: "N-5", tipo: "sistema",  texto: "Cadastro aprovado em 24/04/2026 — bem-vindo ao Advox",         quando: "ontem",     lida: true  },
  { id: "N-6", tipo: "caso",     texto: "Caso C-1082 — Indústria Plastex foi liberado pelo escritório", quando: "ontem",     lida: true  },
  { id: "N-7", tipo: "tarefa",   texto: "3 tarefas para hoje no painel",                                quando: "ontem",     lida: true  },
];

export const ADVOGADOS: Advogado[] = [
  { id: "A-01", nome: "Dra. Camila Soares",     oab: "OAB/SP 412.118", uf: "SP", atribuidos: 14, resolvidos: 23, tempoMedio: 18, status: "Ativo" },
  { id: "A-02", nome: "Dr. Rodrigo Penteado",   oab: "OAB/RS 88.402",  uf: "RS", atribuidos: 11, resolvidos: 19, tempoMedio: 22, status: "Ativo" },
  { id: "A-03", nome: "Dra. Mariana Klemtz",    oab: "OAB/PR 67.011",  uf: "PR", atribuidos: 9,  resolvidos: 17, tempoMedio: 25, status: "Ativo" },
  { id: "A-04", nome: "Dr. Felipe Bittencourt", oab: "OAB/MG 142.005", uf: "MG", atribuidos: 6,  resolvidos: 12, tempoMedio: 20, status: "Ativo" },
  { id: "A-05", nome: "Dra. Joana Caldeira",    oab: "OAB/RJ 211.870", uf: "RJ", atribuidos: 0,  resolvidos: 3,  tempoMedio: 32, status: "Suspenso" },
];

export const REPRESENTANTES: Representante[] = [
  { id: "R-01", nome: "Lucas Ferreira",       revenda: "Conecta Sul Telecom", uf: "SC", cidade: "Florianópolis", operadoras: ["Vivo","TIM"],         leads: 18, indicados: 7,  status: "Ativo",    desde: "12/01/2026" },
  { id: "R-02", nome: "Aline Tavares",        revenda: "MaxRevenda",          uf: "PR", cidade: "Curitiba",      operadoras: ["Claro","Oi"],         leads: 22, indicados: 11, status: "Ativo",    desde: "04/02/2026" },
  { id: "R-03", nome: "Bruno Camargo",        revenda: "Telecom Sertão",      uf: "PE", cidade: "Recife",        operadoras: ["Vivo"],               leads: 14, indicados: 4,  status: "Ativo",    desde: "20/02/2026" },
  { id: "R-04", nome: "Fernanda Quintanilha", revenda: "—",                   uf: "SP", cidade: "Campinas",      operadoras: ["TIM","Claro"],        leads: 0,  indicados: 0,  status: "Pendente", desde: "13/05/2026" },
  { id: "R-05", nome: "Otávio Mendieta",      revenda: "Latitude Mobile",     uf: "MT", cidade: "Cuiabá",        operadoras: ["Vivo","TIM","Claro"], leads: 9,  indicados: 2,  status: "Pendente", desde: "12/05/2026" },
  { id: "R-06", nome: "Sandra Bittencourt",   revenda: "BSB Conecta",         uf: "DF", cidade: "Brasília",      operadoras: ["Oi"],                 leads: 31, indicados: 14, status: "Ativo",    desde: "09/12/2025" },
  { id: "R-07", nome: "Wagner Lopes",         revenda: "Atlântico Telecom",   uf: "RJ", cidade: "Niterói",       operadoras: ["Vivo","Claro"],       leads: 7,  indicados: 1,  status: "Suspenso", desde: "03/11/2025" },
  { id: "R-08", nome: "Marina Carvalho",      revenda: "Conecta Sul Telecom", uf: "SC", cidade: "Joinville",     operadoras: ["Vivo","TIM"],         leads: 14, indicados: 5,  status: "Ativo",    desde: "18/02/2026" },
  { id: "R-09", nome: "Pedro Henrique",       revenda: "Conecta Sul Telecom", uf: "PR", cidade: "Londrina",      operadoras: ["Vivo","Claro"],       leads: 11, indicados: 3,  status: "Ativo",    desde: "06/03/2026" },
];

export const AUDITORIA: Auditoria[] = [
  { id:"AU-9912", quem:"Lucas Ferreira",       papel:"Representante", acao:"indicou caso jurídico", alvo:"C-1089 — Frigorífico Pampa",       quando:"hoje, 14:02",  detalhe:"De Proposta Enviada → Travado (Advox)" },
  { id:"AU-9911", quem:"Dra. Camila Soares",   papel:"Advogado",      acao:"atualizou status",      alvo:"C-1087 — AgroFértil Cooperativa",  quando:"hoje, 13:48",  detalhe:"De Contato Inicial → Proposta Honorários" },
  { id:"AU-9910", quem:"sistema",              papel:"Sistema",       acao:"notificou",             alvo:"Lucas Ferreira",                   quando:"hoje, 13:48",  detalhe:"E-mail + push entregues" },
  { id:"AU-9909", quem:"Aline Tavares",        papel:"Representante", acao:"editou lead",           alvo:"L-2810 — Indústria Plastex",       quando:"hoje, 11:30",  detalhe:"valor estimado 72.000 → 78.400" },
  { id:"AU-9908", quem:"admin@advox.adv.br",   papel:"Admin",         acao:"aprovou cadastro",      alvo:"Bruno Camargo (R-03)",             quando:"hoje, 10:12",  detalhe:"—" },
  { id:"AU-9907", quem:"Dr. Rodrigo Penteado", papel:"Advogado",      acao:"adicionou nota interna", alvo:"C-1088 — Construnorte",          quando:"hoje, 09:55",  detalhe:"24 caracteres" },
  { id:"AU-9906", quem:"Lucas Ferreira",       papel:"Representante", acao:"agendou tarefa",        alvo:"L-2841 — Construtora Vértice Sul", quando:"ontem, 18:21", detalhe:"Hoje 14:30 — Ligar para Mariana" },
  { id:"AU-9905", quem:"sistema",              papel:"Sistema",       acao:"liberou caso",          alvo:"C-1082 — Indústria Plastex",       quando:"ontem, 16:04", detalhe:"automação: status do escritório → liberado" },
];

export const PRAZOS: Prazo[] = [
  { id:"P-220", caso:"C-1083", cliente:"Auto Posto Tropical",         tipo:"Audiência",          data:"22/05/2026", em:"daqui 8 dias",  urg:"hoje" },
  { id:"P-219", caso:"C-1084", cliente:"Cooperativa Vinícola Serra",  tipo:"Peticionamento",     data:"19/05/2026", em:"daqui 5 dias",  urg:"hoje" },
  { id:"P-218", caso:"C-1085", cliente:"Mecânica BoaPraça",           tipo:"Resposta operadora", data:"21/05/2026", em:"daqui 7 dias",  urg:"semana" },
  { id:"P-217", caso:"C-1083", cliente:"Auto Posto Tropical",         tipo:"Réplica",            data:"02/06/2026", em:"daqui 19 dias", urg:"proximas" },
  { id:"P-216", caso:"C-1084", cliente:"Cooperativa Vinícola Serra",  tipo:"Decisão pendente",   data:"—",          em:"acompanhar",    urg:"proximas" },
];

export const KPIS_COORD: KpiCard[] = [
  { label: "Leads ativos do time", valor: "12", delta: "+4 esta semana",           trend: "up" },
  { label: "Fechados no mês",      valor: "8",  delta: fmtBRL(620100),              trend: "up" },
  { label: "Conversão média",      valor: "31%", delta: "+5pp vs mês ant.",        trend: "up" },
  { label: "Casos no Advox",       valor: "6",  delta: "1 liberado este mês",      trend: "neutral" },
];
export const KPIS_REP: KpiCard[] = [
  { label: "Leads ativos",    valor: "18", delta: "+3 esta semana",    trend: "up" },
  { label: "Tarefas hoje",    valor: "3",  delta: "2 já concluídas",   trend: "neutral" },
  { label: "Fechadas no mês", valor: "5",  delta: fmtBRL(411500),       trend: "up" },
  { label: "Casos no Advox",  valor: "7",  delta: "2 liberados",        trend: "neutral" },
];
export const KPIS_ADV: KpiCard[] = [
  { label: "Atribuídos",        valor: "14", delta: "+2 hoje",         trend: "up" },
  { label: "Em análise",        valor: "5",  delta: "—",                trend: "neutral" },
  { label: "Em contato",        valor: "3",  delta: "—",                trend: "neutral" },
  { label: "Liberados no mês",  valor: "6",  delta: "tempo médio 18d", trend: "up" },
];
export const KPIS_ADMIN: KpiCard[] = [
  { label: "Casos recebidos", valor: "84",          delta: "+12 vs mês ant.",   trend: "up" },
  { label: "Casos liberados", valor: "47",          delta: "56% conversão",     trend: "up" },
  { label: "Tempo médio",     valor: "21d",         delta: "−3d vs mês ant.",   trend: "up" },
  { label: "Receita gerada",  valor: fmtBRL(284600), delta: "honorários êxito", trend: "up" },
];

export const HEATMAP: [string, number][] = [
  ["AC", 1], ["AL", 3], ["AP", 0], ["AM", 4], ["BA", 7],  ["CE", 5], ["DF", 6], ["ES", 3],
  ["GO", 5], ["MA", 2], ["MT", 4], ["MS", 3], ["MG", 9],  ["PA", 3], ["PB", 2], ["PR", 11],
  ["PE", 6], ["PI", 1], ["RJ", 8], ["RN", 2], ["RS", 14], ["RO", 1], ["RR", 0], ["SC", 12],
  ["SP", 18], ["SE", 1], ["TO", 1],
];

export const TOP_REPS = [
  { nome: "Aline Tavares",      revenda: "MaxRevenda",          ind: 14, conv: 71, valor: 482300 },
  { nome: "Sandra Bittencourt", revenda: "BSB Conecta",         ind: 12, conv: 67, valor: 358900 },
  { nome: "Lucas Ferreira",     revenda: "Conecta Sul Telecom", ind: 9,  conv: 78, valor: 411500 },
  { nome: "Bruno Camargo",      revenda: "Telecom Sertão",      ind: 4,  conv: 50, valor: 142000 },
];
export const TOP_ADV = [
  { nome: "Dra. Camila Soares",     resolvidos: 9, tempo: 16 },
  { nome: "Dr. Rodrigo Penteado",   resolvidos: 7, tempo: 21 },
  { nome: "Dra. Mariana Klemtz",    resolvidos: 5, tempo: 24 },
  { nome: "Dr. Felipe Bittencourt", resolvidos: 4, tempo: 19 },
];

export const USERS: Record<Persona, User> = {
  rep:   { nome: "Lucas Ferreira",     papel: "Representante",         email: "lucas@conectasul.com.br",      revenda: "Conecta Sul Telecom", uf: "SC", whats: "(48) 99812-4471" },
  coord: { nome: "Roberto Maciel",     papel: "Coordenador da Revenda", email: "roberto@conectasul.com.br",   revenda: "Conecta Sul Telecom", uf: "SC", whats: "(48) 99800-0001" },
  adv:   { nome: "Dra. Camila Soares", papel: "Advogada",              email: "camila.soares@advox.adv.br",  oab: "OAB/SP 412.118",          uf: "SP", whats: "(11) 99441-2202" },
  admin: { nome: "Marcelo Drumond",    papel: "Administrador",         email: "marcelo@advox.adv.br",        revenda: "—",                   uf: "SP", whats: "(11) 99001-0001" },
};

/* === Team helpers (Coordenador de Revenda) — accept leads/casos as param so they react to store changes === */
export function getTeamReps(revenda: string): Representante[] {
  return REPRESENTANTES.filter(r => r.revenda === revenda && r.status === "Ativo");
}
export function getTeamLeads(revenda: string, leads: Lead[] = LEADS): Lead[] {
  return leads.filter(l => l.revenda === revenda);
}
export function getTeamCasos(revenda: string, casos: Caso[] = CASOS): Caso[] {
  const names = new Set(getTeamReps(revenda).map(r => r.nome));
  return casos.filter(c => names.has(c.rep));
}
export function getTeamTarefas(revenda: string, leads: Lead[] = LEADS): Tarefa[] {
  const teamLeadIds = new Set(getTeamLeads(revenda, leads).map(l => l.id));
  return TAREFAS.filter(t => teamLeadIds.has(t.leadId));
}

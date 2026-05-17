/**
 * Tipos gerados manualmente para o schema Advox.
 * Quando o Supabase CLI estiver configurado, substitua este arquivo rodando:
 *   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 */

export type Papel = "admin" | "coord" | "rep" | "advogado";
export type ContaStatus = "pendente" | "ativo" | "suspenso" | "recusado";
export type Operadora = "Vivo" | "TIM" | "Claro" | "Oi";

export type LeadStatus =
  | "novo" | "contato" | "proposta" | "travado"
  | "aguardando" | "negociacao" | "fechado" | "perdido";

export type CasoStatus =
  | "recebido" | "analise" | "contato" | "honorarios"
  | "contratou" | "documentacao" | "extrajudicial"
  | "judicial" | "liberado" | "naoliberado" | "recusou";

export type Database = {
  public: {
    Tables: {
      revendas: {
        Row: {
          id: string;
          nome: string;
          cnpj: string | null;
          status: ContaStatus;
          coord_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["revendas"]["Row"], "id" | "created_at" | "updated_at">> & { nome: string };
        Update: Partial<Database["public"]["Tables"]["revendas"]["Row"]>;
      };
      profiles: {
        Row: {
          id: string;                  // = auth.users.id
          email: string;
          nome: string;
          papel: Papel;
          status: ContaStatus;
          revenda_id: string | null;
          oab: string | null;
          uf: string | null;
          cidade: string | null;
          whats: string | null;
          foto_url: string | null;
          operadoras: Operadora[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">> & {
          id: string;
          email: string;
          nome: string;
          papel: Papel;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      leads: {
        Row: {
          id: string;
          empresa: string;
          contato: string;
          cnpj: string | null;
          cidade: string | null;
          uf: string | null;
          operadora: Operadora;
          valor: number;
          status: LeadStatus;
          proximo: string | null;
          tag: string | null;
          origem: string | null;
          rep_id: string;              // FK profiles.id
          revenda_id: string;          // FK revendas.id
          advox_caso_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["leads"]["Row"], "id" | "created_at" | "updated_at">> & {
          empresa: string; contato: string; operadora: Operadora;
          valor: number; status: LeadStatus; rep_id: string; revenda_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Row"]>;
      };
      casos: {
        Row: {
          id: string;
          lead_id: string;
          advogado_id: string | null;
          status: CasoStatus;
          tipo: string;
          multa: number;
          valor_honorarios: number | null;
          sla_dias: number;
          prox_passo: string | null;
          liberado_em: string | null;
          dias_indicacao: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["casos"]["Row"], "id" | "created_at" | "updated_at">> & {
          lead_id: string; status: CasoStatus; tipo: string; multa: number;
        };
        Update: Partial<Database["public"]["Tables"]["casos"]["Row"]>;
      };
      tarefas: {
        Row: {
          id: string;
          lead_id: string | null;
          caso_id: string | null;
          autor_id: string;
          descricao: string;
          quando: string | null;
          prioridade: "alta" | "media" | "baixa";
          urgencia: "atrasada" | "hoje" | "semana" | "proxima";
          completed: boolean;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["tarefas"]["Row"], "id" | "created_at">> & {
          autor_id: string; descricao: string;
        };
        Update: Partial<Database["public"]["Tables"]["tarefas"]["Row"]>;
      };
      notas: {
        Row: {
          id: string;
          lead_id: string | null;
          caso_id: string | null;
          autor_id: string;
          texto: string;
          interno: boolean;
          tipo: "nota" | "ligacao" | "email" | "whatsapp" | "status";
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["notas"]["Row"], "id" | "created_at">> & {
          autor_id: string; texto: string;
        };
        Update: Partial<Database["public"]["Tables"]["notas"]["Row"]>;
      };
      documentos: {
        Row: {
          id: string;
          lead_id: string | null;
          caso_id: string | null;
          nome: string;
          tipo: string | null;
          tamanho: number | null;
          storage_path: string;
          uploaded_by: string;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["documentos"]["Row"], "id" | "created_at">> & {
          nome: string; storage_path: string; uploaded_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["documentos"]["Row"]>;
      };
      prazos: {
        Row: {
          id: string;
          caso_id: string;
          tipo: string;
          descricao: string | null;
          data: string;
          local: string | null;
          status: "agendado" | "feito" | "pendente";
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["prazos"]["Row"], "id" | "created_at">> & {
          caso_id: string; tipo: string; data: string;
        };
        Update: Partial<Database["public"]["Tables"]["prazos"]["Row"]>;
      };
      convites: {
        Row: {
          id: string;
          email: string;
          papel: Papel;
          revenda_id: string | null;
          invited_by: string;
          token: string;
          aceito_em: string | null;
          expira_em: string;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["convites"]["Row"], "id" | "created_at" | "token">> & {
          email: string; papel: Papel; invited_by: string; expira_em: string;
        };
        Update: Partial<Database["public"]["Tables"]["convites"]["Row"]>;
      };
      auditoria: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Record<string, unknown> | null;
          ip: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["auditoria"]["Row"], "id" | "created_at">> & {
          action: string; entity_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["auditoria"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      papel: Papel;
      conta_status: ContaStatus;
      operadora: Operadora;
      lead_status: LeadStatus;
      caso_status: CasoStatus;
    };
  };
};

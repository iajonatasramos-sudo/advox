// Página pública /privacidade — Política de Privacidade do Advox e da
// extensão AdvoxChat (exigida pela Chrome Web Store). Não precisa de login.
import React from "react";
import { LogoAdvox } from "./ui";

const ATUALIZADA_EM = "26 de novembro de 2026";
const CONTATO = "contato@advoxtelecom.com.br";

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{titulo}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </section>
  );
}

export function PoliticaPrivacidade() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "32px 16px 56px" }}>
      <article style={{ maxWidth: 760, margin: "0 auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "28px clamp(18px, 4vw, 40px)", display: "flex", flexDirection: "column", gap: 24, boxShadow: "var(--shadow-sm)" }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <a href="/" aria-label="Ir para o Advox"><LogoAdvox style={{ height: 40, width: "auto" }} /></a>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Política de Privacidade</h1>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>Advox (app web) e extensão AdvoxChat para o WhatsApp Web · atualizada em {ATUALIZADA_EM}</div>
          </div>
        </header>

        <Bloco titulo="1. Quem somos">
          <p style={{ margin: 0 }}>
            O Advox é um sistema de gestão de clientes (CRM) da <strong>Advox Telecom</strong>, usado por equipes comerciais de revendas
            de telecomunicações e pelo escritório jurídico parceiro. A AdvoxChat é a extensão do Chrome que leva esse CRM para dentro
            do WhatsApp Web. A Advox Telecom é a responsável (controladora) pelos dados tratados no sistema, nos termos da
            Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).
          </p>
          <p style={{ margin: 0 }}>
            A AdvoxChat é uma ferramenta independente. Ela não é desenvolvida, mantida nem endossada pelo WhatsApp ou pela Meta.
          </p>
        </Bloco>

        <Bloco titulo="2. Quais dados tratamos">
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            <li><strong>Conta de usuário:</strong> nome, e-mail, senha (guardada apenas de forma criptografada pelo provedor de autenticação), função na equipe, revenda, cidade, estado e WhatsApp informados no perfil.</li>
            <li><strong>Dados do CRM:</strong> leads e clientes cadastrados pela equipe (empresa, contato, telefone, e-mail, operadora, valores, etapas), anotações, tarefas, atividades da agenda, documentos anexados e o andamento dos casos jurídicos.</li>
            <li><strong>Na extensão AdvoxChat:</strong> o nome e o número de telefone do contato da conversa que está aberta no WhatsApp Web, para localizar ou cadastrar o lead correspondente; as pastas, etiquetas, anotações e mensagens rápidas que o próprio usuário cria; e a data do último contato com cada número.</li>
            <li><strong>Registros de uso:</strong> ações importantes no sistema (por exemplo, mudança de status de um lead ou de um caso) ficam registradas em auditoria, com data, hora e usuário.</li>
          </ul>
          <p style={{ margin: 0 }}>
            A extensão <strong>não lê, não copia e não armazena o conteúdo das suas conversas</strong> do WhatsApp. Ela só envia uma mensagem
            quando o próprio usuário escolhe uma mensagem rápida e a envia.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Transcrição de áudio:</strong> quando o usuário clica em <em>Transcrever</em> numa mensagem de áudio, só aquele áudio é
            enviado ao nosso servidor e a um provedor de reconhecimento de fala, que devolve o texto. O áudio e o texto não ficam
            guardados no Advox: o texto aparece apenas na tela de quem pediu. Nenhum áudio é enviado sem esse clique.
          </p>
        </Bloco>

        <Bloco titulo="3. Para que usamos">
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            <li>Permitir o acesso ao sistema e mostrar a cada pessoa apenas o que a função dela permite ver.</li>
            <li>Organizar o atendimento comercial: leads, agenda, tarefas, anotações e o funil de vendas da equipe.</li>
            <li>Encaminhar ao escritório jurídico os clientes indicados pela equipe e acompanhar o andamento dos casos.</li>
            <li>Enviar avisos dentro do sistema (por exemplo, quando um caso muda de etapa).</li>
            <li>Manter a segurança, investigar uso indevido e cumprir obrigações legais.</li>
          </ul>
          <p style={{ margin: 0 }}>
            As bases legais são a execução do contrato com a revenda e com o usuário, o legítimo interesse na gestão comercial e,
            quando aplicável, o cumprimento de obrigação legal. <strong>Não vendemos dados</strong>, não usamos os dados para publicidade
            e não os compartilhamos para fins de marketing de terceiros.
          </p>
        </Bloco>

        <Bloco titulo="4. Com quem compartilhamos">
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            <li><strong>Dentro da hierarquia da sua empresa:</strong> o que você cadastra fica visível para você e para quem está acima de você na equipe (coordenador, gerente e proprietário da revenda).</li>
            <li><strong>Escritório jurídico parceiro:</strong> somente os dados dos clientes que a equipe indicar para atendimento jurídico.</li>
            <li><strong>Provedores de infraestrutura:</strong> o Supabase (banco de dados, autenticação e armazenamento de arquivos) e o provedor de hospedagem do site, que tratam os dados apenas para operar o serviço.</li>
            <li><strong>Provedor de transcrição:</strong> o serviço de reconhecimento de fala (inteligência artificial) que recebe somente os áudios que o usuário pede para transcrever, apenas para devolver o texto.</li>
            <li><strong>Autoridades:</strong> quando houver obrigação legal ou ordem judicial.</li>
          </ul>
        </Bloco>

        <Bloco titulo="5. Onde os dados ficam e por quanto tempo">
          <p style={{ margin: 0 }}>
            Os dados ficam em servidores de nuvem com conexão criptografada (HTTPS) e controle de acesso por usuário. A extensão guarda
            no navegador apenas a sessão de login, para você não precisar entrar a cada vez.
          </p>
          <p style={{ margin: 0 }}>
            Mantemos os dados enquanto a conta ou o contrato com a revenda estiverem ativos e, depois disso, pelo prazo necessário para
            cumprir obrigações legais ou resguardar direitos. Contas encerradas são desativadas e os dados são excluídos ou anonimizados
            quando não houver mais motivo legal para guardá-los.
          </p>
        </Bloco>

        <Bloco titulo="6. Seus direitos">
          <p style={{ margin: 0 }}>
            Pela LGPD você pode pedir confirmação de que tratamos seus dados, acesso, correção, anonimização, portabilidade, exclusão,
            informações sobre compartilhamento e revisão do consentimento, quando ele for a base do tratamento. Parte disso já está no
            próprio sistema, em <em>Meu perfil</em> (dados da conta e encerramento da conta). Para o restante, escreva para{" "}
            <a href={`mailto:${CONTATO}`} style={{ color: "var(--navy)" }}>{CONTATO}</a>.
          </p>
        </Bloco>

        <Bloco titulo="7. Permissões da extensão AdvoxChat">
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            <li><strong>Armazenamento (storage):</strong> guardar a sessão de login no navegador.</li>
            <li><strong>Acesso a web.whatsapp.com:</strong> mostrar o painel do Advox ao lado da conversa e identificar o contato que está aberto.</li>
            <li><strong>Acesso ao servidor do Advox (supabase.co):</strong> ler e gravar os dados do CRM da sua conta e enviar para transcrição os áudios que você pedir.</li>
          </ul>
          <p style={{ margin: 0 }}>A extensão não funciona em nenhum outro site e não executa código baixado da internet.</p>
        </Bloco>

        <Bloco titulo="8. Mudanças nesta política">
          <p style={{ margin: 0 }}>
            Quando esta política mudar, atualizamos a data no topo da página e avisamos no sistema se a mudança for relevante.
            Dúvidas: <a href={`mailto:${CONTATO}`} style={{ color: "var(--navy)" }}>{CONTATO}</a>.
          </p>
        </Bloco>
      </article>
    </div>
  );
}

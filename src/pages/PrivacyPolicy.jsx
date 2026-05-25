import { FileText, Database, ShieldCheck, UserCheck, Eye, RefreshCw } from 'lucide-react';
import { LegalList, LegalListItem, LegalPage, LegalSection } from '@/components/legal-page';

export default function PrivacyPolicy() {
  return (
    <LegalPage
      eyebrow="Termos de uso e privacidade"
      title="Política de Uso e Privacidade"
      description="Condições de uso da plataforma Pickleball, natureza esportiva da ferramenta e diretrizes de tratamento de dados pessoais."
      meta={`Versão 1.0 — ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}. Ao usar a plataforma, você declara ciência e aceitação destas condições.`}
    >
      <LegalSection icon={FileText} title="Natureza da Plataforma" description="Ferramenta esportiva para criação e gestão de torneios amadores.">
        <p>
          A plataforma <strong>Pickleball</strong> é uma ferramenta tecnológica para criação e administração de torneios
          do esporte pickleball. Permite que organizadores criem torneios, definam regras, abram inscrições, sorteiem
          chaves, lancem resultados e calculem rankings.
        </p>
        <p>
          A plataforma não organiza eventos, não fornece quadras, não administra premiações nem intermedia pagamentos.
          A taxa de inscrição informada em uma modalidade serve apenas como referência para os participantes; a
          cobrança e o controle financeiro são responsabilidade do(s) admin(s) do torneio.
        </p>
      </LegalSection>

      <LegalSection icon={ShieldCheck} title="Conduta e Responsabilidade" description="Cada usuário responde pelos próprios atos.">
        <p>
          O uso deve respeitar a legislação aplicável, as regras do esporte (CBP / USAP) e os princípios de fair play.
          Casos de fraude no lançamento de resultados, identidade falsa ou ofensa a outros usuários podem levar à
          suspensão da conta e do torneio.
        </p>
      </LegalSection>

      <LegalSection icon={Database} title="Dados coletados" description="Coletamos o mínimo necessário para a operação esportiva.">
        <LegalList>
          <LegalListItem>Nome e e-mail do usuário (via login Google).</LegalListItem>
          <LegalListItem>Nome de exibição, telefone e data de nascimento (quando preenchidos no perfil).</LegalListItem>
          <LegalListItem>Inscrições em torneios, resultados de jogos, ranking e nivelamento informado.</LegalListItem>
          <LegalListItem>Eventos de auditoria de ações administrativas (com data, autor e descrição).</LegalListItem>
        </LegalList>
      </LegalSection>

      <LegalSection icon={UserCheck} title="Visibilidade dos dados">
        <p>
          Nomes, inscrições, resultados e ranking são visíveis para outros participantes do mesmo torneio. Dados como
          telefone e e-mail não são exibidos publicamente. Admins de torneio têm acesso à lista completa de inscritos
          do seu próprio torneio para fins de gestão.
        </p>
      </LegalSection>

      <LegalSection icon={Eye} title="Direitos do titular">
        <p>
          Conforme a LGPD, você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados pessoais.
          Para isso, entre em contato pelo e-mail informado na página de contato.
        </p>
      </LegalSection>

      <LegalSection icon={RefreshCw} title="Alterações">
        <p>
          Esta política pode ser atualizada para refletir mudanças de funcionalidade, requisitos legais ou de
          segurança. A versão vigente será sempre a publicada nesta página.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

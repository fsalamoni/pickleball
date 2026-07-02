import React from 'react';
import { Database, Eye, FileText, RefreshCw, ShieldCheck, UserCheck } from 'lucide-react';
import { V2BulletList, V2ContentHero, V2ContentSection } from '@/v2/ui/primitives';

export default function V2Privacy() {
  const meta = `Versão 1.0 — ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}. Ao usar a plataforma, você declara ciência e aceitação destas condições.`;

  return (
    <div className="mx-auto max-w-[900px]">
      <V2ContentHero
        eyebrow="Termos de uso e privacidade"
        title="Política de Uso e Privacidade"
        description="Condições de uso da plataforma Pickleball, natureza esportiva da ferramenta e diretrizes de tratamento de dados pessoais."
        meta={meta}
      />

      <div className="space-y-4">
        <V2ContentSection icon={FileText} title="Natureza da Plataforma" description="Ferramenta esportiva para criação e gestão de torneios amadores.">
          <p>
            A plataforma <strong className="text-ink">Pickleball</strong> é uma ferramenta tecnológica para criação e administração de torneios
            do esporte pickleball. Permite que organizadores criem torneios, definam regras, abram inscrições, sorteiem
            chaves, lancem resultados e calculem rankings.
          </p>
          <p>
            A plataforma não organiza eventos, não fornece quadras, não administra premiações nem intermedia pagamentos.
            A taxa de inscrição informada em uma modalidade serve apenas como referência para os participantes; a
            cobrança e o controle financeiro são responsabilidade do(s) admin(s) do torneio.
          </p>
        </V2ContentSection>

        <V2ContentSection icon={ShieldCheck} title="Conduta e Responsabilidade" description="Cada usuário responde pelos próprios atos.">
          <p>
            O uso deve respeitar a legislação aplicável, as regras do esporte (CBP / USAP) e os princípios de fair play.
            Casos de fraude no lançamento de resultados, identidade falsa ou ofensa a outros usuários podem levar à
            suspensão da conta e do torneio.
          </p>
        </V2ContentSection>

        <V2ContentSection icon={Database} title="Dados coletados" description="Coletamos o mínimo necessário para a operação esportiva.">
          <V2BulletList items={[
            'Nome e e-mail do usuário (via login Google).',
            'Nome de exibição, telefone e data de nascimento (quando preenchidos no perfil).',
            'Inscrições em torneios, resultados de jogos, ranking e nivelamento informado.',
            'Eventos de auditoria de ações administrativas (com data, autor e descrição).',
          ]} />
        </V2ContentSection>

        <V2ContentSection icon={UserCheck} title="Visibilidade dos dados">
          <p>
            Nomes, inscrições, resultados e ranking são visíveis para outros participantes do mesmo torneio. Dados como
            telefone e e-mail não são exibidos publicamente. Admins de torneio têm acesso à lista completa de inscritos
            do seu próprio torneio para fins de gestão.
          </p>
        </V2ContentSection>

        <V2ContentSection icon={Eye} title="Direitos do titular">
          <p>
            Conforme a LGPD, você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados pessoais.
            Para isso, entre em contato pelo e-mail informado na página de contato.
          </p>
        </V2ContentSection>

        <V2ContentSection icon={RefreshCw} title="Alterações">
          <p>
            Esta política pode ser atualizada para refletir mudanças de funcionalidade, requisitos legais ou de
            segurança. A versão vigente será sempre a publicada nesta página.
          </p>
        </V2ContentSection>
      </div>
    </div>
  );
}

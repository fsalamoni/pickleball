import { AlertTriangle, CreditCard, Database, Eye, FileText, Lock, RefreshCw, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { LegalList, LegalListItem, LegalPage, LegalSection } from '@/components/legal-page';

export default function PrivacyPolicy() {
  return (
    <LegalPage
      eyebrow="Termos de uso, responsabilidade e privacidade"
      title="Política de Uso e Privacidade"
      description="Condições de uso da plataforma, limites de responsabilidade, natureza recreativa do bolão e diretrizes de tratamento de dados pessoais."
      meta="Versão 2.0 - atualizada em maio/2026. Ao usar a plataforma, você declara ciência e aceitação destas condições."
    >
      <LegalSection icon={FileText} title="Natureza da Plataforma" description="Entretenimento social, sem operação financeira ou jogo de azar.">
        <p>
          O Bolão Copa 2026 é uma plataforma tecnológica de entretenimento social para organização de palpites entre amigos,
          familiares, colegas ou grupos privados. A plataforma não é operadora de jogos de azar, bookmaker, loteria, instituição
          financeira, intermediadora de pagamentos, operadora de jogos de azar, corretora, garantidora de premiações ou
          agente de qualquer transação financeira entre usuários.
        </p>
        <p>
          A plataforma apenas fornece ferramentas para cadastro de bolões, registro de palpites, apuração de pontos e
          visualização de rankings. Qualquer combinação externa sobre valores, brindes, prêmios, pagamentos, rateios,
          cobranças ou entregas é inteiramente privada entre os participantes e administradores do respectivo grupo.
        </p>
      </LegalSection>

      <LegalSection icon={ShieldCheck} title="Uso Recreativo e Responsabilidade" description="Cada usuário responde por suas decisões e acordos privados.">
        <p>
          O uso deve ser recreativo, voluntário e compatível com a legislação aplicável. Cada usuário é exclusivamente
          responsável por suas decisões, por sua participação em grupos, por eventuais acordos feitos fora da plataforma e
          por verificar se a atividade é permitida em sua localidade, ambiente de trabalho, instituição, país, estado ou
          município.
        </p>
        <p>
          Na máxima extensão permitida pela legislação aplicável, a plataforma, seus administradores, desenvolvedores,
          mantenedores e representantes não se responsabilizam por perdas financeiras, expectativas de ganho, vício em jogos,
          compulsão, endividamento, conflitos entre participantes, descumprimento de acordos privados, cobranças, pagamentos,
          inadimplência, promessas de premiação, fraudes praticadas por terceiros ou qualquer uso indevido da ferramenta.
        </p>
      </LegalSection>

      <LegalSection icon={UserCheck} title="Maioridade e Jogo Responsável" description="Uso permitido apenas para maiores de idade.">
        <p>
          O acesso e a participação são permitidos apenas para pessoas com 18 anos ou mais. Ao utilizar a plataforma, você
          declara ser maior de idade e fornecer dados verdadeiros. Contas de menores, informações falsas ou uso por terceiros
          podem ser bloqueados ou removidos.
        </p>
        <p>
          Se qualquer dinâmica de bolão, disputa, ranking, prêmio, cobrança ou competição causar desconforto, ansiedade,
          compulsão, prejuízo financeiro, conflitos familiares, profissionais ou sociais, interrompa o uso. A plataforma não
          recomenda jogos de azar, não incentiva jogos de azar e não presta aconselhamento psicológico, médico, jurídico ou
          financeiro. Procure ajuda profissional se perceber sinais de compulsão ou perda de controle.
        </p>
      </LegalSection>

      <LegalSection icon={Users} title="Administradores de Bolão" description="Admins organizam seus próprios grupos, sem representar a plataforma.">
        <p>
          Administradores de bolões são usuários responsáveis por seus próprios grupos. Eles podem convidar membros,
          configurar regras locais disponíveis na plataforma e moderar sua comunidade. Administradores de bolão não representam
          a plataforma e não têm autorização para prometer garantias, premiações, pagamentos, rendimentos ou obrigações em nome
          do Bolão Copa 2026.
        </p>
      </LegalSection>

      <LegalSection icon={RefreshCw} title="Resultados, Pontuação e Fontes Oficiais" description="Apuração pode depender de fontes oficiais e revisão administrativa.">
        <p>
          Os resultados dos jogos podem ser informados por administradores autorizados ou sincronizados com fontes públicas e
          oficiais, como a FIFA, quando tecnicamente disponível. A pontuação é calculada conforme as regras configuradas no
          sistema, incluindo placar, acertos parciais, buchas, super buchas, pênaltis em fases eliminatórias e multiplicadores
          de zebra quando habilitados.
        </p>
        <p>
          Pontos extras por pênaltis só são aplicados quando o jogo realmente tiver decisão por pênaltis registrada no sistema.
          Se não houver decisão por pênaltis, o extra correspondente é zero. Multiplicadores de zebra seguem a definição feita
          pelo Admin Geral da plataforma e podem ser desabilitados por bolões que adotem regras próprias, quando essa opção
          estiver disponível.
        </p>
        <p>
          Resultados, rankings e pontuações podem ser corrigidos em caso de erro de digitação, alteração oficial, falha de
          integração, inconsistência de dados, decisão administrativa, auditoria ou necessidade técnica. A plataforma não
          garante disponibilidade ininterrupta, ausência absoluta de erros ou que fontes externas estejam sempre acessíveis.
        </p>
      </LegalSection>

      <LegalSection icon={CreditCard} title="Ausência de Intermediação Financeira" description="A plataforma não processa nem garante pagamentos ou prêmios.">
        <p>
          O Bolão Copa 2026 não processa, recebe, retém, transfere, bloqueia, garante, audita ou intermedeia valores entre
          usuários. Qualquer pagamento, cobrança, taxa, prêmio, brinde ou entrega combinada fora da plataforma ocorre por
          conta e risco exclusivo dos participantes envolvidos.
        </p>
      </LegalSection>

      <LegalSection icon={AlertTriangle} title="Condutas Proibidas" description="Usos que podem gerar bloqueio ou remoção de conta.">
        <LegalList>
          <LegalListItem>Usar a plataforma para atividade ilícita, fraudulenta, abusiva ou contrária à legislação aplicável.</LegalListItem>
          <LegalListItem>Cadastrar dados falsos, criar contas de terceiros sem autorização ou permitir uso por menores de idade.</LegalListItem>
          <LegalListItem>Tentar acessar palpites sigilosos, burlar regras, explorar falhas ou manipular resultados.</LegalListItem>
          <LegalListItem>Praticar assédio, ameaça, discriminação, fraude, cobrança abusiva ou divulgação indevida de dados.</LegalListItem>
          <LegalListItem>Prometer premiações, pagamentos ou garantias em nome da plataforma sem autorização expressa.</LegalListItem>
        </LegalList>
      </LegalSection>

      <LegalSection icon={Lock} title="Sigilo dos Palpites" description="Palpites ficam protegidos até o reveal da fase.">
        <p>
          Os palpites individuais são <strong>confidenciais</strong> até o prazo final da fase a que pertencem. Esse sigilo
          é garantido por arquitetura: os palpites só ficam legíveis no banco de dados após o fechamento automático do prazo
          de cada fase. Nenhum administrador da plataforma, nem mesmo o Admin Geral, tem acesso ao palpite individual antes
          do reveal oficial. Tentativas de leitura bloqueadas são registradas em log de auditoria.
        </p>
      </LegalSection>

      <LegalSection icon={Database} title="Dados Pessoais Coletados" description="Informações usadas para operação, segurança e auditoria.">
        <LegalList>
          <LegalListItem>Nome de exibição, e-mail e foto associados à sua conta Google.</LegalListItem>
          <LegalListItem>Data de nascimento, telefone e demais dados necessários para elegibilidade, segurança e contato operacional.</LegalListItem>
          <LegalListItem>Palpites realizados, visíveis aos demais membros apenas após o reveal de cada fase.</LegalListItem>
          <LegalListItem>Pontuação calculada, rankings, participação em bolões, convites e papel administrativo quando aplicável.</LegalListItem>
          <LegalListItem>Logs de acesso, ações, eventos de segurança, auditoria e informações técnicas do dispositivo ou navegador.</LegalListItem>
        </LegalList>
      </LegalSection>

      <LegalSection icon={Eye} title="Quem Vê o Quê" description="Visibilidade de dados dentro dos bolões.">
        <LegalList>
          <LegalListItem><strong>Você:</strong> sempre vê seus próprios palpites.</LegalListItem>
          <LegalListItem><strong>Outros membros do mesmo bolão:</strong> veem seus palpites somente após o reveal da fase.</LegalListItem>
          <LegalListItem><strong>Admin do Bolão:</strong> gerencia membros e regras locais; vê palpites somente após o reveal.</LegalListItem>
          <LegalListItem><strong>Admin Geral:</strong> gerencia estrutura, jogos, resultados, auditoria, métricas e segurança, sem acesso a palpites individuais antes do reveal.</LegalListItem>
        </LegalList>
      </LegalSection>

      <LegalSection icon={ShieldCheck} title="LGPD, Compartilhamento e Retenção" description="Direitos do titular e uso de subprocessadores técnicos.">
        <p>
          Tratamos dados para execução do serviço, autenticação, segurança, prevenção a abuso, auditoria, cumprimento de
          obrigações legais, exercício regular de direitos e melhoria da plataforma. Quando aplicável, o tratamento também
          poderá se basear no consentimento do usuário ou no legítimo interesse, sempre observados os direitos previstos na
          Lei Geral de Proteção de Dados (LGPD).
        </p>
        <p>
          Os dados não são vendidos nem compartilhados com terceiros para marketing independente. Usamos subprocessadores
          técnicos, como Google Firebase e serviços relacionados, para autenticação, banco de dados, hospedagem, funções em
          nuvem, logs, segurança e entrega do serviço. Também poderemos compartilhar informações quando necessário para cumprir
          lei, ordem de autoridade competente, proteger direitos, investigar abuso ou preservar a segurança da plataforma.
        </p>
        <p>
          Os dados são retidos enquanto sua conta estiver ativa ou enquanto forem necessários para operação, auditoria,
          segurança, cumprimento legal ou resolução de disputas. A pedido, a conta pode ser excluída ou anonimizada quando
          tecnicamente e legalmente possível. Bolões dos quais você é administrador podem precisar ser transferidos antes da
          exclusão.
        </p>
      </LegalSection>

      <LegalSection icon={FileText} title="Seus Direitos e Alterações" description="Solicitações de dados e atualização desta política.">
        <p>
          Você pode solicitar confirmação de tratamento, acesso, correção, portabilidade, anonimização, bloqueio, exclusão,
          informação sobre compartilhamento e revisão de decisões automatizadas, conforme aplicável pela LGPD. Para exercer
          seus direitos, entre em contato pelo canal informado pelo administrador da plataforma.
        </p>
        <p>
          Esta política pode ser atualizada para refletir mudanças legais, operacionais, técnicas ou de produto. A continuidade
          do uso após a publicação da nova versão indica ciência e aceitação das condições atualizadas.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

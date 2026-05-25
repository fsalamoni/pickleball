import { Sparkles, HeartHandshake, Shield, AlertTriangle, BookOpen } from 'lucide-react';
import { LegalList, LegalListItem, LegalPage, LegalSection } from '@/components/legal-page';

export default function ConductFairPlay() {
  return (
    <LegalPage
      eyebrow="Espírito esportivo"
      title="Conduta &amp; Fair Play"
      description="Princípios de respeito, integridade e fair play que orientam o uso da plataforma Pickleball."
    >
      <LegalSection icon={HeartHandshake} title="Respeito ao adversário e ao parceiro">
        <p>
          O pickleball é, antes de tudo, um esporte social. Cumprimente o adversário antes e depois do jogo, evite
          comemorações excessivas em pontos do oponente e mantenha a comunicação em duplas em tom positivo.
        </p>
      </LegalSection>

      <LegalSection icon={Shield} title="Integridade nas chamadas e resultados">
        <p>
          As regras CBP e USAP consideram o jogador responsável pela honestidade das chamadas no próprio lado.
          Em torneios sem árbitro central, a dúvida favorece o adversário.
        </p>
        <LegalList>
          <LegalListItem>Não altere intencionalmente placares lançados na plataforma.</LegalListItem>
          <LegalListItem>Se discordar do registro, fale com o admin do torneio.</LegalListItem>
          <LegalListItem>WO (walk-over) só deve ser aplicado quando realmente houver ausência justificada.</LegalListItem>
        </LegalList>
      </LegalSection>

      <LegalSection icon={Sparkles} title="Inclusão e diversidade">
        <p>
          Torneios são abertos a todos os níveis e perfis. Discriminação por gênero, idade, orientação sexual, raça,
          religião ou condição física é incompatível com o esporte e com a plataforma.
        </p>
      </LegalSection>

      <LegalSection icon={AlertTriangle} title="Conduta vedada">
        <LegalList>
          <LegalListItem>Insultos, agressões verbais ou físicas.</LegalListItem>
          <LegalListItem>Lançamento intencional de resultados falsos.</LegalListItem>
          <LegalListItem>Uso de identidade de outra pessoa.</LegalListItem>
          <LegalListItem>Apostas em dinheiro entre participantes — a plataforma não suporta nem incentiva.</LegalListItem>
        </LegalList>
      </LegalSection>

      <LegalSection icon={BookOpen} title="Saúde no esporte">
        <p>
          Faça aquecimento antes das partidas, hidrate-se, respeite os limites do seu corpo e procure orientação
          médica/profissional para evolução técnica e física.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

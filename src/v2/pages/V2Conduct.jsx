import React from 'react';
import { AlertTriangle, BookOpen, HeartHandshake, Shield, Sparkles } from 'lucide-react';
import { V2BulletList, V2ContentHero, V2ContentSection } from '@/v2/ui/primitives';

export default function V2Conduct() {
  return (
    <div className="mx-auto max-w-[900px]">
      <V2ContentHero
        eyebrow="Espírito esportivo"
        title="Conduta & Fair Play"
        description="Princípios de respeito, integridade e fair play que orientam o uso da plataforma PickleRush."
      />

      <div className="space-y-4">
        <V2ContentSection icon={HeartHandshake} title="Respeito ao adversário e ao parceiro">
          <p>
            O pickleball é, antes de tudo, um esporte social. Cumprimente o adversário antes e depois do jogo, evite
            comemorações excessivas em pontos do oponente e mantenha a comunicação em duplas em tom positivo.
          </p>
        </V2ContentSection>

        <V2ContentSection icon={Shield} title="Integridade nas chamadas e resultados">
          <p>
            As regras CBP e USAP consideram o jogador responsável pela honestidade das chamadas no próprio lado.
            Em torneios sem árbitro central, a dúvida favorece o adversário.
          </p>
          <V2BulletList items={[
            'Não altere intencionalmente placares lançados na plataforma.',
            'Se discordar do registro, fale com o admin do torneio.',
            'WO (walk-over) só deve ser aplicado quando realmente houver ausência justificada.',
          ]} />
        </V2ContentSection>

        <V2ContentSection icon={Sparkles} title="Inclusão e diversidade">
          <p>
            Torneios são abertos a todos os níveis e perfis. Discriminação por gênero, idade, orientação sexual, raça,
            religião ou condição física é incompatível com o esporte e com a plataforma.
          </p>
        </V2ContentSection>

        <V2ContentSection icon={AlertTriangle} title="Conduta vedada">
          <V2BulletList items={[
            'Insultos, agressões verbais ou físicas.',
            'Lançamento intencional de resultados falsos.',
            'Uso de identidade de outra pessoa.',
            'Apostas em dinheiro entre participantes — a plataforma não suporta nem incentiva.',
          ]} />
        </V2ContentSection>

        <V2ContentSection icon={BookOpen} title="Saúde no esporte">
          <p>
            Faça aquecimento antes das partidas, hidrate-se, respeite os limites do seu corpo e procure orientação
            médica/profissional para evolução técnica e física.
          </p>
        </V2ContentSection>
      </div>
    </div>
  );
}

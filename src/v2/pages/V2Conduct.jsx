import React from 'react';
import { AlertTriangle, BookOpen, HeartHandshake, Shield, Sparkles } from 'lucide-react';
import { V2BulletList, V2ContentHero, V2ContentSection, V2Page } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function V2Conduct() {
  return (
    <V2Page>
      <V2ContentHero
        eyebrow={t('Espírito esportivo')}
        title={t('Conduta & Fair Play')}
        description={t('Princípios de respeito, integridade e fair play que orientam o uso da plataforma PickleRush.')}
      />

      <div className="space-y-4">
        <V2ContentSection icon={HeartHandshake} title={t('Respeito ao adversário e ao parceiro')}>
          <p>
            {t('O pickleball é, antes de tudo, um esporte social. Cumprimente o adversário antes e depois do jogo, evite comemorações excessivas em pontos do oponente e mantenha a comunicação em duplas em tom positivo.')}
          </p>
        </V2ContentSection>

        <V2ContentSection icon={Shield} title={t('Integridade nas chamadas e resultados')}>
          <p>
            {t('As regras CBP e USAP consideram o jogador responsável pela honestidade das chamadas no próprio lado. Em torneios sem árbitro central, a dúvida favorece o adversário.')}
          </p>
          <V2BulletList items={[
            t('Não altere intencionalmente placares lançados na plataforma.'),
            t('Se discordar do registro, fale com o admin do torneio.'),
            t('WO (walk-over) só deve ser aplicado quando realmente houver ausência justificada.'),
          ]} />
        </V2ContentSection>

        <V2ContentSection icon={Sparkles} title={t('Inclusão e diversidade')}>
          <p>
            {t('Torneios são abertos a todos os níveis e perfis. Discriminação por gênero, idade, orientação sexual, raça, religião ou condição física é incompatível com o esporte e com a plataforma.')}
          </p>
        </V2ContentSection>

        <V2ContentSection icon={AlertTriangle} title={t('Conduta vedada')}>
          <V2BulletList items={[
            t('Insultos, agressões verbais ou físicas.'),
            t('Lançamento intencional de resultados falsos.'),
            t('Uso de identidade de outra pessoa.'),
            t('Apostas em dinheiro entre participantes — a plataforma não suporta nem incentiva.'),
          ]} />
        </V2ContentSection>

        <V2ContentSection icon={BookOpen} title={t('Saúde no esporte')}>
          <p>
            {t('Faça aquecimento antes das partidas, hidrate-se, respeite os limites do seu corpo e procure orientação médica/profissional para evolução técnica e física.')}
          </p>
        </V2ContentSection>
      </div>
    </V2Page>
  );
}

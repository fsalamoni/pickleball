import React from 'react';
import { Navigate } from 'react-router-dom';
import { Flag, Globe2, History, Lightbulb, Sparkles } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { V2BulletList, V2ContentHero, V2ContentSection } from '@/v2/ui/primitives';

const MILESTONES = [
  ['1965', 'Nasce o pickleball em Bainbridge Island (Washington, EUA), criado por Joel Pritchard, Bill Bell e Barney McCallum para entreter as famílias no verão, improvisando com raquetes de tênis de mesa e uma bola perfurada.'],
  ['1967', 'É construída a primeira quadra pensada exclusivamente para o esporte.'],
  ['1972', 'O pickleball é formalizado como empresa/organização para proteger e difundir o jogo.'],
  ['1984', 'Fundação da associação nacional dos EUA e publicação do primeiro livro de regras.'],
  ['2010s', 'Expansão acelerada pela América do Norte, com forte adesão de todas as idades.'],
  ['Hoje', 'Um dos esportes que mais crescem no mundo, com comunidades ativas no Brasil e circuitos amadores e profissionais.'],
];

const CURIOSITIES = [
  'O nome tem duas versões: a do cachorro da família (Pickles) e a do "pickle boat" do remo, barco formado por remadores que sobravam de outras equipes — combinando elementos de vários esportes.',
  'Mistura tênis, badminton e tênis de mesa: quadra pequena, raquete sólida (paddle) e bola de plástico com furos.',
  'A "kitchen" (cozinha) é a zona de não-voleio junto à rede — não se pode dar smash de dentro dela, o que valoriza a estratégia sobre a força.',
  'O saque é feito por baixo, tornando o início do ponto mais acessível a iniciantes.',
  'É muito social: as duplas e o ritmo do jogo favorecem a convivência, por isso cresce tão rápido em clubes e arenas.',
];

export default function V2History() {
  const enabled = useFeatureFlag(FEATURE_FLAG.SPORT_HISTORY);
  if (!enabled) return <Navigate to="/v2" replace />;

  return (
    <div className="mx-auto max-w-[900px]">
      <V2ContentHero
        eyebrow="História do esporte"
        title="Como o pickleball saiu de uma brincadeira e virou uma comunidade global"
        description="Uma leitura pública para contextualizar a cultura do jogo e aproximar novos usuários do universo da plataforma."
      />

      <div className="space-y-4">
        <V2ContentSection icon={Sparkles} title="O que é o pickleball">
          <p>
            O pickleball é um esporte de raquete que combina elementos do tênis, do badminton e do
            tênis de mesa. Jogado em uma quadra compacta, com raquetes sólidas e uma bola leve e
            perfurada, é fácil de aprender, intenso e extremamente social — o que explica seu
            crescimento acelerado no Brasil e no mundo.
          </p>
        </V2ContentSection>

        <V2ContentSection icon={History} title="Como surgiu">
          <p>
            Em 1965, na Ilha de Bainbridge (EUA), três amigos — Joel Pritchard, Bill Bell e Barney
            McCallum — improvisaram um jogo para animar as crianças durante o verão. Sem uma bola de
            badminton à mão, usaram uma bola de plástico furada, baixaram a rede e adaptaram raquetes.
            Nascia ali um esporte novo, pensado desde o início para ser acessível a toda a família.
          </p>
        </V2ContentSection>

        <V2ContentSection icon={Flag} title="Linha do tempo">
          <ul className="space-y-2">
            {MILESTONES.map(([year, text]) => (
              <li key={year} className="flex gap-3">
                <span className="shrink-0 rounded-lg bg-acid/20 px-2 py-0.5 text-xs font-bold text-ink">{year}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </V2ContentSection>

        <V2ContentSection icon={Lightbulb} title="Curiosidades">
          <V2BulletList items={CURIOSITIES} />
        </V2ContentSection>

        <V2ContentSection icon={Globe2} title="No Brasil e na Pickleholics">
          <p>
            Por unir baixa barreira de entrada, forte apelo social e partidas rápidas, o pickleball
            vem formando comunidades por todo o país. Na Pickleholics você encontra torneios, clubes,
            atletas e arenas para jogar — do primeiro rali ao pódio.
          </p>
        </V2ContentSection>
      </div>
    </div>
  );
}

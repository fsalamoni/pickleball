import React from 'react';
import { GitBranch, Layers, Sparkles, Trophy, Users } from 'lucide-react';
import {
  MODALITY_FORMAT,
  MODALITY_FORMAT_LABELS,
  TOURNAMENT_STAGE_TYPE,
  TOURNAMENT_STAGE_TYPE_LABELS,
  PHASE_DIVISION_MODE_LABELS,
  PHASE_QUALIFIER_MODE_LABELS,
  PHASE_FEED_MODE_LABELS,
  PHASE_PAIRING_MODE_LABELS,
  PHASE_BRACKET_SEEDING_LABELS,
} from '@/modules/tournament/domain/constants';
import { FORMAT_DESCRIPTION, STAGE_DESCRIPTION, STAGE_MIN_PLAYERS } from '@/modules/tournament/domain/formatExplain';
import { TOURNAMENT_PRESETS } from '@/modules/tournament/domain/tournamentPresets';
import { V2Badge, V2ContentHero, V2ContentSection } from '@/v2/ui/primitives';

const STAGE_ORDER = [
  TOURNAMENT_STAGE_TYPE.ROUND_ROBIN,
  TOURNAMENT_STAGE_TYPE.GROUPS,
  TOURNAMENT_STAGE_TYPE.KNOCKOUT,
  TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT,
  TOURNAMENT_STAGE_TYPE.SWISS,
  TOURNAMENT_STAGE_TYPE.AMERICANO,
  TOURNAMENT_STAGE_TYPE.MEXICANO,
];

function Item({ title, badge, children }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{title}</span>
        {badge && <V2Badge tone="neutral">{badge}</V2Badge>}
      </div>
      <p className="mt-1 text-sm leading-6 text-gray-600">{children}</p>
    </div>
  );
}

export default function V2FormatsGuide() {
  return (
    <div className="mx-auto max-w-[900px]">
      <V2ContentHero
        eyebrow="Organização"
        title="Guia de formatos e modelos de torneio"
        description="Formatos de inscrição, sistemas de jogo, múltiplas fases e modelos prontos. A inscrição é sempre em lista única por modalidade; grupos, chaves e fases são organizados pelo admin."
      />

      <div className="space-y-4">
        <V2ContentSection icon={Users} title="Formatos de inscrição">
          <div className="space-y-2">
            {Object.values(MODALITY_FORMAT).map((f) => (
              <Item key={f} title={MODALITY_FORMAT_LABELS[f]}>{FORMAT_DESCRIPTION[f]}</Item>
            ))}
          </div>
        </V2ContentSection>

        <V2ContentSection icon={Trophy} title="Sistemas de jogo (formatos de fase)">
          <div className="space-y-2">
            {STAGE_ORDER.map((s) => (
              <Item key={s} title={TOURNAMENT_STAGE_TYPE_LABELS[s]} badge={`mín. ${STAGE_MIN_PLAYERS[s] ?? 2} jogadores`}>
                {STAGE_DESCRIPTION[s]}
              </Item>
            ))}
          </div>
        </V2ContentSection>

        <V2ContentSection icon={Layers} title="Como funcionam as múltiplas fases">
          <p>
            Uma modalidade pode ter várias fases encadeadas (ex.: grupos → mata-mata). Em cada fase você define como os
            atletas são divididos, quem se classifica e como a próxima fase recebe os classificados.
          </p>
          <div className="space-y-2">
            <Item title="Divisão em grupos"><strong className="text-ink">Modos:</strong> {Object.values(PHASE_DIVISION_MODE_LABELS).join(' · ')}. Grupos equilibrados por gênero e nível, com diferença máxima de 1 atleta entre grupos.</Item>
            <Item title="Quem se classifica">Você define quantos passam por grupo e o critério: {Object.values(PHASE_QUALIFIER_MODE_LABELS).join(' ou ')}.</Item>
            <Item title="Como a próxima fase recebe os classificados">{Object.values(PHASE_FEED_MODE_LABELS).join(' · ')}. A fusão permite juntar grupos (A+B → AB); juntar todos redistribui em novos grupos equilibrados.</Item>
            <Item title="Formação de duplas">{Object.values(PHASE_PAIRING_MODE_LABELS).join(' · ')}. Permite formar dupla mista (melhor homem + melhor mulher do grupo) para a fase seguinte.</Item>
            <Item title="Chaveamento (mata-mata a partir de classificados)">{Object.values(PHASE_BRACKET_SEEDING_LABELS).join(' · ')}. O cruzado faz o vencedor do grupo A enfrentar o do B; o clássico espalha os cabeças-de-chave.</Item>
            <Item title="Disputa de 3º lugar">Opcional no mata-mata: os perdedores das semifinais decidem a medalha de bronze.</Item>
          </div>
        </V2ContentSection>

        <V2ContentSection icon={GitBranch} title="Sorteio e organização">
          <p>
            A organização dos grupos e chaves é feita pelo admin na aba <strong className="text-ink">Sorteio</strong>, por sorteio automático
            (equilibrado e reprodutível por uma semente) ou por seleção manual. O sorteio respeita o equilíbrio entre homens e
            mulheres e o nivelamento. Por isso é importante informar o gênero e o nível de cada atleta na inscrição.
          </p>
        </V2ContentSection>

        <V2ContentSection icon={Sparkles} title="Modelos prontos de torneio">
          <p>No editor de fases é possível começar a partir de um destes modelos e ajustar os números.</p>
          <div className="space-y-2">
            {TOURNAMENT_PRESETS.map((p) => (
              <Item key={p.id} title={p.label} badge={p.formats.length === 1 ? MODALITY_FORMAT_LABELS[p.formats[0]] : 'Simples e Duplas'}>
                {p.description}
              </Item>
            ))}
          </div>
        </V2ContentSection>

        <V2ContentSection icon={Trophy} title="Como a classificação é calculada">
          <p>
            A posição é definida pelo número de <strong className="text-ink">vitórias</strong>. Em caso de empate valem, na ordem: saldo de
            pontos (a favor − contra), pontos marcados e, por fim, menor número de pontos sofridos. Em torneios com fases e
            grupos, a classificação é exibida por fase e por grupo, e as duplas formadas são classificadas como uma unidade.
          </p>
        </V2ContentSection>
      </div>
    </div>
  );
}

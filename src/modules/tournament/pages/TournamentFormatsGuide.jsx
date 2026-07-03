import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Layers, Trophy, Users, GitBranch, Sparkles, ArrowLeft } from 'lucide-react';
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

function Section({ icon: Icon, title, children }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h2 className="text-lg font-bold font-display text-ink flex items-center gap-2">
          <Icon className="w-5 h-5 text-green-600" /> {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Item({ title, badge, children }) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-ink">{title}</span>
        {badge && <Badge variant="secondary">{badge}</Badge>}
      </div>
      <p className="text-sm text-gray-500 mt-1">{children}</p>
    </div>
  );
}

const STAGE_ORDER = [
  TOURNAMENT_STAGE_TYPE.ROUND_ROBIN,
  TOURNAMENT_STAGE_TYPE.GROUPS,
  TOURNAMENT_STAGE_TYPE.KNOCKOUT,
  TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT,
  TOURNAMENT_STAGE_TYPE.SWISS,
  TOURNAMENT_STAGE_TYPE.AMERICANO,
  TOURNAMENT_STAGE_TYPE.MEXICANO,
];

export default function TournamentFormatsGuide() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-10">
      <div className="space-y-1">
        <Link to="/inicio" className="text-sm text-green-700 inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-bold font-display text-ink flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-green-600" /> Guia de formatos e modelos de torneio
        </h1>
        <p className="text-sm text-gray-500">
          Tudo o que a plataforma sabe organizar: os formatos de inscrição, os sistemas de jogo, os
          conceitos de múltiplas fases e os modelos prontos. A inscrição é sempre feita em
          <strong> lista única</strong> por modalidade; a organização de grupos, chaves e fases é
          feita pelo admin (por sorteio equilibrado ou seleção manual).
        </p>
      </div>

      <Section icon={Users} title="Formatos de inscrição">
        {Object.values(MODALITY_FORMAT).map((f) => (
          <Item key={f} title={MODALITY_FORMAT_LABELS[f]}>{FORMAT_DESCRIPTION[f]}</Item>
        ))}
      </Section>

      <Section icon={Trophy} title="Sistemas de jogo (formatos de fase)">
        {STAGE_ORDER.map((s) => (
          <Item
            key={s}
            title={TOURNAMENT_STAGE_TYPE_LABELS[s]}
            badge={`mín. ${STAGE_MIN_PLAYERS[s] ?? 2} jogadores`}
          >
            {STAGE_DESCRIPTION[s]}
          </Item>
        ))}
      </Section>

      <Section icon={Layers} title="Como funcionam as múltiplas fases">
        <p className="text-sm text-gray-500">
          Uma modalidade pode ter várias fases encadeadas (ex.: grupos → mata-mata). Em cada fase
          você define como os atletas são divididos, quem se classifica e como a próxima fase recebe
          os classificados.
        </p>
        <div className="space-y-2">
          <Item title="Divisão em grupos">
            <strong>Modos:</strong>{' '}
            {Object.values(PHASE_DIVISION_MODE_LABELS).join(' · ')}. Os grupos são sempre
            equilibrados por gênero e nível, com diferença máxima de <strong>1 atleta</strong> entre
            grupos (ex.: 19 atletas em 4 grupos → 5, 5, 5 e 4).
          </Item>
          <Item title="Quem se classifica">
            Você define quantos passam por grupo e o critério:{' '}
            {Object.values(PHASE_QUALIFIER_MODE_LABELS).join(' ou ')}. O critério por gênero é útil,
            por exemplo, para passar o melhor homem e a melhor mulher de cada grupo.
          </Item>
          <Item title="Como a próxima fase recebe os classificados">
            {Object.values(PHASE_FEED_MODE_LABELS).join(' · ')}. A fusão permite juntar grupos
            (A+B → AB); juntar todos redistribui em novos grupos equilibrados.
          </Item>
          <Item title="Formação de duplas">
            {Object.values(PHASE_PAIRING_MODE_LABELS).join(' · ')}. Permite, por exemplo, formar uma
            dupla mista (melhor homem + melhor mulher do grupo) para a fase seguinte.
          </Item>
          <Item title="Chaveamento (mata-mata a partir de classificados)">
            {Object.values(PHASE_BRACKET_SEEDING_LABELS).join(' · ')}. O cruzado faz o vencedor do
            grupo A enfrentar o do B, C×D etc.; o clássico espalha os cabeças-de-chave.
          </Item>
          <Item title="Disputa de 3º lugar">
            Opcional no mata-mata: os perdedores das semifinais decidem a medalha de bronze.
          </Item>
        </div>
      </Section>

      <Section icon={GitBranch} title="Sorteio e organização">
        <p className="text-sm text-gray-500">
          A organização dos grupos e chaves é feita pelo admin na aba <strong>Sorteio</strong>, por
          <strong> sorteio automático</strong> (equilibrado e reprodutível por uma semente) ou por
          <strong> seleção manual</strong>. O sorteio respeita o equilíbrio entre homens e mulheres e
          o nivelamento, para que nenhum grupo fique muito mais forte que outro. Por isso é
          importante informar o <strong>gênero</strong> e o <strong>nível</strong> de cada atleta na
          inscrição.
        </p>
      </Section>

      <Section icon={Sparkles} title="Modelos prontos de torneio">
        <p className="text-sm text-gray-500">
          No editor de fases é possível começar a partir de um destes modelos e ajustar os números.
        </p>
        <div className="space-y-2">
          {TOURNAMENT_PRESETS.map((p) => (
            <Item
              key={p.id}
              title={p.label}
              badge={p.formats.length === 1 ? MODALITY_FORMAT_LABELS[p.formats[0]] : 'Simples e Duplas'}
            >
              {p.description}
            </Item>
          ))}
        </div>
      </Section>

      <Section icon={Trophy} title="Como a classificação é calculada">
        <p className="text-sm text-gray-500">
          A posição é definida pelo número de <strong>vitórias</strong>. Em caso de empate valem, na
          ordem: <strong>saldo de pontos</strong> (a favor − contra), <strong>pontos marcados</strong>{' '}
          e, por fim, <strong>menor número de pontos sofridos</strong>. Em torneios com fases e
          grupos, a classificação é exibida <strong>por fase e por grupo</strong>, e as duplas
          formadas são classificadas como uma unidade.
        </p>
      </Section>
    </div>
  );
}

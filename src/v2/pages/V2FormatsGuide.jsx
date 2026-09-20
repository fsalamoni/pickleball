import React from 'react';
import { GitBranch, Layers, Sparkles, Trophy, Users, Scale, SkipForward, Settings2 } from 'lucide-react';
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
import { describeTiebreakOrder } from '@/modules/tournament/domain/tiebreak';
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
            <Item title="Divisão em grupos"><strong className="text-ink">Modos:</strong> {Object.values(PHASE_DIVISION_MODE_LABELS).join(' · ')}. Por padrão os grupos saem equilibrados por gênero e nível, com diferença máxima de 1 atleta entre eles — e o admin pode escrever os tamanhos à mão quando quiser outra coisa.</Item>
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

        <V2ContentSection icon={Scale} title="Como a classificação é calculada">
          <p>
            A ordem padrão é a do regulamento (USA&nbsp;Pickleball 15.B.4). O admin do torneio
            pode trocá-la inteira nas regras avançadas da fase.
          </p>
          <ol className="mt-2 space-y-1.5">
            {describeTiebreakOrder([]).map((c) => (
              <li key={c.key} className="flex gap-2 text-sm">
                <span className="w-5 shrink-0 text-right font-bold text-gray-400">{c.position}º</span>
                <span><strong className="text-ink">{c.label}</strong> — {c.help}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2">
            Com três ou mais empatados, o <strong className="text-ink">confronto direto</strong> vira
            uma mini-tabela só entre eles; quando um critério separa parte do grupo, os que continuam
            empatados são comparados de novo a partir do primeiro critério, só entre si. Quem não se
            enfrentou: o critério é pulado, nunca inventado. As duplas formadas são classificadas como
            uma unidade.
          </p>
        </V2ContentSection>

        <V2ContentSection icon={Users} title="Quando o número de inscritos não é o ideal">
          <p>
            Torneio amador quase nunca tem número redondo — e isso não é problema a resolver, é a
            situação normal. O que muda é a regra, não o número de inscritos.
          </p>
          <div className="mt-2 space-y-2">
            <Item title="Grupos de tamanhos diferentes">
              19 inscritos em 4 grupos dão 5, 5, 5 e 4 — e está certo. Quem joga menos partidas não
              sai prejudicado: a comparação entre grupos é por <strong className="text-ink">aproveitamento</strong> (vitórias
              e saldo divididos pelas partidas jogadas), então 3 vitórias em 3 valem mais que 3 em 4.
              Antes de tudo vem a colocação: um 2º nunca passa à frente de um 1º.
            </Item>
            <Item title="Grupo pequeno demais">
              Grupo de 2 não é grupo — é uma partida só, e quem perde vai embora. O sistema bloqueia.
              Grupo de 3 dá 2 jogos por atleta; com <strong className="text-ink">ida e volta</strong> vira 4, que é o
              que quem se inscreve espera.
            </Item>
            <Item title="Os classificados não fecham a chave">
              10 classificados numa chave de 16 são 6 byes. As duas saídas aparecem na tela:
              <strong className="text-ink"> repescar</strong> os melhores não classificados até encher a chave, ou
              classificar menos e usar a chave menor. A repescagem compara <strong className="text-ink">iguais</strong> —
              um 4º colocado nunca entra na frente de um 3º.
            </Item>
            <Item title="A chave não é potência de 2">
              Quem recebe <strong className="text-ink">bye</strong> na 1ª rodada são os melhores cabeças — é a regra
              usada pelo DUPR, e recompensa quem foi bem no ranking. O número de byes é sempre
              exatamente o que falta para encher a chave.
            </Item>
          </div>
        </V2ContentSection>

        <V2ContentSection icon={SkipForward} title="Entrar direto numa fase (pular fases)">
          <p>
            Nem todo mundo precisa entrar no mesmo ponto. O admin pode fazer os melhores cabeças —
            ou uma lista escolhida a dedo — <strong className="text-ink">pularem as fases iniciais</strong> e
            entrarem mais à frente, como cabeças.
          </p>
          <div className="mt-2 space-y-2">
            <Item title="Modelo de qualificatória">
              Os 8 melhores entram direto na chave principal; os demais disputam um pré-torneio pelas
              vagas restantes.
            </Item>
            <Item title="Campeão ou convidado">
              Uma lista escolhida nome por nome, para quem entra por outro critério que não o ranking.
            </Item>
            <Item title="As travas">
              Cada pessoa entra uma vez só (vale a fase mais cedo); a primeira fase precisa continuar
              com ao menos 2; e numa próxima fase de grupos os que entram direto são espalhados, em
              vez de formarem um grupo da morte por acidente.
            </Item>
          </div>
          <p className="mt-2">
            Configura-se na aba <strong className="text-ink">Sorteio</strong>, onde os nomes já existem, e a tela
            mostra o resultado antes de sortear.
          </p>
        </V2ContentSection>

        <V2ContentSection icon={Settings2} title="O que o admin do torneio pode mudar">
          <p>
            Existe um padrão bom — e ele pode ser trocado inteiro. Cada controle traz, ao lado, a
            explicação do que a troca causa. Em branco, tudo se comporta como o padrão.
          </p>
          <div className="mt-2 space-y-2">
            <Item title="Formação dos grupos">
              Tamanhos escritos à mão (<code>6, 5, 5</code>), número de grupos, máximo por grupo, e
              turnos (só ida ou ida e volta).
            </Item>
            <Item title="Quem passa">
              Classificados por grupo — inclusive grupo a grupo (<code>2, 2, 1</code>) —, critério geral
              ou por gênero, vagas de repescagem e de qual colocação repescar.
            </Item>
            <Item title="Como se compara">
              A ordem dos critérios de desempate dentro do grupo (9 critérios, com ordens prontas) e o
              método de comparação entre grupos: aproveitamento, números absolutos, ou descartar o jogo
              contra o último colocado de cada grupo (a regra da FIFA).
            </Item>
            <Item title="A fase seguinte">
              Como recebe os classificados, se forma duplas, o chaveamento, a disputa de 3º lugar, e
              quem entra direto nela.
            </Item>
          </div>
        </V2ContentSection>
      </div>
    </div>
  );
}

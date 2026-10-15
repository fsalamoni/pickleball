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
import { t } from '@/core/i18n';

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
  // O Americano em etapas só aparece no guia quando pode ser escolhido.
  const etapasOn = true;
  const ordem = etapasOn ? [...STAGE_ORDER, TOURNAMENT_STAGE_TYPE.AMERICANO_ETAPAS] : STAGE_ORDER;
  return (
    <div className="mx-auto max-w-[1000px]">
      <V2ContentHero
        eyebrow={t('Organização')}
        title={t('Guia de formatos e modelos de torneio')}
        description={t('Formatos de inscrição, sistemas de jogo, múltiplas fases e modelos prontos. A inscrição é sempre em lista única por modalidade; grupos, chaves e fases são organizados pelo admin.')}
      />

      <div className="space-y-4">
        <V2ContentSection icon={Users} title={t('Formatos de inscrição')}>
          <div className="space-y-2">
            {Object.values(MODALITY_FORMAT).map((f) => (
              <Item key={f} title={t(MODALITY_FORMAT_LABELS[f])}>{t(FORMAT_DESCRIPTION[f])}</Item>
            ))}
          </div>
        </V2ContentSection>

        <V2ContentSection icon={Trophy} title={t('Sistemas de jogo (formatos de fase)')}>
          <div className="space-y-2">
            {ordem.map((s) => (
              <Item key={s} title={t(TOURNAMENT_STAGE_TYPE_LABELS[s])} badge={t('mín. {n} jogadores', { n: STAGE_MIN_PLAYERS[s] ?? 2 })}>
                {t(STAGE_DESCRIPTION[s])}
              </Item>
            ))}
          </div>
        </V2ContentSection>

        <V2ContentSection icon={Layers} title={t('Como funcionam as múltiplas fases')}>
          <p>
            {t('Uma modalidade pode ter várias fases encadeadas (ex.: grupos → mata-mata). Em cada fase você define como os atletas são divididos, quem se classifica e como a próxima fase recebe os classificados.')}
          </p>
          <div className="space-y-2">
            <Item title={t('Divisão em grupos')}><strong className="text-ink">{t('Modos:')}</strong> {Object.values(PHASE_DIVISION_MODE_LABELS).map((x) => t(x)).join(' · ')}. {t('Por padrão os grupos saem equilibrados por gênero e nível, com diferença máxima de 1 atleta entre eles — e o admin pode escrever os tamanhos à mão quando quiser outra coisa.')}</Item>
            <Item title={t('Quem se classifica')}>{t('Você define quantos passam por grupo e o critério: {lista}.', { lista: Object.values(PHASE_QUALIFIER_MODE_LABELS).map((x) => t(x)).join(t(' ou ')) })}</Item>
            <Item title={t('Como a próxima fase recebe os classificados')}>{Object.values(PHASE_FEED_MODE_LABELS).map((x) => t(x)).join(' · ')}. {t('A fusão permite juntar grupos (A+B → AB); juntar todos redistribui em novos grupos equilibrados.')}</Item>
            <Item title={t('Formação de duplas')}>{Object.values(PHASE_PAIRING_MODE_LABELS).map((x) => t(x)).join(' · ')}. {t('Permite formar dupla mista (melhor homem + melhor mulher do grupo) para a fase seguinte.')}</Item>
            <Item title={t('Chaveamento (mata-mata a partir de classificados)')}>{Object.values(PHASE_BRACKET_SEEDING_LABELS).map((x) => t(x)).join(' · ')}. {t('O cruzado faz o vencedor do grupo A enfrentar o do B; o clássico espalha os cabeças-de-chave.')}</Item>
            <Item title={t('Disputa de 3º lugar')}>{t('Opcional no mata-mata: os perdedores das semifinais decidem a medalha de bronze.')}</Item>
          </div>
        </V2ContentSection>

        <V2ContentSection icon={GitBranch} title={t('Sorteio e organização')}>
          <p>
            {t('A organização dos grupos e chaves é feita pelo admin na aba')} <strong className="text-ink">{t('Sorteio')}</strong>{t(', por sorteio automático (equilibrado e reprodutível por uma semente) ou por seleção manual. O sorteio respeita o equilíbrio entre homens e mulheres e o nivelamento. Por isso é importante informar o gênero e o nível de cada atleta na inscrição.')}
          </p>
        </V2ContentSection>

        <V2ContentSection icon={Sparkles} title={t('Modelos prontos de torneio')}>
          <p>{t('No editor de fases é possível começar a partir de um destes modelos e ajustar os números.')}</p>
          <div className="space-y-2">
            {TOURNAMENT_PRESETS.map((p) => (
              <Item key={p.id} title={t(p.label)} badge={p.formats.length === 1 ? t(MODALITY_FORMAT_LABELS[p.formats[0]]) : t('Simples e Duplas')}>
                {t(p.description)}
              </Item>
            ))}
          </div>
        </V2ContentSection>

        <V2ContentSection icon={Scale} title={t('Como a classificação é calculada')}>
          <p>
            {t('A ordem padrão é a do regulamento (USA Pickleball 15.B.4). O admin do torneio pode trocá-la inteira nas regras avançadas da fase.')}
          </p>
          <ol className="mt-2 space-y-1.5">
            {describeTiebreakOrder([]).map((c) => (
              <li key={c.key} className="flex gap-2 text-sm">
                <span className="w-5 shrink-0 text-right font-bold text-gray-400">{c.position}º</span>
                <span><strong className="text-ink">{t(c.label)}</strong> — {t(c.help)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2">
            {t('Com três ou mais empatados, o')} <strong className="text-ink">{t('confronto direto')}</strong>{' '}
            {t('vira uma mini-tabela só entre eles; quando um critério separa parte do grupo, os que continuam empatados são comparados de novo a partir do primeiro critério, só entre si. Quem não se enfrentou: o critério é pulado, nunca inventado. As duplas formadas são classificadas como uma unidade.')}
          </p>
        </V2ContentSection>

        <V2ContentSection icon={Users} title={t('Quando o número de inscritos não é o ideal')}>
          <p>
            {t('Torneio amador quase nunca tem número redondo — e isso não é problema a resolver, é a situação normal. O que muda é a regra, não o número de inscritos.')}
          </p>
          <div className="mt-2 space-y-2">
            <Item title={t('Grupos de tamanhos diferentes')}>
              {t('19 inscritos em 4 grupos dão 5, 5, 5 e 4 — e está certo. Quem joga menos partidas não sai prejudicado: a comparação entre grupos é por')} <strong className="text-ink">{t('aproveitamento')}</strong> {t('(vitórias e saldo divididos pelas partidas jogadas), então 3 vitórias em 3 valem mais que 3 em 4. Antes de tudo vem a colocação: um 2º nunca passa à frente de um 1º.')}
            </Item>
            <Item title={t('Grupo pequeno demais')}>
              {t('Grupo de 2 não é grupo — é uma partida só, e quem perde vai embora. O sistema bloqueia. Grupo de 3 dá 2 jogos por atleta; com')}{' '}
              <strong className="text-ink">{t('ida e volta')}</strong> {t('vira 4, que é o que quem se inscreve espera.')}
            </Item>
            <Item title={t('Os classificados não fecham a chave')}>
              {t('10 classificados numa chave de 16 são 6 byes. As duas saídas aparecem na tela:')}
              <strong className="text-ink"> {t('repescar')}</strong> {t('os melhores não classificados até encher a chave, ou classificar menos e usar a chave menor. A repescagem compara')} <strong className="text-ink">{t('iguais')}</strong> {t('— um 4º colocado nunca entra na frente de um 3º.')}
            </Item>
            <Item title={t('A chave não é potência de 2')}>
              {t('Quem recebe')} <strong className="text-ink">{t('bye')}</strong> {t('na 1ª rodada são os melhores cabeças — é a regra usada pelo DUPR, e recompensa quem foi bem no ranking. O número de byes é sempre exatamente o que falta para encher a chave.')}
            </Item>
          </div>
        </V2ContentSection>

        <V2ContentSection icon={SkipForward} title={t('Entrar direto numa fase (pular fases)')}>
          <p>
            {t('Nem todo mundo precisa entrar no mesmo ponto. O admin pode fazer os melhores cabeças — ou uma lista escolhida a dedo —')} <strong className="text-ink">{t('pularem as fases iniciais')}</strong> {t('e entrarem mais à frente, como cabeças.')}
          </p>
          <div className="mt-2 space-y-2">
            <Item title={t('Modelo de qualificatória')}>
              {t('Os 8 melhores entram direto na chave principal; os demais disputam um pré-torneio pelas vagas restantes.')}
            </Item>
            <Item title={t('Campeão ou convidado')}>
              {t('Uma lista escolhida nome por nome, para quem entra por outro critério que não o ranking.')}
            </Item>
            <Item title={t('As travas')}>
              {t('Cada pessoa entra uma vez só (vale a fase mais cedo); a primeira fase precisa continuar com ao menos 2; e numa próxima fase de grupos os que entram direto são espalhados, em vez de formarem um grupo da morte por acidente.')}
            </Item>
          </div>
          <p className="mt-2">
            {t('Configura-se na aba')} <strong className="text-ink">{t('Sorteio')}</strong>{t(', onde os nomes já existem, e a tela mostra o resultado antes de sortear.')}
          </p>
        </V2ContentSection>

        <V2ContentSection icon={Settings2} title={t('O que o admin do torneio pode mudar')}>
          <p>
            {t('Existe um padrão bom — e ele pode ser trocado inteiro. Cada controle traz, ao lado, a explicação do que a troca causa. Em branco, tudo se comporta como o padrão.')}
          </p>
          <div className="mt-2 space-y-2">
            <Item title={t('Formação dos grupos')}>
              {t('Tamanhos escritos à mão (')}<code>6, 5, 5</code>{t('), número de grupos, máximo por grupo, e turnos (só ida ou ida e volta).')}
            </Item>
            <Item title={t('Quem passa')}>
              {t('Classificados por grupo — inclusive grupo a grupo (')}<code>2, 2, 1</code>{t(') —, critério geral ou por gênero, vagas de repescagem e de qual colocação repescar.')}
            </Item>
            <Item title={t('Como se compara')}>
              {t('A ordem dos critérios de desempate dentro do grupo (9 critérios, com ordens prontas) e o método de comparação entre grupos: aproveitamento, números absolutos, ou descartar o jogo contra o último colocado de cada grupo (a regra da FIFA).')}
            </Item>
            <Item title={t('A fase seguinte')}>
              {t('Como recebe os classificados, se forma duplas, o chaveamento, a disputa de 3º lugar, e quem entra direto nela.')}
            </Item>
          </div>
        </V2ContentSection>
      </div>
    </div>
  );
}

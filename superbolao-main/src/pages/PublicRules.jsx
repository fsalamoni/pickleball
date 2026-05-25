import { Clock, ShieldCheck, TableProperties, Target, Trophy } from 'lucide-react';
import { LegalList, LegalListItem, LegalPage, LegalSection, LegalStat } from '@/components/legal-page';
import { SEED_SCORING_TIERS, SPECIAL_BET_POINTS, MAX_POSSIBLE_POINTS } from '@/modules/tournament/data/seedScoringTiers';
import { SEED_DEADLINES_BRT } from '@/modules/tournament/data/seedDeadlines';

export default function PublicRules() {
  return (
    <LegalPage
      eyebrow="Regulamento oficial da plataforma"
      title="Regras do Bolão"
      description="Pontuação, prazos, sigilo dos palpites, pênaltis, zebras e critérios de desempate para todos os bolões da Copa 2026."
      meta="Horários exibidos em Brasília. Bolões com regras próprias podem ajustar configurações locais quando disponível."
    >
      <LegalSection icon={ShieldCheck} title="Regras Gerais" description="O funcionamento base do cartão e da apuração.">
        <LegalList>
          <LegalListItem>Palpites só são aceitos dentro dos prazos pré-estabelecidos. Após o fechamento, ficam imutáveis.</LegalListItem>
          <LegalListItem>Cada participante acessa apenas o seu próprio cartão. Os palpites permanecem em sigilo até o reveal automático após o deadline da fase.</LegalListItem>
          <LegalListItem>Critério de desempate no ranking geral: número de buchas, número de super buchas e melhor colocação na primeira fase.</LegalListItem>
          <LegalListItem>Critério de desempate no ranking de buchas: número de super buchas e pior colocação no ranking geral.</LegalListItem>
          <LegalListItem>Jogos não palpitados são processados como <strong>0x0</strong>, pontuando conforme as regras normais.</LegalListItem>
          <LegalListItem>Nas fases de mata-mata, os palpites referem-se ao placar de 90 minutos mais eventual prorrogação, até 120 minutos.</LegalListItem>
          <LegalListItem>Pênaltis só geram pontos extras quando o jogo realmente tiver decisão por pênaltis registrada no sistema.</LegalListItem>
        </LegalList>
      </LegalSection>

      <LegalSection icon={Target} title="Regras Específicas" description="Extras, zebras e super buchas.">
        <LegalList>
          <LegalListItem><strong>Campeão</strong> e <strong>Artilheiro</strong> da Copa devem ser palpitados antes do primeiro jogo e pontuam ao final do torneio.</LegalListItem>
          <LegalListItem>Partidas marcadas como <strong>Zebra</strong> têm multiplicador 2x, 3x ou 4x. O multiplicador aplica quando o usuário palpita na zebra e a zebra vence ou avança nos pênaltis.</LegalListItem>
          <LegalListItem><strong>Super Bucha</strong> é critério de desempate, sem pontos extras próprios: bucha com acerto dos pênaltis, bucha com zebra, ou acerto do campeão.</LegalListItem>
        </LegalList>
      </LegalSection>

      <LegalSection icon={TableProperties} title="Pontuação por Fase" description="Tabela de referência para os tipos de acerto.">
        <div className="arena-table-wrap">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="border-b border-emerald-950/10 bg-emerald-950 text-left text-emerald-50">
                <th className="py-3 pl-4 pr-4 font-semibold">Tipo de acerto</th>
                {SEED_SCORING_TIERS.map((t) => (
                  <th key={t.stage_code} className="py-3 px-2 text-right font-semibold">{t.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/10 text-slate-700">
              <Row label="Bucha (placar exato)" tiers={SEED_SCORING_TIERS} key1="exact_score" />
              <Row label="Vencedor + diferença / empate sem bucha" tiers={SEED_SCORING_TIERS} key1="winner_plus_diff" />
              <Row label="Vencedor + nº gols de um time" tiers={SEED_SCORING_TIERS} key1="winner_plus_team_goals" />
              <Row label="Apenas o vencedor" tiers={SEED_SCORING_TIERS} key1="winner_only" />
              <Row label="Apenas nº gols de um time" tiers={SEED_SCORING_TIERS} key1="team_goals_only" />
              <Row label="Vencedor dos pênaltis (extra)" tiers={SEED_SCORING_TIERS} key1="penalty_winner" />
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <LegalStat label="Campeão" value={`${SPECIAL_BET_POINTS.champion} pts`} />
          <LegalStat label="Artilheiro" value={`${SPECIAL_BET_POINTS.top_scorer} pts`} />
          <LegalStat label="Pontuação máxima" value={`${MAX_POSSIBLE_POINTS} pts`} />
        </div>
      </LegalSection>

      <LegalSection icon={Clock} title="Prazos para Palpites" description="Fechamento dos cartões por fase.">
        <ul className="divide-y divide-emerald-950/10 rounded-md border border-emerald-950/10 bg-white/55 text-sm text-slate-700">
          {Object.entries(SEED_DEADLINES_BRT).map(([k, v]) => (
            <li key={k} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium text-slate-800">{stageLabel(k)}</span>
              <span className="font-mono text-xs text-slate-500">{formatBRT(v)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">Horários de Brasília (UTC-3).</p>
      </LegalSection>

      <LegalSection icon={Trophy} title="Resumo Rápido" description="O que mais afeta o resultado no ranking.">
        <div className="grid gap-3 sm:grid-cols-3">
          <LegalStat label="Palpite ausente" value="0x0" />
          <LegalStat label="Zebra" value="2x a 4x" />
          <LegalStat label="Pênaltis" value="Só se houver" />
        </div>
      </LegalSection>
    </LegalPage>
  );
}

function Row({ label, tiers, key1 }) {
  return (
    <tr className="bg-white/50 odd:bg-emerald-50/45">
      <td className="py-2.5 pl-4 pr-4 font-medium text-slate-800">{label}</td>
      {tiers.map((t) => (
        <td key={t.stage_code} className="py-2.5 px-2 text-right font-mono tabular-nums">{t[key1] || '-'}</td>
      ))}
    </tr>
  );
}

function stageLabel(code) {
  return {
    group: '1ª Fase + Campeão + Artilheiro',
    r16: '16-avos de Final',
    qf: 'Oitavas de Final',
    sf: 'Quartas de Final',
    semi: 'Semifinais',
    third: 'Disputa de 3º Lugar',
    final: 'Final',
  }[code] || code;
}

function formatBRT(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

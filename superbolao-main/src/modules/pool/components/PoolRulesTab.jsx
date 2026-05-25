import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  getPoolScoringTiers,
  getScoringExplanationRows,
  getSportParameterRows,
  normalizePoolSettings,
  POOL_TEMPLATE_CODES,
} from '@/modules/pool/domain/poolSettings';

export function PoolRulesTab({ pool }) {
  const tiers = getPoolScoringTiers(pool);
  const settings = normalizePoolSettings(pool?.settings);
  const isCustom = pool?.template_code === POOL_TEMPLATE_CODES.custom;
  const rules = settings.rules;
  const explanations = getScoringExplanationRows(pool);
  const sportParameters = getSportParameterRows(settings);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Regras do bolão</CardTitle>
          <CardDescription>Regulamento integral válido para este bolão específico.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 text-sm leading-6 text-slate-700 sm:p-5">
          {pool?.description ? <p>{pool.description}</p> : <p>O criador deste bolão não adicionou descrição.</p>}
          <LegalList>
            <li>{rules.general_text}</li>
            <li>{rules.scoring_text}</li>
            <li>{rules.tiebreaker_text}</li>
            <li>{rules.default_bet_text}</li>
            <li>{rules.result_text}</li>
            {!isCustom && (
              <>
                <li>Campeão e Artilheiro da Copa devem ser palpitados antes do primeiro jogo e pontuam ao final do torneio.</li>
                <li>Nas fases de mata-mata, os palpites referem-se ao placar de 90 minutos mais eventual prorrogação, até 120 minutos.</li>
                <li>Quando houver decisão por pênaltis registrada, o placar dos pênaltis é pontuado como um jogo extra sem empate: pode render Bucha, vencedor com diferença, vencedor com placar de um lado, apenas vencedor ou apenas placar de um lado.</li>
                <li>Partidas marcadas como Zebra têm multiplicador 2x, 3x ou 4x quando o usuário palpita na zebra e ela vence ou avança nos pênaltis.</li>
                <li>Super Bucha é critério de desempate: bucha com acerto dos pênaltis, bucha com zebra ou acerto do campeão.</li>
              </>
            )}
            {rules.custom_sections.map((section, index) => (
              <li key={`${section.title || 'secao'}_${index}`}>
                {section.title ? <strong>{section.title}: </strong> : null}
                {section.body}
              </li>
            ))}
          </LegalList>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Contribuição sugerida" value={`R$ ${pool?.entry_fee || 0}`} />
            <InfoTile label="Código de convite" value={pool?.invite_code} monospace />
            {isCustom && <InfoTile label="Esporte" value={settings.sport_config.label} />}
            {isCustom && <InfoTile label="Unidade do placar" value={settings.sport_config.score_label} />}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Pontuação por fase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="arena-table-wrap">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-900/40 bg-emerald-950 text-left text-emerald-50">
                  <th className="py-3 pl-4 pr-4 font-semibold">Acerto</th>
                  {tiers.map((t) => (
                    <th key={t.stage_code} className="py-3 px-2 text-right font-semibold">{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-950/10 text-slate-700">
                <Row label="Bucha" tiers={tiers} k="exact_score" />
                <Row label="Vencedor + diferença" tiers={tiers} k="winner_plus_diff" />
                <Row label="Vencedor + nº gols" tiers={tiers} k="winner_plus_team_goals" />
                <Row label="Apenas vencedor" tiers={tiers} k="winner_only" />
                <Row label="Apenas nº gols" tiers={tiers} k="team_goals_only" />
                <Row label="Pênaltis: apenas vencedor (extra)" tiers={tiers} k="penalty_winner" />
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile label="Campeão" value={`${settings.special_bet_points.champion} pts`} />
            <InfoTile label="Artilheiro" value={`${settings.special_bet_points.top_scorer} pts`} />
            <InfoTile label="Zebras" value={settings.zebras_enabled ? 'habilitadas' : 'desabilitadas'} />
          </div>
          <div className="space-y-3 rounded-md border border-emerald-950/10 bg-white/65 p-3">
            <h3 className="text-sm font-semibold text-slate-950">Como cada pontuação é aplicada</h3>
            <div className="grid gap-3">
              {explanations.map((item) => (
                <div key={item.key} className="rounded-md border border-emerald-950/10 bg-emerald-50/35 p-3 text-sm leading-6 text-slate-700">
                  <div className="font-semibold text-emerald-900">{item.title}</div>
                  <p>{item.short}</p>
                  <p><strong>Exemplo:</strong> {item.example}</p>
                  <p className="text-xs text-slate-600"><strong>Observação:</strong> {item.caveat}</p>
                </div>
              ))}
            </div>
          </div>
          {isCustom && (
            <div className="space-y-3 rounded-md border border-emerald-950/10 bg-white/65 p-3">
              <h3 className="text-sm font-semibold text-slate-950">Parâmetros deste esporte</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {sportParameters.map(([label, value]) => (
                  <InfoTile key={label} label={label} value={value} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LegalList({ children }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

function InfoTile({ label, value, monospace }) {
  return (
    <div className="rounded-md border border-emerald-950/10 bg-white/65 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold text-emerald-800 ${monospace ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function Row({ label, tiers, k }) {
  return (
    <tr className="bg-white/50 odd:bg-emerald-50/45">
      <td className="py-2.5 pl-4 pr-4 font-medium text-slate-800">{label}</td>
      {tiers.map((t) => (
        <td key={t.stage_code} className="py-2.5 px-2 text-right font-mono tabular-nums">{t[k] || '-'}</td>
      ))}
    </tr>
  );
}

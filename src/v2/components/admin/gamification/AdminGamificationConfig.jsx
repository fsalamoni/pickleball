import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useGamificationConfig } from '@/modules/progression/hooks/useGamificationConfig';
import { saveGamificationConfig } from '@/modules/progression/services/gamificationConfigService';
import {
  DEFAULT_GAMIFICATION_CONFIG, GAMIFICATION_CONFIG_LIMITS, GAMIFICATION_MODULES, GAMIFICATION_MODULE_GROUPS,
  diffGamificationConfig, normalizeGamificationConfig,
} from '@/modules/progression/domain/gamificationConfig';
import { TIER_NAMES } from '@/modules/progression/domain/tiers';
import { V2Button, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import TermHint, { TermNote } from '@/v2/components/gamification/TermHint';

const NUM = [
  { path: 'season.prizeTop1', label: 'Prêmio do 1º da temporada (XP)', hint: 'Concedido uma única vez, quando o mês fecha.' },
  { path: 'season.prizeTop10Percent', label: 'Prêmio do top 10% (XP)' },
  { path: 'season.prizeParticipation', label: 'Prêmio de participação (XP)', hint: 'Só para quem teve XP no mês.' },
  { path: 'duels.winnerXp', label: 'XP de quem vence o duelo' },
  { path: 'duels.participationXp', label: 'XP de quem joga o duelo e não vence' },
  { path: 'duels.maxLevelGap', label: 'Diferença máxima de nível no duelo', hint: 'Em pontos da régua 2.0–8.0. Menor = duelos mais parelhos, mas menos pares.', step: 0.25 },
  { path: 'reviews.minForPublicScore', label: 'Avaliações para a nota aparecer', hint: 'Antes disso a pessoa não tem nota pública — poucas notas dizem pouco.' },
  { path: 'reviews.windowDays', label: 'Dias para avaliar um jogo' },
  { path: 'antiFarm.xpJumpPerDay', label: 'Salto de XP por dia que gera sinal', hint: 'Acima disso o servidor abre um sinal para você revisar. Nunca pune sozinho.' },
  { path: 'antiFarm.kudosRingMin', label: 'Kudos trocados que formam um “anel”' },
  { path: 'antiFarm.unverifiedXpFactor', label: 'XP além do que os jogos verificados sustentam (fator)', step: 0.5 },
];

const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const setIn = (o, path, v) => {
  const [a, b] = path.split('.');
  return { ...o, [a]: { ...o[a], [b]: v } };
};

/** Painel admin → Gamificação → Configuração: módulos, prêmios e limiares. */
export default function AdminGamificationConfig() {
  const { user } = useAuth();
  const { config: atual, isLoading } = useGamificationConfig();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!isLoading && draft === null) setDraft(atual); }, [isLoading, atual, draft]);
  const mudancas = useMemo(() => (draft ? diffGamificationConfig(atual, draft) : []), [atual, draft]);

  if (isLoading || !draft) return <V2Skeleton className="h-96 rounded-4xl" />;

  const salvar = async () => {
    setSaving(true);
    try {
      const salvo = await saveGamificationConfig(draft, atual, { uid: user?.uid, email: user?.email });
      setDraft(salvo);
      toast.success('Configuração salva. Vale na próxima passada do servidor e na hora para as telas.');
    } catch (e) {
      toast.error(e?.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="admin-gamification-config">
      <V2Surface className="space-y-4" data-dica="admin-gam-modulos">
        <div>
          <h2 className="flex items-center gap-1 font-display text-lg font-bold text-ink">Módulos <TermHint term="admin-modulos" /></h2>
          <p className="text-sm text-gray-500">A flag <code>gamification_v2</code> é o interruptor geral; aqui você liga e desliga cada parte. Módulo desligado some das telas e o servidor para de rodar a parte dele.</p>
        </div>
        {GAMIFICATION_MODULE_GROUPS.map((g) => (
          <div key={g.id} className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{g.label}</p>
            {Object.entries(GAMIFICATION_MODULES).filter(([, m]) => m.grupo === g.id).map(([id, m]) => (
              <V2Toggle key={id} id={`mod-${id}`} checked={draft.modules[id]} label={m.label} hint={m.description}
                onChange={(v) => setDraft((d) => ({ ...d, modules: { ...d.modules, [id]: v } }))} />
            ))}
          </div>
        ))}
      </V2Surface>

      <V2Surface className="space-y-4" data-dica="admin-gam-premios">
        <h2 className="flex items-center gap-1 font-display text-lg font-bold text-ink">Prêmios e limiares <TermHint term="admin-premios" /></h2>
        <V2Field label="Tier mínimo para aparecer no placar público" htmlFor="cfg-mintier" hint="Quem está abaixo disso ranqueia e recebe prêmios, mas não aparece para os outros.">
          <V2Select id="cfg-mintier" value={draft.season.publicMinTier} onChange={(e) => setDraft((d) => setIn(d, 'season.publicMinTier', e.target.value))}>
            {TIER_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </V2Select>
        </V2Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {NUM.map((n) => {
            const [min, max] = GAMIFICATION_CONFIG_LIMITS[n.path];
            return (
              <V2Field key={n.path} label={n.label} htmlFor={`cfg-${n.path}`} hint={n.hint ? `${n.hint} (${min}–${max})` : `${min}–${max}`}>
                <V2Input id={`cfg-${n.path}`} type="number" min={min} max={max} step={n.step || 1} value={get(draft, n.path)}
                  onChange={(e) => setDraft((d) => setIn(d, n.path, e.target.value === '' ? '' : Number(e.target.value)))} />
              </V2Field>
            );
          })}
        </div>
      </V2Surface>

      <V2Surface className="space-y-4" data-dica="admin-gam-avisos">
        <h2 className="font-display text-lg font-bold text-ink">Avisos enviados pelo servidor</h2>
        {[['weeklyReview', 'Resumo da semana (segunda-feira)'], ['duels', 'Duelo da semana'], ['challengeResults', 'Resultado dos desafios']].map(([k, l]) => (
          <V2Toggle key={k} id={`notif-${k}`} checked={draft.notifications[k]} label={l}
            onChange={(v) => setDraft((d) => setIn(d, `notifications.${k}`, v))} />
        ))}
        <p className="text-xs text-gray-400">Cada pessoa ainda pode desligar o que não quer receber, nas preferências dela.</p>
      </V2Surface>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-paper-pure/95 p-4 shadow-lg backdrop-blur">
        <p className="text-sm text-gray-600">{mudancas.length === 0 ? 'Nada alterado.' : `${mudancas.length} ${mudancas.length === 1 ? 'alteração' : 'alterações'} a salvar.`}</p>
        <div className="flex gap-2">
          <V2Button variant="ghost" size="sm" onClick={() => setDraft(normalizeGamificationConfig(DEFAULT_GAMIFICATION_CONFIG))}><RotateCcw className="mr-1 h-4 w-4" /> Padrões de fábrica</V2Button>
          <V2Button size="sm" disabled={saving || mudancas.length === 0} onClick={salvar} data-dica="admin-gam-salvar"><Save className="mr-1 h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar'}</V2Button>
        </div>
      </div>
    </div>
  );
}

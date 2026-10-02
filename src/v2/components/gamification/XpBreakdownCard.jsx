import React from 'react';
import { Sparkles } from 'lucide-react';
import { V2Surface } from '@/v2/ui/primitives';
import { useXpGrants } from '@/modules/progression/hooks/useXpGrants';
import { XP_GRANT_KIND_LABEL } from '@/modules/progression/domain/xpGrants';
import { cn } from '@/core/lib/utils';

const PARTES = [
  { key: 'activity', label: 'Jogos e torneios', hint: 'Partidas, vitórias, pódios e títulos.', color: 'bg-amber-400' },
  { key: 'achievements', label: 'Conquistas', hint: 'O bônus de cada conquista desbloqueada.', color: 'bg-purple-400' },
  { key: 'missions', label: 'Missões', hint: 'Missões cumpridas e bônus resgatados.', color: 'bg-green-400' },
  { key: 'onboarding', label: 'Primeiros passos', hint: 'As etapas do roteiro de boas-vindas.', color: 'bg-blue-400' },
  { key: 'grants', label: 'Prêmios', hint: 'Temporada, duelos e desafios — concedidos pela plataforma.', color: 'bg-pink-400' },
];

/**
 * De onde vem o XP. "Ganhei XP e não sei por quê" é pior que não ganhar: cada
 * parcela do total aparece com a explicação, e os prêmios, com o motivo.
 *
 * @param {{ uid: string, xp: { total: number, breakdown: Record<string, number> } }} props
 */
export default function XpBreakdownCard({ uid, xp }) {
  const grants = useXpGrants(uid);
  const total = Math.max(1, xp.total);
  const recentes = [...grants.grants].sort((a, b) => Number(b.createdAt) - Number(a.createdAt)).slice(0, 5);
  return (
    <V2Surface collapsible collapseId="gamification:xp-origem" title={`De onde vem o meu XP · ${xp.total.toLocaleString('pt-BR')}`} defaultCollapsed data-dica="xp-origem">
      <ul className="space-y-3">
        {PARTES.map((p) => {
          const v = xp.breakdown?.[p.key] || 0;
          return (
            <li key={p.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold text-ink">{p.label}</span>
                <span className="tabular-nums text-gray-600">{v.toLocaleString('pt-BR')} XP</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                <div className={cn('h-full rounded-full', p.color)} style={{ width: `${Math.min(100, Math.round((v / total) * 100))}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] text-gray-400">{p.hint}</p>
            </li>
          );
        })}
      </ul>
      {recentes.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Prêmios recentes</p>
          <ul className="space-y-1">
            {recentes.map((g) => (
              <li key={g.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{g.label || XP_GRANT_KIND_LABEL[g.kind]}</span>
                <span className="font-bold tabular-nums text-ink">+{g.xp} XP</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-4 text-gray-400">O total é sempre recalculado do zero a partir de fatos reais — ele nunca é um saldo que alguém soma.</p>
    </V2Surface>
  );
}

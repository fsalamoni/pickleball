/**
 * ENTRADA DIRETA na tela de sorteio — onde os NOMES existem.
 *
 * A configuração mora na fase (`direct_entry`), mas escolher quem entra direto
 * só faz sentido olhando a lista de inscritos. Por isso o painel vive aqui, na
 * aba de sorteio, e não no editor de formato: lá o torneio pode nem ter
 * inscrição ainda.
 *
 * Mostra, acima de tudo, o RESULTADO da configuração — "4 entram direto na
 * fase 2: Ana, Bruno, Carla e Davi; 12 começam na 1ª fase" — porque é isso que
 * quem organiza precisa conferir antes de clicar em sortear.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, SkipForward, AlertTriangle, Check } from 'lucide-react';

import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizePhases } from '@/modules/tournament/domain/phases';
import {
  DIRECT_ENTRY_MODE, DIRECT_ENTRY_MODE_LABELS, DIRECT_ENTRY_MODE_HELP,
  planDirectEntries, describeDirectEntries, normalizeDirectEntry,
} from '@/modules/tournament/domain/directEntry';
import { registrationToEntrant } from '@/modules/tournament/domain/registrationEntrant';

export default function DirectEntryPanel({
  modality, registrations = [], isTeam = false, isAdmin = false, onSave, saving = false,
}) {
  const [aberto, setAberto] = useState(false);
  const fases = useMemo(() => normalizePhases(modality?.stages), [modality?.stages]);
  const entrants = useMemo(
    () => registrations.map((r) => registrationToEntrant(r, { isTeam })),
    [registrations, isTeam],
  );
  const plano = useMemo(() => planDirectEntries(entrants, fases), [entrants, fases]);
  const resumo = useMemo(() => describeDirectEntries(plano, fases), [plano, fases]);

  // Só existe com mais de uma fase: pular fase exige fase para pular.
  if (fases.length < 2) return null;

  const configuradas = fases
    .map((f, i) => ({ fase: f, i }))
    .filter(({ i, fase }) => i > 0 && normalizeDirectEntry(fase.direct_entry).mode !== DIRECT_ENTRY_MODE.NONE);

  const patch = (i, direct) => {
    const stages = (modality.stages || []).map((s, j) => (j === i ? { ...s, direct_entry: direct } : s));
    onSave?.(stages);
  };

  const alternarManual = (i, id) => {
    const atual = normalizeDirectEntry(fases[i].direct_entry);
    const ids = atual.ids.includes(id)
      ? atual.ids.filter((x) => x !== id)
      : [...atual.ids, id];
    patch(i, { ...atual, mode: DIRECT_ENTRY_MODE.MANUAL, ids });
  };

  return (
    <V2Surface className="mb-3 rounded-2xl border border-gray-100 p-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <SkipForward className="h-4 w-4 text-gray-400" />
          Entrada direta — quem pula fases
        </span>
        <span className="flex items-center gap-2">
          {configuradas.length === 0
            ? <span className="text-[11px] text-gray-500">todos começam na 1ª fase</span>
            : <V2Badge tone="acid">{configuradas.length} fase(s) com entrada direta</V2Badge>}
          {plano.warnings.some((w) => w.level === 'error') && (
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-rose-500" />
          )}
        </span>
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-gray-100 p-3">
          {/* O RESULTADO primeiro: é o que se confere antes de sortear. */}
          <div className="rounded-xl bg-paper p-3 text-xs text-ink">
            <p className="mb-1 font-semibold">Como o torneio vai começar</p>
            <ul className="space-y-0.5">
              {resumo.map((r) => (
                <li key={r.phase}>
                  · {r.text}
                  {r.phase > 0 && (
                    <span className="text-gray-500">
                      {' '}({(plano.byPhase.get(r.phase) || []).map((e) => e.label).join(', ')})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {plano.warnings.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
              {plano.warnings.map((w, i) => (
                <li key={i} className={w.level === 'error' ? 'font-semibold text-rose-800' : ''}>
                  {w.text}
                </li>
              ))}
            </ul>
          )}

          {!isAdmin ? (
            <p className="text-[11px] italic text-gray-500">
              Só quem administra o torneio pode mudar isto.
            </p>
          ) : (
            fases.slice(1).map((fase, idx) => {
              const i = idx + 1;
              const direct = normalizeDirectEntry(fase.direct_entry);
              return (
                <div key={i} className="space-y-2 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs font-semibold text-ink">
                    Fase {i + 1}{fase.name ? ` — ${fase.name}` : ''}
                  </div>
                  <select
                    className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                    value={direct.mode}
                    disabled={saving}
                    onChange={(e) => patch(i, { ...direct, mode: e.target.value })}
                  >
                    {Object.entries(DIRECT_ENTRY_MODE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <p className="text-[11px] leading-snug text-gray-500">
                    {DIRECT_ENTRY_MODE_HELP[direct.mode]}
                  </p>

                  {direct.mode === DIRECT_ENTRY_MODE.SEEDS && (
                    <div className="max-w-[220px]">
                      <Label className="text-xs">Quantos entram direto</Label>
                      <Input
                        type="number"
                        min={0}
                        max={Math.max(0, entrants.length - 2)}
                        className="h-9"
                        value={direct.count}
                        disabled={saving}
                        onChange={(e) => patch(i, { ...direct, count: e.target.value })}
                      />
                    </div>
                  )}

                  {direct.mode === DIRECT_ENTRY_MODE.MANUAL && (
                    <div className="space-y-1">
                      <Label className="text-xs">Quem entra direto nesta fase</Label>
                      <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-gray-100 bg-paper p-2">
                        {entrants.length === 0 && (
                          <span className="text-[11px] text-gray-500">Ainda não há inscrições confirmadas.</span>
                        )}
                        {entrants.map((e) => {
                          const escolhido = direct.ids.includes(e.id);
                          const emOutraFase = plano.phaseOfEntrant.get(e.id) > 0
                            && plano.phaseOfEntrant.get(e.id) !== i;
                          return (
                            <button
                              key={e.id}
                              type="button"
                              disabled={saving}
                              onClick={() => alternarManual(i, e.id)}
                              title={emOutraFase ? 'Já entra direto em outra fase' : ''}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors ${
                                escolhido
                                  ? 'border-acid bg-acid/20 font-semibold text-ink'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              } ${emOutraFase ? 'opacity-50' : ''}`}
                            >
                              {escolhido && <Check aria-hidden="true" className="h-3 w-3" />}
                              {e.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <p className="text-[11px] italic text-gray-500">
            Quem entra direto numa fase <strong>não joga</strong> as anteriores — não entra no
            sorteio delas nem na classificação delas. Mudanças aqui valem no próximo sorteio
            daquela fase.
          </p>

          {typeof onSave === 'function' && isAdmin && (
            <V2Button size="sm" variant="ghost" disabled={saving} onClick={() => toast.success('Alterações salvas.')}>
              Pronto
            </V2Button>
          )}
        </div>
      )}
    </V2Surface>
  );
}

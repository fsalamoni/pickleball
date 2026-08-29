/**
 * Editor da configuração de EQUIPES de uma modalidade (flag team_tournaments).
 * Usado na criação/edição de modalidade (admin). Autocontido: recebe `value`
 * (config editável) e `onChange`. A validação final é feita por
 * `normalizeTeamConfig` no domínio, no momento de salvar.
 */

import React from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { V2Badge, V2Button } from '@/v2/ui/primitives';
import {
  TEAM_GENDER, TEAM_GENDER_LABELS,
  TEAM_ETAPA_TYPE, TEAM_ETAPA_TYPE_LABELS,
  TEAM_WIN_RULE, TEAM_WIN_RULE_LABELS,
  TEAM_SINGLES_MODE, TEAM_SINGLES_MODE_LABELS,
  TEAM_LIMITS, TEAM_SETS_OPTIONS, TEAM_SETS_LABELS, TEAM_TARGET_SCORE_OPTIONS,
  normalizeTeamConfig, resolveEtapaScoring, formatEtapaScoringLabel,
} from '@/modules/tournament/domain/teamFormat';

/** Config inicial sugerida (exemplo clássico: 4 atletas, misto, 5 etapas, melhor de 3). */
export function defaultTeamConfig() {
  return {
    team_size: 4,
    gender: TEAM_GENDER.MIXED,
    win_rule: TEAM_WIN_RULE.BEST_OF,
    win_target: 3,
    singles_mode: TEAM_SINGLES_MODE.SINGLE,
    singles_rotation_points: 5,
    // Placar padrão de cada etapa (cada etapa pode sobrescrever).
    sets_per_etapa: 1,
    target_score: 11,
    etapas: [
      { type: TEAM_ETAPA_TYPE.MENS_DOUBLES },
      { type: TEAM_ETAPA_TYPE.WOMENS_DOUBLES },
      { type: TEAM_ETAPA_TYPE.MIXED_DOUBLES },
      { type: TEAM_ETAPA_TYPE.MIXED_DOUBLES },
      { type: TEAM_ETAPA_TYPE.SINGLES },
    ],
  };
}

const inputCls = 'w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30';
const labelCls = 'text-[11px] font-bold uppercase tracking-widest text-gray-400';
const smallSelectCls = 'w-full rounded-xl border border-gray-200 bg-paper px-2 py-1.5 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-acid/30';

export default function TeamModalityConfig({ value, onChange }) {
  const cfg = value || defaultTeamConfig();
  const set = (patch) => onChange({ ...cfg, ...patch });
  const etapas = Array.isArray(cfg.etapas) ? cfg.etapas : [];
  const hasSingles = etapas.some((e) => e.type === TEAM_ETAPA_TYPE.SINGLES);

  // Prévia normalizada para mostrar avisos/derivações ao admin.
  const preview = normalizeTeamConfig(cfg);
  const errorList = Object.values(preview.errors || {});

  function setEtapa(i, patch) {
    const next = etapas.slice();
    next[i] = { ...next[i], ...patch };
    set({ etapas: next });
  }
  function addEtapa() {
    if (etapas.length >= TEAM_LIMITS.MAX_ETAPAS) return;
    set({ etapas: [...etapas, { type: TEAM_ETAPA_TYPE.MENS_DOUBLES }] });
  }
  function removeEtapa(i) {
    set({ etapas: etapas.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-5 rounded-3xl border border-acid/30 bg-acid/5 p-5">
      <div className="flex items-center gap-2 font-bold text-ink">
        <Users className="h-4 w-4" /> Configuração de equipes
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className={labelCls}>Atletas por equipe</label>
          <input
            type="number"
            min={TEAM_LIMITS.MIN_TEAM_SIZE}
            max={TEAM_LIMITS.MAX_TEAM_SIZE}
            value={cfg.team_size}
            onChange={(e) => set({ team_size: Number(e.target.value) })}
            className={inputCls}
          />
          <p className="text-xs text-gray-500">
            Elenco de cada equipe. Se maior que o mínimo, o admin define quem joga cada etapa no confronto.
          </p>
        </div>
        <div className="space-y-2">
          <label className={labelCls}>Composição</label>
          <select value={cfg.gender} onChange={(e) => set({ gender: e.target.value })} className={inputCls}>
            {Object.entries(TEAM_GENDER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {cfg.gender === TEAM_GENDER.MIXED && (
            <p className="text-xs text-gray-500">
              Mista: {preview.value.male_slots} masculino(s) + {preview.value.female_slots} feminino(s).
            </p>
          )}
        </div>
      </div>

      {/* Etapas do confronto */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className={labelCls}>Etapas do confronto (ordem)</label>
          <V2Button size="sm" variant="ghost" onClick={addEtapa} disabled={etapas.length >= TEAM_LIMITS.MAX_ETAPAS}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar etapa
          </V2Button>
        </div>
        <div className="space-y-2">
          {etapas.map((e, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-paper-pure p-3">
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-xs font-bold text-gray-400">{i + 1}</span>
                <select
                  value={e.type}
                  onChange={(ev) => setEtapa(i, { type: ev.target.value })}
                  aria-label={`Tipo da etapa ${i + 1}`}
                  className={inputCls}
                >
                  {Object.entries(TEAM_ETAPA_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <V2Button size="sm" variant="ghost" onClick={() => removeEtapa(i)} aria-label="Remover etapa">
                  <Trash2 className="h-3.5 w-3.5" />
                </V2Button>
              </div>
              {/* Placar desta etapa: herda o padrão da modalidade ou sobrescreve. */}
              <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-14 shrink-0">Games</span>
                  <select
                    value={e.sets_per_match ?? ''}
                    onChange={(ev) => setEtapa(i, { sets_per_match: ev.target.value === '' ? null : Number(ev.target.value) })}
                    aria-label={`Games da etapa ${i + 1}`}
                    className={smallSelectCls}
                  >
                    <option value="">Padrão da modalidade</option>
                    {TEAM_SETS_OPTIONS.map((n) => <option key={n} value={n}>{TEAM_SETS_LABELS[n]}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-14 shrink-0">Pontos</span>
                  <select
                    value={e.target_score ?? ''}
                    onChange={(ev) => setEtapa(i, { target_score: ev.target.value === '' ? null : Number(ev.target.value) })}
                    aria-label={`Pontos por game da etapa ${i + 1}`}
                    className={smallSelectCls}
                  >
                    <option value="">Padrão da modalidade</option>
                    {TEAM_TARGET_SCORE_OPTIONS.map((n) => <option key={n} value={n}>{n} pontos</option>)}
                  </select>
                </label>
              </div>
              <p className="mt-1 pl-8 text-[11px] text-gray-400">
                Vale: {formatEtapaScoringLabel(resolveEtapaScoring(preview.value, { ...e, id: preview.value.etapas[i]?.id }))}
              </p>
            </div>
          ))}
          {etapas.length === 0 && <p className="text-xs text-red-500">Adicione ao menos uma etapa.</p>}
        </div>
      </div>

      {/* Placar padrão das etapas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className={labelCls}>Placar padrão de cada etapa</label>
          <select
            value={cfg.sets_per_etapa ?? 1}
            onChange={(e) => set({ sets_per_etapa: Number(e.target.value) })}
            className={inputCls}
          >
            {TEAM_SETS_OPTIONS.map((n) => <option key={n} value={n}>{TEAM_SETS_LABELS[n]}</option>)}
          </select>
          <p className="text-xs text-gray-500">
            Cada etapa é um jogo: pode ser decidida num game só ou em melhor de 3/5.
          </p>
        </div>
        <div className="space-y-2">
          <label className={labelCls}>Pontos por game</label>
          <select
            value={cfg.target_score ?? 11}
            onChange={(e) => set({ target_score: Number(e.target.value) })}
            className={inputCls}
          >
            {TEAM_TARGET_SCORE_OPTIONS.map((n) => <option key={n} value={n}>{n} pontos</option>)}
          </select>
        </div>
      </div>

      {/* Regra de vitória */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className={labelCls}>Como o confronto é decidido</label>
          <select value={cfg.win_rule} onChange={(e) => set({ win_rule: e.target.value })} className={inputCls}>
            {Object.entries(TEAM_WIN_RULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {cfg.win_rule === TEAM_WIN_RULE.BEST_OF && (
          <div className="space-y-2">
            <label className={labelCls}>Etapas para vencer (melhor de)</label>
            <input
              type="number"
              min={1}
              max={Math.max(1, etapas.length)}
              value={cfg.win_target}
              onChange={(e) => set({ win_target: Number(e.target.value) })}
              className={inputCls}
            />
            <p className="text-xs text-gray-500">
              Ex.: {preview.value.win_target} de {etapas.length} — primeira equipe a atingir vence.
            </p>
          </div>
        )}
      </div>

      {/* Simples */}
      {hasSingles && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={labelCls}>Simples</label>
            <select value={cfg.singles_mode} onChange={(e) => set({ singles_mode: e.target.value })} className={inputCls}>
              {Object.entries(TEAM_SINGLES_MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {cfg.singles_mode === TEAM_SINGLES_MODE.ROTATING && (
            <div className="space-y-2">
              <label className={labelCls}>Trocar a cada X pontos</label>
              <input
                type="number"
                min={TEAM_LIMITS.MIN_ROTATION_POINTS}
                max={TEAM_LIMITS.MAX_ROTATION_POINTS}
                value={cfg.singles_rotation_points}
                onChange={(e) => set({ singles_rotation_points: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          )}
        </div>
      )}

      {errorList.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
          {errorList.map((msg) => <div key={msg}>• {msg}</div>)}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <V2Badge tone="neutral">{TEAM_GENDER_LABELS[cfg.gender]}</V2Badge>
        <V2Badge tone="neutral">{cfg.team_size} atletas/equipe</V2Badge>
        <V2Badge tone="neutral">{etapas.length} etapa(s)</V2Badge>
        <V2Badge tone="neutral">
          {cfg.win_rule === TEAM_WIN_RULE.BEST_OF ? `Melhor de: ${preview.value.win_target}` : 'Todas as etapas'}
        </V2Badge>
        <V2Badge tone="neutral">
          {formatEtapaScoringLabel({
            sets_per_match: preview.value.sets_per_etapa,
            target_score: preview.value.target_score,
          })}
        </V2Badge>
      </div>
    </div>
  );
}

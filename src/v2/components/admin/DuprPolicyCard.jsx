import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  DUPR_AUDIENCE, DUPR_BUCKET, DUPR_CONFIGURABLE_BUCKETS, DUPR_LEVEL, DUPR_MODE, GRACE_MAX, normalizeDuprPolicy,
} from '@/modules/rating/domain/duprPolicy';
import { useDuprPolicy, useSaveDuprPolicy } from '@/modules/rating/hooks/useDuprMode';
import { V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Toggle } from '@/v2/ui/primitives';
import { t, tk } from '@/core/i18n';

const BUCKET_LABEL = {
  [DUPR_BUCKET.TOURNAMENT_FIXED]: tk('Torneio — simples e duplas (grupos, chave, pontos corridos, suíço)'),
  [DUPR_BUCKET.TOURNAMENT_TEAM]: tk('Torneio — equipes'),
  [DUPR_BUCKET.TOURNAMENT_ROTATION]: tk('Torneio — Americano e Mexicano (por modalidade)'),
  [DUPR_BUCKET.GAME_DAY_ROTATION]: tk('Dia de jogo e jogo aberto com placar (Americano, Americano aprimorado, Mexicano, Rei da Quadra)'),
};
const LEVEL_OPTIONS = [
  { value: DUPR_LEVEL.REQUIRED, get label() { return t('Sempre envia'); } },
  { value: DUPR_LEVEL.OPTIONAL, get label() { return t('Quem cria escolhe'); } },
  { value: DUPR_LEVEL.EXCLUDED, get label() { return t('Nunca envia'); } },
];
const MODE_OPTIONS = [
  { value: DUPR_MODE.OFF, get label() { return t('Desligado — nada é enviado'); } },
  { value: DUPR_MODE.MANUAL, get label() { return t('Com aprovação do admin, partida a partida'); } },
  { value: DUPR_MODE.RULES, get label() { return t('Automático, pelas regras abaixo'); } },
];

/**
 * Política do DUPR no painel admin (Funcionalidades → DUPR): o público (piloto
 * só com admins ou todo mundo) e as regras de envio de partidas. Grava
 * `platform_settings/dupr_policy`; o servidor aplica a mesma régua.
 */
export default function DuprPolicyCard() {
  const { data, isLoading, isError, refetch } = useDuprPolicy();
  const save = useSaveDuprPolicy();
  const [p, setP] = useState(null);
  useEffect(() => { if (data) setP(data); }, [data]);

  if (isLoading || (!p && !isError)) return <V2Skeleton className="mt-4 h-40 rounded-3xl" />;
  if (isError) {
    // Sem a política na mão, não se oferece salvar: gravaria o padrão por cima.
    return <V2ErrorState inline className="mt-4" title={t('A política do DUPR não carregou')} description="" onRetry={() => refetch()} />;
  }

  const set = (patch) => setP((cur) => normalizeDuprPolicy({ ...cur, ...patch }));
  const setRule = (bucket, level) => setP((cur) => normalizeDuprPolicy({ ...cur, rules: { ...cur.rules, [bucket]: level } }));
  const mudou = JSON.stringify(p) !== JSON.stringify(data);

  async function salvar() {
    try {
      await save.mutateAsync(p);
      toast.success(t('Política do DUPR salva.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível salvar a política do DUPR.'));
    }
  }

  return (
    <div className="mt-4 space-y-5 rounded-3xl border border-gray-100 bg-paper-pure p-4" data-dica="admin-dupr-politica">
      <div>
        <h3 className="font-display text-base font-bold text-ink">{t('Política do DUPR')}</h3>
        <p className="mt-1 text-xs text-gray-500">
          {t('Enquanto a integração oficial vale para a pessoa, o rating próprio da plataforma (ranking Nacional, Nível 2.0–8.0, evolução e metas de rating) fica suspenso para ela e o ranking passa a ser o do DUPR. O servidor continua calculando o próprio em silêncio: desligando, tudo volta como estava.')}
        </p>
      </div>

      <V2Toggle
        id="dupr-publico"
        checked={p.audience === DUPR_AUDIENCE.ALL}
        onChange={(v) => set({ audience: v ? DUPR_AUDIENCE.ALL : DUPR_AUDIENCE.ADMINS })}
        label={t('Liberar para todo mundo')}
        hint={p.audience === DUPR_AUDIENCE.ALL
          ? t('Todas as pessoas veem o DUPR oficial e podem conectar a conta.')
          : t('Piloto: só os admins da plataforma veem o DUPR oficial (a tela e o servidor conferem). Para os demais, tudo segue como antes.')}
      />

      <V2Field label={t('Envio de partidas ao DUPR')} htmlFor="dupr-modo" hint={t('O envio automático ainda está sendo construído: por enquanto nada é enviado, seja qual for a escolha. As regras ficam salvas para quando ele chegar.')}>
        <V2Select id="dupr-modo" value={p.mode} onChange={(e) => set({ mode: e.target.value })} options={MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
      </V2Field>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">{t('O que vai para o DUPR')}</p>
        {DUPR_CONFIGURABLE_BUCKETS.map((b) => (
          <V2Field key={b} label={t(BUCKET_LABEL[b])} htmlFor={`dupr-regra-${b}`}>
            <V2Select id={`dupr-regra-${b}`} value={p.rules[b]} onChange={(e) => setRule(b, e.target.value)} options={LEVEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
          </V2Field>
        ))}
        <p className="text-xs text-gray-500">{t('O Play nunca vai ao DUPR: não tem placar. Partida com alguém sem conta DUPR conectada, com empate num game ou sem placar (W.O.) também não vai.')}</p>
        <V2Toggle
          id="dupr-padrao-opcional"
          checked={p.optional_default_on}
          onChange={(v) => set({ optional_default_on: v })}
          label={t('Quando quem cria não escolher, enviar')}
          hint={t('Vale para o que está em "Quem cria escolhe". Desligado, só vai o que a pessoa marcar.')}
        />
        <V2Field label={t('Prazo para corrigir o placar antes do envio (minutos)')} htmlFor="dupr-carencia">
          <V2Input id="dupr-carencia" type="number" min={0} max={GRACE_MAX} value={p.grace_minutes} onChange={(e) => set({ grace_minutes: e.target.value })} />
        </V2Field>
      </div>

      <div className="flex justify-end">
        <V2Button type="button" onClick={salvar} disabled={!mudou || save.isPending}>{t('Salvar política')}</V2Button>
      </div>
    </div>
  );
}

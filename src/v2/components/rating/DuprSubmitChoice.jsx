/**
 * "Enviar os resultados ao DUPR" — a escolha de quem CRIA o dia de jogo ou a
 * modalidade, nos grupos em que a política deixa a decisão com ele
 * (Funcionalidades → DUPR). Quem lê a escolha é o envio automático
 * (`functions/duprSubmissions.js`: `game_days.dupr_submit` e
 * `tournament_modalities.dupr_submit`); `null` = não escolheu, vale o padrão.
 *
 * Some quando o DUPR não vale para quem está vendo (flag/piloto), quando a
 * política não carregou ou o envio está desligado: sem saber a regra, a tela
 * não afirma se a partida vai ou não.
 */
import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { useDuprMode, useDuprPolicy } from '@/modules/rating/hooks/useDuprMode';
import {
  DUPR_LEVEL, DUPR_MODE, duprSubmissionDecision, normalizeDuprPolicy,
} from '@/modules/rating/domain/duprPolicy';
import { t } from '@/core/i18n';

/**
 * @param {{ bucket: string, value: boolean|null|undefined, onChange: (v: boolean) => void, disabled?: boolean, id: string, className?: string }} props
 */
export default function DuprSubmitChoice({ bucket, value, onChange, disabled = false, id, className = '' }) {
  const { official } = useDuprMode();
  const { data, isSuccess } = useDuprPolicy({ enabled: official });
  if (!official || !isSuccess) return null;
  const policy = normalizeDuprPolicy(data);
  if (policy.mode === DUPR_MODE.OFF) return null;
  const escolha = typeof value === 'boolean' ? value : null;
  const d = duprSubmissionDecision({ bucket, creatorChoice: escolha }, policy);

  if (d.level === DUPR_LEVEL.OPTIONAL) {
    return (
      <div className={`flex items-start gap-3 ${className}`} data-dica="dupr-enviar-resultados">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-ink"
          checked={d.submit}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor={id} className="space-y-0.5 text-sm">
          <span className="block font-semibold text-ink">{t('Enviar os resultados ao DUPR')}</span>
          <span className="block text-xs text-gray-500">
            {escolha === null
              ? t('Ainda sem escolha: vale o padrão da plataforma. Só vão as partidas em que todos os jogadores conectaram o DUPR.')
              : t('Só vão as partidas em que todos os jogadores conectaram o DUPR.')}
          </span>
        </label>
      </div>
    );
  }
  return (
    <p className={`flex items-start gap-2 text-xs text-gray-500 ${className}`}>
      <BadgeCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {d.submit
        ? t('Os resultados vão ao DUPR (regra da plataforma), quando todos os jogadores tiverem o DUPR conectado.')
        : t('Este tipo de partida não vai ao DUPR (regra da plataforma).')}
    </p>
  );
}

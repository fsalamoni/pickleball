import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { V2Input, V2Button } from '@/v2/ui/primitives';
import {
  readDuprRating, formatDuprRating, duprIdProblem, DUPR_RATING_MIN, DUPR_RATING_MAX,
} from '@/core/domain/duprRating';
import { t } from '@/core/i18n';

/**
 * Os campos do DUPR digitados à mão — o MESMO desenho no cadastro, no perfil e
 * no painel do admin. A regra de leitura é `readDuprRating` (core/domain).
 *
 * O campo do rating explica o formato o tempo todo e, ao sair dele (ou ao
 * tentar salvar), diz o que está errado — e, quando dá para adivinhar, pergunta
 * "Você quis dizer 4,525?" com um toque para aceitar. Nada fora de 2,000–8,000
 * é gravado: quem chama confere a mesma leitura antes de salvar.
 */

const fmt = formatDuprRating;
const faixa = () => ({ min: fmt(DUPR_RATING_MIN), max: fmt(DUPR_RATING_MAX), exemplo: fmt(3.525) });

/** O formato, dito à pessoa antes de ela errar. */
export function duprRatingHint() {
  return t('Número de {min} a {max}, com três casas depois da vírgula, como aparece no app do DUPR (ex.: {exemplo}). Não é o ID.', faixa());
}

/** O que está errado com o que foi digitado (null quando está certo ou vazio). */
export function duprRatingMessage(leitura) {
  const v = faixa();
  if (leitura.status === 'suggest') {
    return leitura.reason === 'decimals'
      ? t('O DUPR usa três casas depois da vírgula. Você quis dizer {valor}?', { valor: fmt(leitura.suggestion) })
      : t('O rating DUPR vai de {min} a {max}, com a vírgula depois do primeiro número. Você quis dizer {valor}?', { ...v, valor: fmt(leitura.suggestion) });
  }
  if (leitura.status !== 'invalid') return null;
  switch (leitura.reason) {
    case 'looksLikeId':
    case 'letters':
      return t('Isso parece o ID DUPR, não o rating. O rating é um número de {min} a {max} (ex.: {exemplo}); o ID vai no campo do ID.', v);
    case 'below':
      return t('O rating DUPR começa em {min}. Confira no app do DUPR e escreva como aparece lá (ex.: {exemplo}).', v);
    default:
      return t('O rating DUPR vai de {min} a {max}, com três casas depois da vírgula (ex.: {exemplo}).', v);
  }
}

/** O rating digitado pode ser salvo? (vazio pode: o campo é opcional) */
export function duprRatingBlocksSave(raw) {
  const s = readDuprRating(raw).status;
  return s === 'suggest' || s === 'invalid';
}

/**
 * @param {{ id: string, value: string, onChange: (v: string) => void,
 *   showFeedback?: boolean, hint?: boolean, className?: string }} props
 *   `showFeedback` força o aviso (a pessoa tentou salvar, ou o valor gravado já
 *   está fora da regra); sem ele o aviso aparece ao sair do campo.
 */
export function DuprRatingInput({ id, value, onChange, showFeedback = false, hint = true, className }) {
  const [saiu, setSaiu] = useState(false);
  const leitura = readDuprRating(value);
  const mensagem = (saiu || showFeedback) ? duprRatingMessage(leitura) : null;
  const idMsg = `${id}-ajuda`;

  return (
    <div className={className}>
      <V2Input
        id={id}
        value={value}
        inputMode="decimal"
        autoComplete="off"
        maxLength={12}
        placeholder={t('Ex.: {exemplo}', faixa())}
        aria-invalid={mensagem ? true : undefined}
        aria-describedby={mensagem || hint ? idMsg : undefined}
        className={mensagem ? 'border-amber-400 focus:border-amber-500' : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          setSaiu(true);
          // Certo, mas escrito de outro jeito ("4", "4.5"): mostra como fica gravado.
          if (leitura.status === 'ok') onChange(fmt(leitura.value));
        }}
      />
      <div id={idMsg} aria-live="polite">
        {mensagem ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <p className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{mensagem}</span>
            </p>
            {leitura.status === 'suggest' && (
              <div className="mt-2 flex flex-wrap gap-2">
                <V2Button type="button" size="sm" onClick={() => onChange(fmt(leitura.suggestion))}>
                  {t('Sim, usar {valor}', { valor: fmt(leitura.suggestion) })}
                </V2Button>
                <V2Button type="button" size="sm" variant="ghost" onClick={() => document.getElementById(id)?.focus()}>
                  {t('Não, vou corrigir')}
                </V2Button>
              </div>
            )}
          </div>
        ) : hint && (
          <p className="mt-2 text-xs leading-5 text-gray-500">{duprRatingHint()}</p>
        )}
      </div>
    </div>
  );
}

/** O ID DUPR, com o aviso de quando o que foi digitado parece outra coisa. */
export function DuprIdInput({ id, value, onChange, className }) {
  const problema = duprIdProblem(value);
  const idMsg = `${id}-ajuda`;
  return (
    <div className={className}>
      <V2Input
        id={id}
        value={value}
        maxLength={20}
        autoComplete="off"
        placeholder={t('Ex.: 5931502152 ou DDQ0KL')}
        aria-describedby={problema ? idMsg : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {problema && (
        <p id={idMsg} className="mt-2 text-xs leading-5 text-amber-800">
          {problema === 'looksLikeRating'
            ? t('Isso parece o seu rating, não o ID. O ID DUPR é o código da sua conta (ex.: 5931502152 ou DDQ0KL); o rating vai no campo dele.')
            : t('O ID DUPR tem só letras e números, sem espaços nem pontos (ex.: 5931502152 ou DDQ0KL).')}
        </p>
      )}
    </div>
  );
}

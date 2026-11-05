/**
 * A RECEPÇÃO de vales: o cliente mostra o código, a equipe confere e registra.
 *
 * É o outro lado do vale. Sem isto, "1 água de coco" seria um código que
 * ninguém conta — a arena entregaria a bebida e o controle de uso diria zero.
 *
 * Três decisões:
 *  - **Confere antes de registrar.** Digitar o código mostra O QUE o vale dá e
 *    se ainda vale (venceu, esgotou, desligado) — a equipe precisa saber se
 *    entrega antes de entregar.
 *  - **Quem usou é opcional.** Vale divulgado na página serve também a quem
 *    não tem cadastro; aí "uma vez por pessoa" não tem como ser conferido, e a
 *    tela diz isso em vez de fingir que confere.
 *  - **O registro é numa transação** (no serviço): duas pessoas da equipe
 *    registrando o último uso ao mesmo tempo não passam do limite.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, ScanLine } from 'lucide-react';
import PersonPicker from '@/v2/components/people/PersonPicker';
import { useFindArenaCoupon, useRedeemVoucher } from '@/modules/arenas/hooks/useArenaV3';
import {
  COUPON_FAMILY, couponBenefitText, couponError, couponFamily, couponKind,
} from '@/modules/arenas/domain/marketing';
import { V2Button, V2Input } from '@/v2/ui/primitives';
import { COUPON_KIND_ICON } from './couponKindUi';
import { t } from '@/core/i18n';

const nomeDe = (a) => a?.platform_name || a?.full_name || t('Atleta');

/** Um atleta do diretório — o seletor padrão da plataforma (`PersonPicker`). Escolher é opcional. */
export function AthletePicker({ value, onChange, inputId, placeholder }) {
  return (
    <PersonPicker
      id={inputId}
      placeholder={placeholder}
      selecionados={value ? [value] : []}
      onChange={(lista) => onChange(lista[0] || null)}
    />
  );
}

/**
 * @param {{ arenaId: string, cupom?: object|null, onDone?: () => void }} props
 * `cupom` já escolhido (botão "Registrar uso" do cartão) pula a busca pelo código.
 */
export default function VoucherReception({ arenaId, cupom: cupomDado = null, onDone }) {
  const buscar = useFindArenaCoupon();
  const registrar = useRedeemVoucher();
  const [codigo, setCodigo] = useState('');
  const [achado, setAchado] = useState(cupomDado);
  const [erroDaBusca, setError] = useState('');
  const [quem, setQuem] = useState(null);

  const conferir = async (e) => {
    e?.preventDefault?.();
    setError('');
    setAchado(null);
    try {
      const c = await buscar.mutateAsync({ arenaId, code: codigo });
      if (!c) setError(t('Nenhum cupom com este código nesta arena.'));
      else setAchado(c);
    } catch {
      setError(t('Não foi possível conferir agora. Tente de novo.'));
    }
  };

  const familia = achado ? couponFamily(achado) : null;
  const problema = achado
    ? (familia !== COUPON_FAMILY.VOUCHER
      ? (familia === COUPON_FAMILY.BOOKING
        ? t('Este cupom é desconto na reserva: entra sozinho no preço quando a pessoa digita o código ao reservar.')
        : t('Este é o programa de indicação: registre a indicação na aba Indicações.'))
      : couponError(achado, {
        anyFamily: true,
        usedByUser: Boolean(quem?.id) && (achado.used_by || []).includes(quem.id),
        byOther: true,
      }))
    : null;

  const confirmar = async () => {
    try {
      await registrar.mutateAsync({ arenaId, couponId: achado.id, userId: quem?.id || null, userName: quem ? nomeDe(quem) : '' });
      toast.success(t('Uso registrado: {beneficio}.', { beneficio: t(couponBenefitText(achado)) }));
      // Pela busca, limpa para o próximo cliente; pelo cartão, quem fecha é `onDone`.
      if (!cupomDado) { setCodigo(''); setAchado(null); }
      setQuem(null);
      onDone?.();
    } catch (err) {
      toast.error(err?.message || t('Não foi possível registrar o uso.'));
    }
  };

  const Icone = achado ? COUPON_KIND_ICON[couponKind(achado)] : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-2 flex items-center gap-2">
        <ScanLine className="h-4 w-4 text-ink" />
        <h3 className="font-display text-base font-bold text-ink">{t('Registrar uso de um vale')}</h3>
      </div>

      {!cupomDado && (
        <form onSubmit={conferir} className="flex flex-wrap gap-2">
          <label htmlFor="vale-codigo" className="sr-only">{t('Código do vale')}</label>
          <V2Input id="vale-codigo" className="min-w-0 flex-1" maxLength={30} placeholder={t('Código que o cliente mostrou')}
            value={codigo} onChange={(e) => { setCodigo(e.target.value.toUpperCase().replace(/\s+/g, '')); setAchado(null); setError(''); }} />
          <V2Button type="submit" variant="secondary" disabled={!codigo.trim() || buscar.isPending}>
            {buscar.isPending ? t('Conferindo…') : t('Conferir')}
          </V2Button>
        </form>
      )}
      {erroDaBusca && <p className="mt-2 text-xs text-red-700">{erroDaBusca}</p>}

      {achado && (
        <div className="mt-3 space-y-3">
          <div className="flex items-start gap-2.5 rounded-2xl bg-paper-pure p-3">
            {Icone && <Icone className="mt-0.5 h-4 w-4 shrink-0 text-ink" />}
            <div className="min-w-0">
              <p className="font-display text-sm font-bold tracking-wide text-ink">{achado.code}</p>
              <p className="text-sm text-ink">{t(couponBenefitText(achado))}</p>
              <p className="text-xs text-gray-500">
                {achado.max_uses
                  ? t('{n} de {max} usos', { n: Number(achado.used_count) || 0, max: achado.max_uses })
                  : t('{n} usos', { n: Number(achado.used_count) || 0 })}
                {achado.once_per_user !== false ? ` · ${t('uma vez por pessoa')}` : ''}
              </p>
            </div>
          </div>

          {familia === COUPON_FAMILY.VOUCHER && (
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink/60">{t('Quem usou (opcional)')}</p>
              <AthletePicker value={quem} onChange={setQuem} inputId="vale-quem" />
              {!quem && achado.once_per_user !== false && (
                <p className="mt-1 text-xs text-gray-500">
                  {t('Sem escolher a pessoa, "uma vez por pessoa" não tem como ser conferido.')}
                </p>
              )}
            </div>
          )}

          {problema && <p role="alert" className="text-sm font-semibold text-red-700">{t(problema)}</p>}

          <div className="flex justify-end gap-2">
            {onDone && <V2Button type="button" variant="ghost" onClick={onDone}>{t('Fechar')}</V2Button>}
            <V2Button type="button" disabled={Boolean(problema) || registrar.isPending} onClick={confirmar}>
              <Check className="mr-1.5 h-4 w-4" />
              {registrar.isPending ? t('Registrando…') : t('Entreguei — registrar uso')}
            </V2Button>
          </div>
        </div>
      )}
    </div>
  );
}

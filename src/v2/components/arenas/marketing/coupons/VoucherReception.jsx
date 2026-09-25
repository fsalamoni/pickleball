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
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, ScanLine, X } from 'lucide-react';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { useFindArenaCoupon, useRedeemVoucher } from '@/modules/arenas/hooks/useArenaV3';
import {
  COUPON_FAMILY, couponBenefitText, couponError, couponFamily, couponKind,
} from '@/modules/arenas/domain/marketing';
import { V2Avatar, V2Button, V2Input } from '@/v2/ui/primitives';
import { COUPON_KIND_ICON } from './couponKindUi';

const nomeDe = (a) => a?.platform_name || a?.full_name || 'Atleta';

/** Busca de atleta pelo nome, no diretório. Escolher é opcional. */
export function AthletePicker({ value, onChange, inputId, placeholder = 'Buscar atleta pelo nome…' }) {
  const { data: atletas, isError, refetch } = useAthletes();
  const [q, setQ] = useState('');
  const resultados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    if (!termo || !Array.isArray(atletas)) return [];
    return atletas.filter((a) => nomeDe(a).toLowerCase().includes(termo) || String(a.full_name || '').toLowerCase().includes(termo)).slice(0, 6);
  }, [atletas, q]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-paper p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <V2Avatar photoUrl={value.photo_url} name={nomeDe(value)} size="sm" />
          <span className="truncate text-sm font-bold text-ink">{nomeDe(value)}</span>
        </div>
        <button type="button" onClick={() => onChange(null)} aria-label="Trocar atleta"
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <V2Input id={inputId} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      {isError && (
        <p className="mt-1 text-xs text-amber-800">
          Não foi possível carregar a lista de atletas.{' '}
          <button type="button" onClick={() => refetch()} className="font-bold underline">Tentar de novo</button>
        </p>
      )}
      {resultados.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {resultados.map((a) => (
            <button key={a.id} type="button" onClick={() => { onChange(a); setQ(''); }}
              className="flex w-full items-center gap-2 rounded-2xl border border-gray-100 bg-paper p-2.5 text-left hover:border-gray-300">
              <V2Avatar photoUrl={a.photo_url} name={nomeDe(a)} size="sm" />
              <span className="text-sm text-ink">{nomeDe(a)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
  const [erroBusca, setErroBusca] = useState('');
  const [quem, setQuem] = useState(null);

  const conferir = async (e) => {
    e?.preventDefault?.();
    setErroBusca('');
    setAchado(null);
    try {
      const c = await buscar.mutateAsync({ arenaId, code: codigo });
      if (!c) setErroBusca('Nenhum cupom com este código nesta arena.');
      else setAchado(c);
    } catch {
      setErroBusca('Não foi possível conferir agora. Tente de novo.');
    }
  };

  const familia = achado ? couponFamily(achado) : null;
  const problema = achado
    ? (familia !== COUPON_FAMILY.VOUCHER
      ? (familia === COUPON_FAMILY.BOOKING
        ? 'Este cupom é desconto na reserva: entra sozinho no preço quando a pessoa digita o código ao reservar.'
        : 'Este é o programa de indicação: registre a indicação na aba Indicações.')
      : couponError(achado, {
        anyFamily: true,
        usedByUser: Boolean(quem?.id) && (achado.used_by || []).includes(quem.id),
      })?.replace('Você já usou', 'Esta pessoa já usou'))
    : null;

  const confirmar = async () => {
    try {
      await registrar.mutateAsync({ arenaId, couponId: achado.id, userId: quem?.id || null, userName: quem ? nomeDe(quem) : '' });
      toast.success(`Uso registrado: ${couponBenefitText(achado)}.`);
      // Pela busca, limpa para o próximo cliente; pelo cartão, quem fecha é `onDone`.
      if (!cupomDado) { setCodigo(''); setAchado(null); }
      setQuem(null);
      onDone?.();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível registrar o uso.');
    }
  };

  const Icone = achado ? COUPON_KIND_ICON[couponKind(achado)] : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-2 flex items-center gap-2">
        <ScanLine className="h-4 w-4 text-ink" />
        <h3 className="font-display text-base font-bold text-ink">Registrar uso de um vale</h3>
      </div>

      {!cupomDado && (
        <form onSubmit={conferir} className="flex flex-wrap gap-2">
          <label htmlFor="vale-codigo" className="sr-only">Código do vale</label>
          <V2Input id="vale-codigo" className="min-w-0 flex-1" maxLength={30} placeholder="Código que o cliente mostrou"
            value={codigo} onChange={(e) => { setCodigo(e.target.value.toUpperCase().replace(/\s+/g, '')); setAchado(null); setErroBusca(''); }} />
          <V2Button type="submit" variant="secondary" disabled={!codigo.trim() || buscar.isPending}>
            {buscar.isPending ? 'Conferindo…' : 'Conferir'}
          </V2Button>
        </form>
      )}
      {erroBusca && <p className="mt-2 text-xs text-red-700">{erroBusca}</p>}

      {achado && (
        <div className="mt-3 space-y-3">
          <div className="flex items-start gap-2.5 rounded-2xl bg-paper-pure p-3">
            {Icone && <Icone className="mt-0.5 h-4 w-4 shrink-0 text-ink" />}
            <div className="min-w-0">
              <p className="font-display text-sm font-bold tracking-wide text-ink">{achado.code}</p>
              <p className="text-sm text-ink">{couponBenefitText(achado)}</p>
              <p className="text-xs text-gray-500">
                {Number(achado.used_count) || 0}{achado.max_uses ? ` de ${achado.max_uses}` : ''} usos
                {achado.once_per_user !== false ? ' · uma vez por pessoa' : ''}
              </p>
            </div>
          </div>

          {familia === COUPON_FAMILY.VOUCHER && (
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink/60">Quem usou (opcional)</p>
              <AthletePicker value={quem} onChange={setQuem} inputId="vale-quem" />
              {!quem && achado.once_per_user !== false && (
                <p className="mt-1 text-xs text-gray-500">
                  Sem escolher a pessoa, &quot;uma vez por pessoa&quot; não tem como ser conferido.
                </p>
              )}
            </div>
          )}

          {problema && <p role="alert" className="text-sm font-semibold text-red-700">{problema}</p>}

          <div className="flex justify-end gap-2">
            {onDone && <V2Button type="button" variant="ghost" onClick={onDone}>Fechar</V2Button>}
            <V2Button type="button" disabled={Boolean(problema) || registrar.isPending} onClick={confirmar}>
              <Check className="mr-1.5 h-4 w-4" />
              {registrar.isPending ? 'Registrando…' : 'Entreguei — registrar uso'}
            </V2Button>
          </div>
        </div>
      )}
    </div>
  );
}

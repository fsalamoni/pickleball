/**
 * REGISTRAR O USO de um cupom da plataforma ou do professor (Onda CG) — a
 * pessoa mostrou o código e recebeu o benefício.
 *
 * As três decisões da recepção de vales da arena valem aqui: confere ANTES de
 * registrar (o que dá e se ainda vale), quem usou é opcional (e a tela diz que
 * sem a pessoa "uma vez por pessoa" não é conferido) e o registro é numa
 * transação (no serviço). A diferença: aqui qualquer tipo pode ser registrado
 * — o desconto da plataforma não entra num preço automático, e o professor
 * pode dar o desconto fora do pedido de aula.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, ScanLine } from 'lucide-react';
import { couponError, couponKind } from '@/modules/arenas/domain/marketing';
import { PROMO_ISSUER, promoBenefitText } from '@/modules/promo/domain/promo';
import { useFindPromoCoupon, useRedeemPromoCoupon } from '@/modules/promo/hooks/usePromo';
import { V2Button, V2Input } from '@/v2/ui/primitives';
import { AthletePicker } from '@/v2/components/arenas/marketing/coupons/VoucherReception';
import { PROMO_KIND_ICON } from './promoUi';

const nomeDe = (a) => a?.platform_name || a?.full_name || 'Atleta';

/**
 * @param {{ issuer: object, cupom?: object|null, onDone?: Function }} props
 *   `cupom` já escolhido (botão do cartão) pula a busca pelo código.
 */
export default function PromoReception({ issuer, cupom: cupomDado = null, onDone }) {
  const registrar = useRedeemPromoCoupon();
  const buscar = useFindPromoCoupon();
  const [codigo, setCodigo] = useState('');
  const [achado, setAchado] = useState(cupomDado);
  const [naoAchou, setNaoAchou] = useState(false);
  const [quem, setQuem] = useState(null);
  const ehProfessor = issuer.type === PROMO_ISSUER.COACH;

  const conferir = async (e) => {
    e?.preventDefault?.();
    setNaoAchou(false);
    setAchado(null);
    try {
      const c = await buscar.mutateAsync({ issuer, code: codigo });
      if (c) setAchado(c);
      else setNaoAchou(true);
    } catch {
      // A falha fica em `buscar.isError` — e a tela diz que falhou, não que não existe.
    }
  };
  const limparBusca = () => { setAchado(null); setNaoAchou(false); buscar.reset(); };

  const problema = achado
    ? couponError(achado, {
      anyFamily: true,
      usedByUser: Boolean(quem?.id) && (achado.used_by || []).includes(quem.id),
    })?.replace('Você já usou', 'Esta pessoa já usou')
    : null;

  const confirmar = async () => {
    try {
      await registrar.mutateAsync({ issuer, couponId: achado.id, who: { userId: quem?.id || null, userName: quem ? nomeDe(quem) : '' } });
      toast.success(`Uso registrado: ${promoBenefitText(achado)}.`);
      if (!cupomDado) { setCodigo(''); setAchado(null); }
      setQuem(null);
      onDone?.();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível registrar o uso.');
    }
  };

  const Icone = achado ? PROMO_KIND_ICON[couponKind(achado)] : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-2 flex items-center gap-2">
        <ScanLine className="h-4 w-4 text-ink" aria-hidden />
        <h3 className="font-display text-base font-bold text-ink">Registrar uso de um cupom</h3>
      </div>
      {ehProfessor && !cupomDado && (
        <p className="mb-2 text-xs text-gray-500">
          O desconto que o aluno informa ao pedir a aula é contado sozinho quando você confirma a aula. Aqui é para o que você entrega em mãos.
        </p>
      )}

      {!cupomDado && (
        <form onSubmit={conferir} className="flex flex-wrap gap-2">
          <label htmlFor="promo-rec-codigo" className="sr-only">Código do cupom</label>
          <V2Input id="promo-rec-codigo" className="min-w-0 flex-1" maxLength={30} placeholder="Código que a pessoa mostrou"
            value={codigo} onChange={(e) => { setCodigo(e.target.value.toUpperCase().replace(/\s+/g, '')); limparBusca(); }} />
          <V2Button type="submit" variant="secondary" disabled={!codigo.trim() || buscar.isPending}>
            {buscar.isPending ? 'Conferindo…' : 'Conferir'}
          </V2Button>
        </form>
      )}
      {buscar.isError && <p role="alert" className="mt-2 text-xs text-red-700">Não foi possível conferir agora — isso não quer dizer que o código não exista. Tente de novo.</p>}
      {naoAchou && !buscar.isError && (
        <p className="mt-2 text-xs text-red-700">
          {ehProfessor ? 'Nenhum cupom seu com este código.' : 'Nenhum cupom da plataforma com este código.'}
        </p>
      )}

      {achado && (
        <div className="mt-3 space-y-3">
          <div className="flex items-start gap-2.5 rounded-2xl bg-paper-pure p-3">
            {Icone && <Icone className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden />}
            <div className="min-w-0">
              <p className="font-display text-sm font-bold tracking-wide text-ink">{achado.code}</p>
              <p className="text-sm text-ink">{promoBenefitText(achado)}</p>
              <p className="text-xs text-gray-500">
                {Number(achado.used_count) || 0}{achado.max_uses ? ` de ${achado.max_uses}` : ''} usos
                {achado.once_per_user !== false ? ' · uma vez por pessoa' : ''}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink/60">Quem usou (opcional)</p>
            <AthletePicker value={quem} onChange={setQuem} inputId="promo-rec-quem" />
            {!quem && achado.once_per_user !== false && (
              <p className="mt-1 text-xs text-gray-500">Sem escolher a pessoa, &quot;uma vez por pessoa&quot; não tem como ser conferido.</p>
            )}
          </div>

          {problema && <p role="alert" className="text-sm font-semibold text-red-700">{problema}</p>}

          <div className="flex justify-end gap-2">
            {onDone && <V2Button type="button" variant="ghost" onClick={onDone}>Fechar</V2Button>}
            <V2Button type="button" disabled={Boolean(problema) || registrar.isPending} onClick={confirmar}>
              <Check className="mr-1.5 h-4 w-4" aria-hidden />
              {registrar.isPending ? 'Registrando…' : 'Entreguei — registrar uso'}
            </V2Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * O cupom no PEDIDO DE AULA (Onda CG, revisão) — carregado sob demanda pelo
 * diálogo de pedido, e só com `coach_marketing` ligado: quem não tem cupom
 * não baixa o marketing.
 *
 * Três coisas que o campo antigo não fazia:
 *  1. mostra os cupons do professor para TOCAR (como as promoções no pedido
 *     de reserva da arena) — antes o aluno precisava ter o código em mãos;
 *  2. diz o VALOR com o desconto, quando dá para estimar — "10% na aula"
 *     obriga a pessoa a fazer a conta;
 *  3. confere o "só para os meus alunos" e não diz "você já usou" sobre um
 *     cupom que voltou (a aula em que ele foi usado foi desfeita).
 *
 * Confere ANTES de enviar, mas não aplica nada: o cupom vai PENDENTE e é
 * aplicado quando o professor confirma, conferido de novo contra o banco.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { couponKind } from '@/modules/arenas/domain/marketing';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import {
  LESSON_COUPON_KINDS, hasReturnableUse, isVisibleTo, lessonCouponBase, lessonCouponDiscount,
  lessonCouponFromPromo, lessonCouponProblem, livePromoCoupons, promoBenefitText,
} from '@/modules/promo/domain/promo';
import { findCoachCouponByCode } from '@/modules/promo/services/promoService';
import { useCoachPublicPromos, usePromoViewer } from '@/modules/promo/hooks/usePromo';
import { useStudentLessons } from '@/modules/coaches/hooks/useLessons';

const limpar = (v) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');

/**
 * O aluno já gastou este cupom? Não conta o uso que voltou (aula desfeita).
 * @param {object} cupom
 * @param {string|null} uid
 * @param {object[]} minhasAulas
 */
function jaUsou(cupom, uid, minhasAulas) {
  if (!uid || cupom?.once_per_user === false) return false;
  return (cupom?.used_by || []).includes(uid) && !hasReturnableUse(minhasAulas, cupom.id);
}

/**
 * @param {{
 *   coachId: string,
 *   hourlyRate?: number|null,
 *   slot?: { date: string, start: string, end: string }|null,
 *   value: object|null,
 *   onChange: (cupomDoPedido: object|null) => void,
 *   initialCode?: string,
 * }} props
 */
export default function LessonCouponField({ coachId, hourlyRate = null, slot = null, value, onChange, initialCode = '' }) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [codigo, setCodigo] = useState(initialCode);
  const [estado, setEstado] = useState({ carregando: false, erro: '' });
  // O cupom INTEIRO (tipo e valor), para estimar o preço — o do pedido só
  // leva o texto do benefício.
  const [escolhido, setEscolhido] = useState(null);

  const promos = useCoachPublicPromos(coachId);
  const quem = usePromoViewer();
  const { data: minhasAulas = [] } = useStudentLessons(uid);

  // "É aluno deste professor?" só quando SABIDO; desconhecido não recusa (a
  // confirmação confere de novo).
  const ehAluno = quem.falhou || quem.carregando ? null : quem.coachIdsDoAluno.has(coachId);

  const paraTocar = useMemo(() => livePromoCoupons(promos.data?.coupons || [])
    .filter((c) => LESSON_COUPON_KINDS.includes(couponKind(c)))
    .filter((c) => isVisibleTo(c, quem))
    .filter((c) => !jaUsou(c, uid, minhasAulas))
    .slice(0, 3), [promos.data, quem, uid, minhasAulas]);

  const conferir = async (codigoDado) => {
    const limpo = limpar(codigoDado ?? codigo);
    if (!limpo) return;
    setCodigo(limpo);
    setEstado({ carregando: true, erro: '' });
    setEscolhido(null);
    onChange(null);
    try {
      const cupom = await findCoachCouponByCode(coachId, limpo);
      const problema = lessonCouponProblem(cupom, {
        coachId, usedByUser: jaUsou(cupom, uid, minhasAulas), isStudent: ehAluno,
      });
      if (problema) {
        setEstado({ carregando: false, erro: problema });
        return;
      }
      setEscolhido(cupom);
      onChange(lessonCouponFromPromo(cupom));
      setEstado({ carregando: false, erro: '' });
    } catch {
      setEstado({ carregando: false, erro: 'Não foi possível conferir o cupom agora. Tente de novo.' });
    }
  };

  // Veio com o código (o aluno tocou em "Usar ao pedir a aula"): confere já.
  useEffect(() => {
    if (initialCode) conferir(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  // O valor com o desconto — só quando dá para estimar (valor-hora e horário).
  const estimativa = useMemo(() => {
    if (!escolhido || !value || !slot) return null;
    const base = lessonCouponBase({ slots: [slot] }, { hourly_rate: hourlyRate });
    if (base == null) return null;
    const desconto = lessonCouponDiscount(base, escolhido);
    return { de: base, por: Math.max(0, Math.round((base - desconto) * 100) / 100) };
  }, [escolhido, value, slot, hourlyRate]);

  return (
    <div>
      <Label htmlFor="aula-cupom" className="text-xs">Tem um cupom do professor? (opcional)</Label>
      <div className="mt-1 flex gap-2">
        <Input id="aula-cupom" maxLength={30} placeholder="AULA10" value={codigo}
          onChange={(e) => {
            setCodigo(limpar(e.target.value));
            setEscolhido(null);
            onChange(null);
            setEstado({ carregando: false, erro: '' });
          }} />
        <Button type="button" variant="outline" disabled={!codigo.trim() || estado.carregando} onClick={() => conferir()}>
          {estado.carregando ? 'Conferindo…' : 'Aplicar'}
        </Button>
      </div>

      {paraTocar.length > 0 && !value && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/50">Promoções:</span>
          {paraTocar.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={estado.carregando}
              onClick={() => conferir(c.code)}
              className="rounded-full border border-dashed border-ink/30 bg-paper-pure px-2.5 py-1 text-xs font-bold text-ink hover:border-ink disabled:opacity-50"
              title={c.description || c.code}
            >
              {promoBenefitText(c)}
            </button>
          ))}
        </div>
      )}

      {estado.erro && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{estado.erro}</p>}
      {value && (
        <p className="mt-1 text-xs font-semibold text-green-700">
          {value.code}: {value.benefit}
          {estimativa
            ? ` — estimativa: ${formatPrice(estimativa.de)} por ${formatPrice(estimativa.por)}.`
            : '.'}
          {' '}Entra quando o professor confirmar a aula.
        </p>
      )}
    </div>
  );
}

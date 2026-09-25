/**
 * V2ArenaMarketing — o marketing e a fidelidade da arena.
 *
 * Módulos: `marketing` (+ `marketing_coupons`, `marketing_campaigns`,
 * `marketing_nps`, `marketing_referral`, `marketing_loyalty`).
 *
 * ## Dentro da arena (2026-09-24)
 *
 * Era uma página separada, alcançada por um botão. Virou a seção
 * **Marketing** da Central (`ArenaMarketingPanel`, uma aba por ferramenta
 * ligada: Cupons · Campanhas · Satisfação · Indicações). As rotas antigas
 * (`/gerir/marketing` e `/marketing`) levam à seção — avisos e links salvos
 * seguem funcionando. E o cupom ganhou **"Divulgar na página da arena"**: aí
 * ele vira promoção, aparece na página da arena e é oferecido no pedido de
 * reserva com um toque.
 *
 * ## O que a versão anterior não fazia
 *
 * Ela LISTAVA. O cupom só podia ser criado — não editado, não desligado, não
 * apagado (a regra do Firestore recusava o `delete`, corrigida na Onda AG); a
 * campanha era um rascunho que não chegava a ninguém; o NPS mostrava a nota
 * sem os comentários, que são a única parte acionável; e a indicação não tinha
 * onde ser resgatada. Um console de marketing que não envia, não corrige e não
 * mostra o motivo da nota é um relatório, não uma ferramenta.
 *
 * ## As decisões que valem a pena conhecer
 *
 * - **A campanha diz para quantas pessoas vai ANTES de enviar.** O público é
 *   calculado no domínio (`campaignRecipients`) a partir do que a tela já tem
 *   em mãos — membros e reservas. Mandar mensagem para um número desconhecido
 *   de pessoas é como uma arena queima a paciência da própria comunidade.
 * - **Desligar vem antes de apagar.** Apagar leva junto a contagem de usos, e
 *   aí ninguém responde mais "quanto essa promoção rendeu?".
 * - **A indicação é resgatada pela ARENA.** Não é escolha de produto: só o
 *   gestor pode creditar carteira. No balcão é assim mesmo — a pessoa chega e
 *   diz quem indicou.
 * - **Quem não é gestor não vê esta tela.** A pergunta de NPS ao atleta mora
 *   na página da arena, no momento em que ele acabou de jogar.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Check, Gift, MessageSquare, Star, TrendingUp,
} from 'lucide-react';
import {
  useArenaCouponsAll, useArenaNps, useArenaNpsResponses, useRedeemReferral,
} from '@/modules/arenas/hooks/useArenaV3';
import {
  classifyNps, referralProgram, referralRewards,
} from '@/modules/arenas/domain/marketing';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import CouponsPanel from '@/v2/components/arenas/marketing/coupons/CouponsPanel';
import CampaignsPanel from '@/v2/components/arenas/marketing/campaigns/CampaignsPanel';
import ReferralRulesCard from '@/v2/components/arenas/marketing/coupons/ReferralRulesCard';
import BookingReferralsToRegister from '@/v2/components/arenas/marketing/coupons/BookingReferralsToRegister';
import { AthletePicker } from '@/v2/components/arenas/marketing/coupons/VoucherReception';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

/** `Timestamp | Date | number` → ms, ou `null`. */
function ms(v) {
  if (!v) return null;
  const n = v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : v?.seconds ? v.seconds * 1000 : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ms → 'YYYY-MM-DD' (o formato que `formatDateShortBR` espera). */
function iso(v) {
  const n = ms(v);
  if (n == null) return null;
  const d = new Date(n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ======================================================== 1. CUPONS ====== */

// Os cupons moram em `v2/components/arenas/marketing/coupons/` desde a Onda BX:
// tipos (desconto, hora grátis, vales, indicação), recepção de vales e o
// controle de uso. Esta página só os monta.

/* ===================================================== 2. CAMPANHAS ====== */

// As campanhas moram em `v2/components/arenas/marketing/campaigns/` desde a
// Onda CC: banner (criado a partir de um modelo ou enviado), destino, onde
// aparece e até quando, e o aviso no aplicativo.

/* ========================================================== 3. NPS ====== */

const NPS_TONE = { promoter: 'green', passive: 'amber', detractor: 'red' };
const NPS_LABEL = { promoter: 'Promotor', passive: 'Neutro', detractor: 'Detrator' };

function NpsSecao({ arenaId }) {
  const { data: resumo } = useArenaNps(arenaId);
  const { data: respostas = [], isLoading } = useArenaNpsResponses(arenaId);

  const comentarios = useMemo(
    () => [...respostas]
      .filter((r) => String(r.comment || '').trim())
      .sort((a, b) => (ms(b.created_at) || 0) - (ms(a.created_at) || 0))
      .slice(0, 12),
    [respostas],
  );

  const total = respostas.length;
  const contagem = useMemo(() => respostas.reduce((acc, r) => {
    const k = classifyNps(r.score);
    return { ...acc, [k]: (acc[k] || 0) + 1 };
  }, { promoter: 0, passive: 0, detractor: 0 }), [respostas]);

  const nota = Number(resumo?.nps);
  const temNota = Number.isFinite(nota) && total > 0;

  return (
    <V2Surface>
      <div className="mb-4 flex items-center gap-2">
        <Star className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Satisfação (NPS)</h2>
      </div>

      {isLoading && <V2Skeleton className="h-24 rounded-2xl" />}

      {!isLoading && total === 0 && (
        <V2EmptyState
          icon={Star}
          title="Ninguém respondeu ainda"
          description="A pergunta aparece sozinha para quem jogou aqui nos últimos 30 dias, uma vez a cada 90 dias. Ela não é feita a quem nunca veio."
        />
      )}

      {!isLoading && total > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">NPS</p>
              <p className="font-display text-4xl font-bold text-ink">{temNota ? nota : '—'}</p>
              <p className="text-xs text-gray-500">{total} {total === 1 ? 'resposta' : 'respostas'}</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {['promoter', 'passive', 'detractor'].map((k) => {
                const n = contagem[k] || 0;
                const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs text-gray-500">{NPS_LABEL[k]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${k === 'promoter' ? 'bg-green-500' : k === 'passive' ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-bold text-ink">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-3 flex items-start gap-1.5 rounded-2xl bg-paper p-3 text-xs leading-5 text-gray-500">
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            O NPS é a diferença entre a fatia de promotores (9-10) e a de detratores (0-6).
            Vai de −100 a 100; acima de 50 é considerado muito bom.
          </p>

          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
              O que estão dizendo
            </p>
            {comentarios.length === 0 ? (
              <p className="text-sm text-gray-500">
                As notas vieram sem comentário. O número diz que algo mudou; o comentário é o
                que diz o quê.
              </p>
            ) : (
              <ul className="space-y-2">
                {comentarios.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <V2Badge tone={NPS_TONE[classifyNps(r.score)]}>
                        {r.score} · {NPS_LABEL[classifyNps(r.score)]}
                      </V2Badge>
                      {iso(r.created_at) && (
                        <span className="text-xs text-gray-400">{formatDateShortBR(iso(r.created_at))}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-gray-700">{r.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </V2Surface>
  );
}

/* =================================================== 4. INDICAÇÕES ====== */

function IndicacoesSecao({ arenaId }) {
  const cuponsQ = useArenaCouponsAll(arenaId);
  const programa = useMemo(() => referralProgram(cuponsQ.data || []), [cuponsQ.data]);
  const resgatar = useRedeemReferral();
  const [code, setCode] = useState('');
  const [indicado, setIndicado] = useState(null);
  // Os valores vêm das regras do programa; sem programa, o padrão de antes.
  const [premios, setPremios] = useState(null);
  const padrao = useMemo(() => {
    const r = referralRewards(programa);
    return programa
      ? { quemIndica: r.referrerCredit, quemChega: r.referredCredit }
      : { quemIndica: 20, quemChega: 20 };
  }, [programa]);
  const valores = premios || padrao;

  const enviar = async () => {
    try {
      const r = await resgatar.mutateAsync({
        arenaId,
        code: code.trim().toUpperCase(),
        referredId: indicado.id,
        referredName: indicado.platform_name || indicado.full_name || 'Atleta',
        referrerReward: Number(valores.quemIndica) || 0,
        referredReward: Number(valores.quemChega) || 0,
        program: programa,
      });
      toast.success(`Indicação registrada. ${formatPrice(r.referrerReward)} para quem indicou e ${formatPrice(r.referredReward)} para quem chegou.`);
      setCode(''); setIndicado(null); setPremios(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível registrar a indicação.');
    }
  };

  const pronto = code.trim().length >= 4 && indicado
    && (Number(valores.quemIndica) || 0) + (Number(valores.quemChega) || 0) > 0;

  return (
    <V2Surface>
      <div className="mb-2 flex items-center gap-2">
        <Gift className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Indique e ganhe</h2>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Cada atleta pega o próprio código na página da arena, em &quot;Indique e ganhe&quot;. As regras abaixo dizem o
        que cada lado ganha. O crédito é lançado pela arena porque só ela pode creditar saldo.
      </p>

      <ReferralRulesCard
        arenaId={arenaId}
        coupons={cuponsQ.data}
        program={programa}
        isLoading={cuponsQ.isLoading}
        isError={cuponsQ.isError}
        onRetry={() => cuponsQ.refetch()}
      />

      <BookingReferralsToRegister arenaId={arenaId} />

      <h3 className="mb-2 mt-5 font-display text-base font-bold text-ink">Registrar uma indicação no balcão</h3>
      <p className="mb-3 text-xs text-gray-500">
        Quem digita o código ao pedir a reserva é conferido sozinho, na confirmação. Aqui é para quem chegou no
        balcão dizendo que foi indicado: informe o código e quem chegou.
        {programa ? ' As regras do programa são conferidas (limite por pessoa e, se valer, "só quem nunca reservou aqui").' : ''}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Código de indicação" htmlFor="ref-code">
          <V2Input id="ref-code" maxLength={20} placeholder="ABC123XYZW"
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))} />
        </V2Field>
        <V2Field label="Crédito para quem indicou (R$)" htmlFor="ref-premio-indica">
          <V2Input id="ref-premio-indica" type="number" min="0" step="0.01"
            value={valores.quemIndica} onChange={(e) => setPremios({ ...valores, quemIndica: e.target.value })} />
        </V2Field>
        <V2Field label="Crédito para quem chegou (R$)" htmlFor="ref-premio-chega">
          <V2Input id="ref-premio-chega" type="number" min="0" step="0.01"
            value={valores.quemChega} onChange={(e) => setPremios({ ...valores, quemChega: e.target.value })} />
        </V2Field>
      </div>

      <V2Field label="Quem foi indicado" htmlFor="ref-quem" className="mt-3">
        <AthletePicker value={indicado} onChange={setIndicado} inputId="ref-quem" />
      </V2Field>

      <div className="mt-3 flex justify-end">
        <V2Button disabled={!pronto || resgatar.isPending} onClick={enviar}>
          <Check className="mr-1.5 h-4 w-4" />
          {resgatar.isPending ? 'Registrando…' : 'Registrar indicação'}
        </V2Button>
      </div>

    </V2Surface>
  );
}

/* ================================================ NA CENTRAL ====== */

/**
 * O marketing dentro da Central da arena — uma aba por ferramenta.
 *
 * `view` é o valor da aba (`cupons`, `campanhas`, `satisfacao`, `indicacoes`,
 * ou `marketing` quando nenhuma ferramenta está ligada). Quem decide que a
 * aba existe é a Central (`buildArenaSections`), pelo módulo de cada uma.
 */
export function ArenaMarketingPanel({ arena, view }) {
  // O tipo "Indicação" só aparece em Cupons com o módulo de indicações ligado.
  const { isOn } = useArenaModules(arena.id);
  const indicacoesLigadas = isOn(ARENA_MODULE_ID.MARKETING_REFERRAL);
  if (view === 'cupons') return <CouponsPanel arenaId={arena.id} arena={arena} referralOn={indicacoesLigadas} />;
  if (view === 'campanhas') return <CampaignsPanel arena={arena} />;
  if (view === 'satisfacao') return <NpsSecao arenaId={arena.id} />;
  if (view === 'indicacoes') return <IndicacoesSecao arenaId={arena.id} />;
  return (
    <V2Surface>
      <V2EmptyState
        icon={MessageSquare}
        title="Nenhuma ferramenta de marketing ativa"
        description="Cupons, campanhas, pesquisa de satisfação e indique-e-ganhe ligam separadamente, em Configurações → Módulos. Cada uma ligada vira uma aba aqui."
        action={(
          <Link to={`/arenas/${arena.id}/gerir?aba=modulos`} className="text-sm font-bold text-ink underline">
            Abrir os módulos
          </Link>
        )}
      />
    </V2Surface>
  );
}

/* ======================================================== A ROTA ====== */

/**
 * `/arenas/:arenaId/gerir/marketing` e `/arenas/:arenaId/marketing` — as rotas
 * antigas do console. O marketing virou a seção Marketing da Central; a rota
 * fica porque avisos antigos e links salvos apontam para ela.
 */
export default function V2ArenaMarketing() {
  const { arenaId } = useParams();
  return <Navigate to={`/arenas/${arenaId}/gerir?secao=marketing`} replace />;
}

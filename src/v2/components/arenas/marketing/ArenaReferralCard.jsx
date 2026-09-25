/**
 * "Indique e ganhe" — o código do atleta nesta arena (módulo
 * `marketing_referral`).
 *
 * Antes o código só existia em "Você nesta arena", que exige o módulo de
 * MEMBROS e só o mostrava a quem já era membro — embora a indicação dependa só
 * do marketing. E mesmo ali ele nunca aparecia: o serviço lia o documento
 * antes de criá-lo, a regra recusava a leitura de documento inexistente, e a
 * tela sumia sem aviso (corrigido na regra, com asserções no emulador).
 *
 * Agora o cartão mora na página da arena, para qualquer pessoa logada, e o
 * código nasce quando ela PEDE ("Quero meu código") — criá-lo a cada visita
 * gravaria um documento para cada curioso que abrisse a página.
 *
 * Falha ao ler não vira "você ainda não tem código": o botão de criar só
 * aparece quando a leitura CONFIRMOU que não há.
 *
 * Desde a Onda BX o cartão diz as REGRAS do programa (o cupom do tipo
 * indicação): quanto ganha quem indica, quanto ganha quem chega, e se vale só
 * para quem nunca reservou aqui. O convite enviado diz o mesmo. Sem programa,
 * o texto de sempre.
 */
import React, { useMemo } from 'react';
import { toast } from 'sonner';
import { Copy, Gift, Share2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useArenaCoupons, useCreateMyReferralCode, useMyReferralCode } from '@/modules/arenas/hooks/useArenaV3';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { referralInviteText, referralProgram, referralRulesText } from '@/modules/arenas/domain/marketing';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

export default function ArenaReferralCard({ arena, className = 'mt-6' }) {
  const arenaId = arena?.id;
  const { user } = useAuth();
  const { isOn, isLoading: modulosLoading } = useArenaModules(arenaId);
  const ligado = isOn(ARENA_MODULE_ID.MARKETING) && isOn(ARENA_MODULE_ID.MARKETING_REFERRAL);
  const consulta = useMyReferralCode(ligado && user?.uid ? arenaId : null);
  const criar = useCreateMyReferralCode();
  // As regras do programa (cupom do tipo indicação). A mesma consulta das
  // promoções da página — o cache é compartilhado.
  const { data: cupons } = useArenaCoupons(ligado ? arenaId : null);
  const programa = useMemo(() => referralProgram(cupons || []), [cupons]);

  if (modulosLoading || !ligado || !user?.uid || !arena) return null;

  const codigo = consulta.data?.code || null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success('Código copiado.');
    } catch {
      toast.error(`Não foi possível copiar. Anote: ${codigo}`);
    }
  };

  const convidar = async () => {
    const texto = referralInviteText({ arenaName: arena.name, code: codigo, program: programa });
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        toast.success('Convite copiado.');
      }
    } catch {
      /* a pessoa cancelou o compartilhamento — não é erro */
    }
  };

  const pedir = () => criar.mutateAsync({ arenaId })
    .catch((e) => toast.error(e?.message || 'Não foi possível criar o seu código agora.'));

  const usos = Number(consulta.data?.redeemed_count) || 0;

  return (
    <V2Surface className={className}>
      <div className="flex items-start gap-2">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold text-ink">Indique e ganhe</h3>
          {programa ? (
            <>
              <p className="mt-0.5 text-sm text-gray-600">{referralRulesText(programa)}.</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {[
                  programa.first_booking_only !== false ? 'Vale para quem nunca reservou aqui' : null,
                  programa.min_amount ? `primeira reserva a partir de ${formatPrice(programa.min_amount)}` : null,
                  programa.max_per_referrer ? `até ${programa.max_per_referrer} indicações por pessoa` : null,
                ].filter(Boolean).join(' · ')}
              </p>
              {programa.description && <p className="mt-1 text-sm text-gray-600">{programa.description}</p>}
            </>
          ) : (
            <p className="mt-0.5 text-sm text-gray-500">
              Traga alguém para jogar aqui: quem chegar dizendo o seu código ganha crédito na arena — e você também.
            </p>
          )}

          {consulta.isLoading && <V2Skeleton className="mt-3 h-10 w-48 rounded-2xl" />}

          {consulta.isError && (
            <V2ErrorState
              inline
              className="mt-3"
              title="Não foi possível buscar o seu código"
              onRetry={() => consulta.refetch()}
            />
          )}

          {consulta.isSuccess && codigo && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-2xl border border-dashed border-gray-300 bg-paper px-4 py-2 font-display text-lg font-bold tracking-widest text-ink">
                  {codigo}
                </span>
                <V2Button size="sm" variant="ghost" onClick={copiar} aria-label={`Copiar o código ${codigo}`}>
                  <Copy className="mr-1.5 h-4 w-4" /> Copiar
                </V2Button>
                <V2Button size="sm" variant="ghost" onClick={convidar}>
                  <Share2 className="mr-1.5 h-4 w-4" /> Convidar
                </V2Button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {usos > 0
                  ? `${usos} ${usos === 1 ? 'pessoa já usou' : 'pessoas já usaram'} o seu código.`
                  : 'Quem você indicar diz o código na recepção; a arena registra e credita os dois.'}
              </p>
            </>
          )}

          {consulta.isSuccess && !codigo && (
            <V2Button size="sm" className="mt-3" onClick={pedir} disabled={criar.isPending}>
              {criar.isPending ? 'Criando…' : 'Quero meu código'}
            </V2Button>
          )}
        </div>
      </div>
    </V2Surface>
  );
}

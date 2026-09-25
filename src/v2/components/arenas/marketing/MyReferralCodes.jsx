/**
 * "Meus códigos de indicação" — no perfil do atleta (Onda BY).
 *
 * O código de indicação é POR ARENA (cada arena tem o seu programa), e até
 * aqui ele só aparecia na página de cada arena: quem queria indicar um amigo
 * precisava lembrar em qual arena tinha pegado o código. O perfil junta todos,
 * cada um com as REGRAS daquela arena (quanto ganha quem indica, quanto ganha
 * quem chega) e com copiar/convidar.
 *
 * Cada linha obedece aos módulos DAQUELA arena: indicação desligada ⇒ a linha
 * some (o código seguiria existindo, mas não vale nada). Sem nenhum código, a
 * seção não aparece — quem nunca pegou um não precisa de um cartão vazio no
 * perfil; o código nasce na página da arena, em "Indique e ganhe".
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Gift, Share2 } from 'lucide-react';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useArenaCoupons, useMyReferralCodes } from '@/modules/arenas/hooks/useArenaV3';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { referralInviteText, referralProgram, referralRulesText } from '@/modules/arenas/domain/marketing';
import { V2Button, V2ErrorState, V2Surface } from '@/v2/ui/primitives';

function CodigoNaArena({ referral }) {
  const arenaId = referral.arena_id;
  const { data: arena } = useArena(arenaId);
  const { isOn, isLoading } = useArenaModules(arenaId);
  const ligado = isOn(ARENA_MODULE_ID.MARKETING) && isOn(ARENA_MODULE_ID.MARKETING_REFERRAL);
  const { data: cupons } = useArenaCoupons(ligado ? arenaId : null);
  const programa = useMemo(() => referralProgram(cupons || []), [cupons]);

  if (isLoading || !ligado) return null;

  const nome = arena?.name || 'Arena';
  const codigo = referral.code;
  const usos = Number(referral.redeemed_count) || 0;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success('Código copiado.');
    } catch {
      toast.error(`Não foi possível copiar. Anote: ${codigo}`);
    }
  };
  const convidar = async () => {
    const texto = referralInviteText({ arenaName: nome, code: codigo, program: programa });
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

  return (
    <li className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/arenas/${arenaId}`} className="font-display text-sm font-bold text-ink hover:underline">{nome}</Link>
          <p className="text-xs text-gray-500">
            {programa ? referralRulesText(programa) : 'A arena ainda não publicou as regras.'}
            {usos > 0 ? ` · ${usos} ${usos === 1 ? 'pessoa usou' : 'pessoas usaram'}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-xl border border-dashed border-gray-300 bg-paper-pure px-3 py-1.5 font-display text-sm font-bold tracking-widest text-ink">
            {codigo}
          </span>
          <V2Button size="sm" variant="ghost" onClick={copiar} aria-label={`Copiar o código ${codigo}`}>
            <Copy className="h-4 w-4" />
          </V2Button>
          <V2Button size="sm" variant="ghost" onClick={convidar} aria-label={`Convidar alguém para a ${nome}`}>
            <Share2 className="h-4 w-4" />
          </V2Button>
        </div>
      </div>
    </li>
  );
}

export default function MyReferralCodes() {
  const { data: codigos, isError, refetch } = useMyReferralCodes();

  if (isError) {
    return (
      <V2ErrorState
        inline
        className="mt-8"
        title="Não foi possível carregar os seus códigos de indicação"
        onRetry={() => refetch()}
      />
    );
  }
  if (!Array.isArray(codigos) || codigos.length === 0) return null;

  return (
    <V2Surface className="mt-8">
      <div className="mb-1 flex items-center gap-2">
        <Gift className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Meus códigos de indicação</h2>
      </div>
      <p className="mb-3 text-sm text-gray-500">
        Um código por arena. Quem você indicar digita o código ao pedir a primeira reserva, e a arena credita quando confirmar.
      </p>
      <ul className="space-y-2">
        {codigos.map((r) => <CodigoNaArena key={r.id} referral={r} />)}
      </ul>
    </V2Surface>
  );
}

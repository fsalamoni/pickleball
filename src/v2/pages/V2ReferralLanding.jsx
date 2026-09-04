import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Gift, Sparkles } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { capturePendingReferral } from '@/modules/progression/domain/referralCapture';
import { REFERRAL_REWARDS } from '@/modules/progression/domain/referrals';
import { V2Button, V2PageIntro, V2Surface } from '@/v2/ui/primitives';

/**
 * V2ReferralLanding — `/r/:code`, o destino do link de convite.
 *
 * Antes esta rota simplesmente não existia: todo convite compartilhado caía
 * no 404 do app, e o programa de indicação nunca creditava ninguém.
 *
 * O que faz: guarda o código (sobrevive ao desvio pelo login social) e
 * encaminha. Quem já está logado vai direto para a gamificação — o crédito
 * só acontece no PRIMEIRO login de uma conta nova, então não há como usar o
 * próprio link para se autoindicar.
 *
 * Rota pública de propósito: o convidado ainda não tem conta.
 */
export default function V2ReferralLanding() {
  const { code } = useParams();
  const { isAuthenticated, isLoading } = useAuth();
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  const [guardado, setGuardado] = useState(null);

  // Só captura com a feature ligada — com a flag OFF nada é gravado em
  // lugar nenhum, e o link se comporta como um convite comum para o app.
  useEffect(() => {
    if (!gamificationOn) return;
    setGuardado(capturePendingReferral(code));
  }, [code, gamificationOn]);

  const recompensa = useMemo(
    () => Object.values(REFERRAL_REWARDS)[0]?.refereeXp || 0,
    [],
  );

  if (isLoading) return null;

  // Já tem conta: o convite não se aplica, mas o link não pode ser um beco sem saída.
  if (isAuthenticated) {
    return <Navigate to={gamificationOn ? '/gamification' : '/'} replace />;
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 py-10">
      <V2PageIntro
        title="Você foi convidado"
        subtitle="Entre no PickleRush e comece com XP na conta."
      />
      <V2Surface>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-100 text-amber-700">
            <Gift className="h-7 w-7" aria-hidden="true" />
          </div>
          {guardado ? (
            <>
              <p className="text-sm text-gray-600">
                Convite <span className="font-mono font-bold text-ink">{guardado}</span> aplicado.
                Crie sua conta para receber o bônus.
              </p>
              {recompensa > 0 && (
                <p className="inline-flex items-center gap-1 text-sm font-bold text-amber-700">
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> +{recompensa} XP de boas-vindas
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-600">
              Este convite não é válido, mas você ainda pode criar sua conta e
              começar a jogar.
            </p>
          )}
          <V2Button asChild className="w-full sm:w-auto">
            <Link to="/login">Criar minha conta</Link>
          </V2Button>
          <Link to="/" className="text-xs text-gray-500 underline">
            Conhecer a plataforma primeiro
          </Link>
        </div>
      </V2Surface>
    </div>
  );
}

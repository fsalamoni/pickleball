/**
 * "Parabenizar": um kudo (`positive`) para cada medalhista com conta, com o
 * `contextId` da conquista — a MESMA máquina de XP, missões e antifarm dos
 * kudos de sempre. Quem recebe ganha o aviso no sino. Zero coleção nova.
 *
 * Para si mesmo não aparece; deslogado vira o convite de entrar.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PartyPopper, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { giveKudoAudited } from '@/modules/progression/services/kudoService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { logger } from '@/core/lib/logger';
import { V2Button } from '@/v2/ui/primitives';
import { t, tx } from '@/core/i18n';

const PREF = (contextId) => `parabens:${contextId}`;

/**
 * @param {{
 *   contextId: string,
 *   toUids: string[],        quem recebe (medalhistas com conta)
 *   scope?: 'tournament'|'universal',
 *   eventTitle: string, placeLabel: string,
 *   size?: string, variant?: string, className?: string,
 * }} props
 */
export default function CongratulateButton({ contextId, toUids = [], scope = 'tournament', eventTitle, placeLabel, size = 'sm', variant = 'secondary', className }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const me = user?.uid || null;
  const outros = useMemo(() => [...new Set(toUids.filter((u) => u && u !== me))], [toUids, me]);
  const [feito, setFeito] = useState(() => Boolean(me && contextId && readViewPreference(me, PREF(contextId))));

  const mut = useMutation({
    mutationFn: async () => {
      const resultados = await Promise.allSettled(outros.map((toUid) => giveKudoAudited({
        actor: user, toUid, type: 'positive', scope, contextId,
        message: `Parabéns pelo ${placeLabel} — ${eventTitle}`.slice(0, 280),
      })));
      const ok = outros.filter((_, i) => resultados[i].status === 'fulfilled');
      if (ok.length === 0) throw resultados[0]?.reason || new Error(t('Não foi possível parabenizar.'));
      await notifyUsers(ok, {
        type: NOTIFICATION_TYPE.GAMIFICATION,
        title: tx('Você recebeu parabéns'),
        message: tx('{nome} parabenizou você pelo {colocacao} em {evento}.', { nome: user.displayName || 'Alguém', colocacao: placeLabel, evento: eventTitle }),
        link: '/perfil?secao=trofeus',
        actor: user,
      }).catch((err) => logger.warn('Parabéns: aviso não gravado', err));
      return ok.length;
    },
    onSuccess: () => {
      setFeito(true);
      writeViewPreference(me, PREF(contextId), '1');
      qc.invalidateQueries({ queryKey: ['user-kudo-index', me] });
      toast.success(t('Parabéns enviado! Você ganhou XP por torcer.'));
    },
    onError: (err) => toast.error(err?.message || t('Não foi possível parabenizar agora.')),
  });

  if (outros.length === 0) return null;
  if (!me) {
    return (
      <V2Button asChild size={size} variant={variant} className={className}><Link to="/login">
        <PartyPopper className="h-4 w-4" /> {t('Entre para parabenizar')}</Link>
      </V2Button>
    );
  }
  return (
    <V2Button size={size} variant={feito ? 'ghost' : variant} className={className} disabled={feito || mut.isPending} onClick={() => mut.mutate()}>
      {feito ? <Check className="h-4 w-4 text-green-600" /> : <PartyPopper className="h-4 w-4" />}
      {feito ? t('Parabéns enviado') : mut.isPending ? t('Enviando…') : t('Parabenizar')}
    </V2Button>
  );
}

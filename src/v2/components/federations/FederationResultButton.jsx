/**
 * "Enviar ao ranking oficial" — na tela de resultados do torneio, por
 * categoria, só para quem administra e só com a chancela APROVADA. A
 * colocação enviada é a do pódio (`modalityPlacement`, fonte única); a
 * categoria precisa estar completa. Reenviar substitui o envio anterior,
 * por isso pergunta antes.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Landmark, Send } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAllModalityMatches, useRegistrations } from '@/modules/tournament/hooks/useTournament';
import { isModalityComplete } from '@/modules/tournament/domain/tournamentCompletion';
import { sendFederationResult } from '@/modules/federations/services/federationService';
import { useFederationMutation, useTournamentFederationResults } from '@/modules/federations/hooks/useFederations';
import { sanctionState } from '@/modules/federations/domain/sanction';
import { RESULT_STATUS, fedResultDocId } from '@/modules/federations/domain/constants';
import { V2Button } from '@/v2/ui/primitives';
import { quando } from './federationUi';
import { t } from '@/core/i18n';

export default function FederationResultButton({ tournament, modality, className }) {
  const { user } = useAuth();
  const [reenviando, setReenviando] = useState(false);
  const st = sanctionState(tournament);
  const matches = useAllModalityMatches(st.approved ? modality?.id : null);
  const registrations = useRegistrations(st.approved ? modality?.id : null);
  const enviados = useTournamentFederationResults(st.approved ? tournament?.id : null);
  const enviar = useFederationMutation(() => sendFederationResult({ tournament, modality, matches: matches.data || [], registrations: registrations.data || [], uid: user?.uid }));
  if (!st.approved) return null;
  const completa = matches.isSuccess && isModalityComplete(modality, matches.data || []);
  const atual = (enviados.data || []).find((r) => r.id === fedResultDocId(st.federationId, tournament.id, modality.id)) || null;
  const pronto = matches.isSuccess && registrations.isSuccess;
  const recusado = atual?.status === RESULT_STATUS.REJECTED;
  const mandar = () => enviar.mutate(undefined, { onSuccess: () => { setReenviando(false); toast.success(t('Resultado enviado ao ranking oficial.')); }, onError: (e) => toast.error(e.message) });
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-2xl border border-purple-100 bg-purple-50/60 p-3 text-sm ${className || ''}`} data-dica="torneio-enviar-resultado">
      <Landmark className="h-4 w-4 text-purple-700" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-gray-700">
        {atual
          ? (recusado
            ? t('Resultado recusado pela {sigla}: {motivo}', { sigla: st.acronym, motivo: atual.review?.reason || '' })
            : <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />{t('No ranking oficial da {sigla} desde {data}.', { sigla: st.acronym, data: quando(atual.sent_at) })}</span>)
          : (completa ? t('Categoria encerrada: envie a colocação ao ranking oficial da {sigla}.', { sigla: st.acronym }) : t('Quando a categoria encerrar, envie a colocação ao ranking oficial da {sigla}.', { sigla: st.acronym }))}
      </span>
      {pronto && completa && (
        <V2Button type="button" size="sm" variant={atual ? 'ghost' : 'primary'} disabled={enviar.isPending} onClick={() => (atual ? setReenviando(true) : mandar())}>
          <Send className="h-4 w-4" />{atual ? t('Reenviar') : t('Enviar ao ranking oficial')}
        </V2Button>
      )}
      <ConfirmDialog
        open={reenviando}
        onOpenChange={setReenviando}
        loading={enviar.isPending}
        title={t('Reenviar o resultado de {categoria}?', { categoria: modality?.name || '' })}
        description={recusado
          ? t('A colocação de agora substitui o envio recusado e volta ao ranking oficial da {sigla}, que é refeito. A federação vê o novo envio e pode recusar de novo.', { sigla: st.acronym })
          : t('A colocação de agora substitui a que está no ranking oficial da {sigla}, que é refeito. Use quando corrigiu um placar depois de enviar.', { sigla: st.acronym })}
        confirmLabel={t('Reenviar')}
        cancelLabel={t('Voltar')}
        onConfirm={mandar}
      />
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Megaphone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlatformSurfaceCard } from '@/components/ui/platform-page';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  useModalities,
  useRegistrationsByTournament,
  useSendTournamentAnnouncement,
  useTournamentAnnouncements,
} from '@/modules/tournament/hooks/useTournament';
import {
  announcementRecipients,
  buildAnnouncementWhatsAppText,
  validateAnnouncement,
} from '@/modules/tournament/domain/announcements';

function formatWhen(announcement) {
  const ms = announcement.created_at_ms
    || (announcement.created_at?.toMillis ? announcement.created_at.toMillis() : null);
  if (!ms) return '';
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Card "Comunicação com os inscritos" (flag tournament_announcements) do hub
 * administrativo: envia aviso in-app aos inscritos (torneio todo ou uma
 * modalidade), com contagem de destinatários, texto pronto para WhatsApp e
 * histórico dos avisos enviados.
 */
export default function TournamentAnnouncementsCard({ tournament }) {
  const { data: modalities = [] } = useModalities(tournament.id);
  const { data: registrations = [] } = useRegistrationsByTournament(tournament.id);
  const { data: announcements = [] } = useTournamentAnnouncements(tournament.id);
  const sendMutation = useSendTournamentAnnouncement(tournament.id);

  const [modalityId, setModalityId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const recipients = useMemo(
    () => announcementRecipients(registrations, { modalityId: modalityId || null }),
    [registrations, modalityId],
  );
  const validation = validateAnnouncement({ title, message });
  const modality = modalities.find((m) => m.id === modalityId) || null;

  async function handleSend() {
    try {
      await sendMutation.mutateAsync({
        tournament,
        modalityId: modalityId || null,
        modalityName: modality?.name || null,
        title,
        message,
        recipients,
      });
      toast.success(`Aviso enviado para ${recipients.length} atleta(s).`);
      setTitle('');
      setMessage('');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível enviar o aviso.');
    }
  }

  async function handleCopyWhatsApp() {
    const text = buildAnnouncementWhatsAppText({ tournamentName: tournament.name, title, message });
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Texto copiado — cole no grupo de WhatsApp.');
    } catch {
      toast.error('Não foi possível copiar o texto.');
    }
  }

  return (
    <PlatformSurfaceCard>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acid/15 text-ink">
          <Megaphone className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="text-base font-semibold text-ink">Comunicação com os inscritos</div>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Envie um aviso como notificação na plataforma para todos os inscritos com conta
            vinculada — do torneio inteiro ou de uma modalidade.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Destinatários</Label>
          <select
            className="mt-2 h-11 w-full rounded-[1rem] border border-input bg-background px-3 text-sm"
            value={modalityId}
            onChange={(e) => setModalityId(e.target.value)}
          >
            <option value="">Todo o torneio</option>
            {modalities.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">
            {recipients.length} atleta(s) com conta vinculada receberão o aviso.
          </p>
        </div>
        <div>
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="ex.: Jogos atrasados em 30 minutos" className="mt-2" />
        </div>
        <div className="md:col-span-2">
          <Label>Mensagem</Label>
          <textarea
            className="mt-2 flex min-h-24 w-full rounded-[1rem] border border-input bg-background px-3 py-3 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            placeholder="Escreva o aviso que os atletas verão na notificação."
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ConfirmDialog
          title={`Enviar aviso para ${recipients.length} atleta(s)?`}
          description={modality ? `Somente os inscritos de "${modality.name}" receberão.` : 'Todos os inscritos do torneio com conta vinculada receberão.'}
          confirmLabel="Enviar aviso"
          destructive={false}
          onConfirm={handleSend}
          trigger={(
            <Button disabled={!validation.isValid || recipients.length === 0 || sendMutation.isPending}>
              <Send className="mr-1 h-4 w-4" />
              {sendMutation.isPending ? 'Enviando…' : 'Enviar aviso'}
            </Button>
          )}
        />
        <Button variant="outline" onClick={handleCopyWhatsApp} disabled={!validation.isValid}>
          <Copy className="mr-1 h-4 w-4" /> Copiar texto p/ WhatsApp
        </Button>
      </div>

      {announcements.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Avisos enviados</div>
          <ul className="mt-3 space-y-2">
            {announcements.slice(0, 8).map((a) => (
              <li key={a.id} className="rounded-[1.25rem] border border-gray-100 bg-white/75 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{a.title}</span>
                  <span className="text-xs text-gray-500">
                    {[a.modality_name || 'Todo o torneio', `${a.recipients_count} destinatário(s)`, formatWhen(a)].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-gray-600">{a.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PlatformSurfaceCard>
  );
}

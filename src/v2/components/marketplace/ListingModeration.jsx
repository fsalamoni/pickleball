/**
 * MERCADO — o lado "confiança" da página do anúncio:
 *  - `ReportListingButton`: qualquer pessoa logada (que não vende o anúncio)
 *    denuncia, uma vez, com motivo;
 *  - `AdminModerationBox`: o admin tira do ar (com motivo, que quem vende lê)
 *    ou devolve. As denúncias abertas do anúncio fecham com a decisão.
 */
import React, { useState } from 'react';
import { Flag, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { REPORT_REASON_LABELS } from '@/modules/marketplace/domain/constants';
import { moderateListing, reportListing } from '@/modules/marketplace/services/marketService';
import { useMarketMutation, useMyReport } from '@/modules/marketplace/hooks/useMarket';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { V2Button, V2Field, V2Select, V2Surface, V2Textarea } from '@/v2/ui/primitives';

function ReportDialog({ listing, onClose }) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [text, setText] = useState('');
  const [erro, setErro] = useState('');
  const m = useMarketMutation(() => reportListing({ listing, uid: user.uid, reason, text }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>Denunciar o anúncio</DialogTitle>
        <DialogDescription>A moderação do Mercado analisa. Quem vende não sabe quem denunciou.</DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) { setErro('Escolha o motivo.'); return; }
            m.mutate(undefined, {
              onSuccess: () => { toast.success('Denúncia enviada. Obrigado por cuidar do Mercado.'); onClose(); },
              onError: (er) => setErro(er?.code === 'permission-denied' ? 'Não foi possível enviar. Talvez você já tenha denunciado este anúncio.' : er.message),
            });
          }}
        >
          <V2Field label="Motivo" htmlFor="denuncia-motivo" error={erro}>
            <V2Select id="denuncia-motivo" value={reason} onChange={(e) => { setReason(e.target.value); setErro(''); }}>
              <option value="">Escolha…</option>
              {Object.entries(REPORT_REASON_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label="Detalhes (opcional)" htmlFor="denuncia-texto">
            <V2Textarea id="denuncia-texto" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="O que chamou a sua atenção?" />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>Voltar</V2Button>
            <V2Button type="submit" disabled={m.isPending}>{m.isPending ? 'Enviando…' : 'Enviar denúncia'}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReportListingButton({ listing }) {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const minha = useMyReport(listing.id, user?.uid);
  if (!user?.uid) return null;
  if (minha.data) return <p className="flex items-center gap-1.5 text-xs text-gray-500"><Flag className="h-3.5 w-3.5" /> Você denunciou este anúncio. A moderação está analisando.</p>;
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-gray-500 underline-offset-2 hover:text-ink hover:underline">
        <Flag className="h-4 w-4" /> Denunciar este anúncio
      </button>
      {aberto && <ReportDialog listing={listing} onClose={() => setAberto(false)} />}
    </>
  );
}

export function AdminModerationBox({ listing }) {
  const { user } = useAuth();
  const [tirando, setTirando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const m = useMarketMutation((p) => moderateListing(listing, p, { uid: user?.uid, actor: user }));
  const removido = listing.status === 'removed';
  return (
    <V2Surface variant="compacto" className="space-y-3 border-amber-200 p-5">
      <h2 className="flex items-center gap-2 font-bold text-ink"><ShieldAlert className="h-5 w-5 text-amber-600" /> Moderação</h2>
      {listing.moderation?.reason && <p className="text-sm text-gray-600">{listing.moderation.auto ? 'Automática' : 'Última decisão'}: {listing.moderation.reason}</p>}
      {removido ? (
        <V2Button type="button" disabled={m.isPending} onClick={() => m.mutate({ action: 'restore' }, { onSuccess: () => toast.success('Anúncio liberado (fica pausado até quem vende retomar).'), onError: (e) => toast.error(e.message) })}>
          Liberar o anúncio
        </V2Button>
      ) : tirando ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate({ action: 'remove', reason: motivo }, { onSuccess: () => { toast.success('Anúncio retirado. Quem vende foi avisado.'); setTirando(false); }, onError: (er) => setErro(er.message) });
          }}
        >
          <V2Field label="Motivo (quem vende vai ler)" htmlFor="mod-motivo" error={erro}>
            <V2Textarea id="mod-motivo" rows={2} maxLength={300} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus placeholder="Ex.: réplica de marca registrada." />
          </V2Field>
          <div className="flex gap-2">
            <V2Button type="button" variant="ghost" onClick={() => setTirando(false)}>Voltar</V2Button>
            <V2Button type="submit" variant="danger" disabled={m.isPending}>Tirar do ar</V2Button>
          </div>
        </form>
      ) : (
        <V2Button type="button" variant="danger" onClick={() => setTirando(true)}>Tirar do ar</V2Button>
      )}
    </V2Surface>
  );
}

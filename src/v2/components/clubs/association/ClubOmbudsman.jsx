/**
 * A ouvidoria do clube (página do clube, aba Associação): abrir uma manifestação — anônima
 * ou identificada, só com conta (barra mensagem falsa em massa) — e acompanhar pelo
 * protocolo. Quem enviou vê só o ESTADO; o texto e as anotações são da diretoria.
 * Nada é gravado pelo navegador: quem grava é o servidor (`clubDiscipline`).
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageSquareWarning } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useClubDisciplineAction, useClubReportStatus } from '@/modules/clubs/hooks/useClubDiscipline';
import { protocolToId, reportProtocol } from '@/modules/federations/domain/discipline';
import { REPORT_KIND, REPORT_MAX_CHARS, REPORT_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import { fmtData, t, tk } from '@/core/i18n';

const ASSUNTOS = Object.freeze({
  [REPORT_KIND.CONDUCT]: tk('Conduta de sócio, atleta ou dirigente'),
  [REPORT_KIND.REFEREE]: tk('Arbitragem'),
  [REPORT_KIND.ORGANIZATION]: tk('Organização de evento ou jogo'),
  [REPORT_KIND.MINOR_PROTECTION]: tk('Proteção de criança ou adolescente'),
  [REPORT_KIND.OTHER]: tk('Outro assunto'),
});

function ManifestacaoDialog({ club, onClose }) {
  const [f, setF] = useState({ kind: REPORT_KIND.CONDUCT, body: '', tournament_name: '', anonymous: false });
  const [erro, setErro] = useState('');
  const [enviada, setEnviada] = useState(null);
  const m = useClubDisciplineAction(club.id);
  const enviar = (e) => {
    e.preventDefault();
    if (f.body.trim().length < 20) { setErro(t('Conte o que aconteceu (mínimo 20 caracteres).')); return; }
    m.mutate({ action: 'report', ...f }, { onSuccess: (r) => setEnviada(r), onError: (er) => { setErro(er.message); toast.error(er.message); } });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-lg">
        <DialogTitle>{t('Manifestação à ouvidoria do {clube}', { clube: club.name })}</DialogTitle>
        <DialogDescription>{t('A diretoria do clube recebe e apura. Guarde o protocolo para acompanhar.')}</DialogDescription>
        {enviada ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">{t('Enviada. Seu protocolo:')}</p>
            <CopyCodeButton code={reportProtocol(enviada.reportId)} successMessage={t('Protocolo copiado.')} label={t('Copiar o protocolo')} />
            <p className="text-xs text-gray-500">{enviada.anonymous ? t('Anônima: só com o protocolo dá para acompanhar — anote.') : t('Identificada: só você acompanha, pelo protocolo.')}</p>
            <div className="flex justify-end"><V2Button type="button" onClick={onClose}>{t('Fechar')}</V2Button></div>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate className="space-y-4">
            <V2Field label={t('Assunto')} htmlFor="couv-tipo">
              <V2Select id="couv-tipo" value={f.kind} onChange={(e) => setF((x) => ({ ...x, kind: e.target.value }))}>
                {Object.keys(ASSUNTOS).map((k) => <option key={k} value={k}>{t(ASSUNTOS[k])}</option>)}
              </V2Select>
            </V2Field>
            <V2Field label={t('Evento ou jogo relacionado (opcional)')} htmlFor="couv-evento">
              <V2Input id="couv-evento" maxLength={120} value={f.tournament_name} onChange={(e) => setF((x) => ({ ...x, tournament_name: e.target.value }))} />
            </V2Field>
            <V2Field label={t('O que aconteceu')} htmlFor="couv-texto" error={erro} required hint={t('Até {n} caracteres. Não inclua dado pessoal de terceiros além do necessário.', { n: REPORT_MAX_CHARS })}>
              <V2Textarea id="couv-texto" rows={5} maxLength={REPORT_MAX_CHARS} value={f.body} onChange={(e) => { setF((x) => ({ ...x, body: e.target.value })); setErro(''); }} />
            </V2Field>
            <V2Toggle id="couv-anon" checked={f.anonymous} onChange={(v) => setF((x) => ({ ...x, anonymous: v }))} label={t('Enviar anonimamente')} hint={t('Nem o clube nem a plataforma saberão quem enviou. Só o protocolo acompanha.')} />
            <div className="flex justify-end gap-2">
              <V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button>
              <V2Button type="submit" disabled={m.isPending}>{t('Enviar')}</V2Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ClubOmbudsman({ club }) {
  const { isAuthenticated } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [protocolo, setProtocolo] = useState('');
  const [consulta, setConsulta] = useState('');
  const rq = useClubReportStatus(club.id, consulta);
  const buscar = (e) => {
    e.preventDefault();
    const id = protocolToId(protocolo);
    if (!id) { toast.error(t('Protocolo inválido.')); return; }
    setConsulta(id.toUpperCase());
  };
  return (
    <section aria-labelledby="clube-ouvidoria-titulo" className="space-y-3" data-dica="clube-ouvidoria-publica">
      <h3 id="clube-ouvidoria-titulo" className="font-display text-lg font-bold text-ink">{t('Ouvidoria')}</h3>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <p className="text-sm text-gray-600">{t('Conduta, arbitragem, organização de evento: conte à diretoria do clube. Pode ser anônimo — nem a plataforma guarda quem enviou. Você acompanha pelo protocolo.')}</p>
        <div className="flex flex-wrap items-center gap-2">
          {isAuthenticated
            ? <V2Button type="button" size="sm" onClick={() => setAberto(true)} data-dica="clube-ouvidoria-abrir"><MessageSquareWarning className="h-4 w-4" />{t('Enviar manifestação')}</V2Button>
            : <V2Button asChild size="sm"><Link to={`/login?next=${encodeURIComponent(`/clubes/${club.id}?tab=associacao`)}`}>{t('Entrar para enviar')}</Link></V2Button>}
          {isAuthenticated && (
            <form className="flex items-center gap-2" onSubmit={buscar}>
              <V2Input value={protocolo} onChange={(e) => setProtocolo(e.target.value.toUpperCase())} placeholder={t('Protocolo')} aria-label={t('Protocolo da manifestação')} className="h-10 w-48 font-mono uppercase" maxLength={48} />
              <V2Button type="submit" size="sm" variant="secondary">{t('Acompanhar')}</V2Button>
            </form>
          )}
        </div>
        {!isAuthenticated && <p className="text-xs text-gray-500">{t('A conta evita mensagens falsas em massa. Mesmo entrando, você pode enviar anônimo: a manifestação não guarda quem enviou.')}</p>}
        {consulta && rq.isError && <p className="text-sm text-red-600">{t('Protocolo não encontrado, ou ele não é seu.')}</p>}
        {consulta && rq.isSuccess && rq.data && (
          <p className="text-sm text-gray-700">{t('Protocolo {p}: {estado}, enviada em {data}.', { p: reportProtocol(rq.data.id), estado: t(REPORT_STATUS_LABELS[rq.data.status] || rq.data.status), data: fmtData(new Date(rq.data.created_at_ms || 0), { day: '2-digit', month: '2-digit', year: 'numeric' }) })}</p>
        )}
      </V2Surface>
      {aberto && <ManifestacaoDialog club={club} onClose={() => setAberto(false)} />}
    </section>
  );
}

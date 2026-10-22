/**
 * Comentários num documento do acervo (`kind="doc"`) ou num evento da agenda
 * (`kind="event"`). A lista vem do servidor (`federationCommentsList`), que
 * confere quem pode ver; comentar, denunciar e apagar o próprio passam por
 * `federationComments`. A equipe do acervo responde em destaque, oculta com
 * motivo, reabre e escolhe se os comentários ficam abertos, fechados ou em
 * consulta pública com prazo — tudo aqui mesmo, ao lado do que se comenta.
 *
 * Comentário não é recurso nem manifestação: o texto diz isso e leva à
 * ouvidoria, quando a federação tem uma.
 */
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeCheck, EyeOff, Flag, MessageSquare, RotateCcw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  COMMENT_MODES, COMMENT_REASON_MIN, COMMENT_REPORT_REASONS, COMMENT_TEXT_MAX, commentThreads, commentsStateLabel, validateCommentSettings, validateCommentText,
} from '@/modules/federations/domain/comments';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { commentAction } from '@/modules/federations/services/federationService';
import { useFederationComments, useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';
import { fmtData, t, tn } from '@/core/i18n';

const quando = (ms) => (ms ? fmtData(new Date(ms), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

function Config({ federation, kind, targetId, state }) {
  const [f, setF] = useState({ mode: state.mode, until_date: state.until_date || '' });
  const m = useFederationMutation(() => commentAction({ federationId: federation.id, action: 'settings', kind, targetId, settings: f }));
  const salvar = () => {
    const r = validateCommentSettings(f);
    if (!r.ok) { toast.error(r.error); return; }
    m.mutate(undefined, { onSuccess: () => toast.success(t('Comentários atualizados.')), onError: (e) => toast.error(e.message) });
  };
  const mudou = f.mode !== state.mode || (f.mode === 'consultation' && f.until_date !== (state.until_date || ''));
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3" data-dica="federacao-comentarios-config">
      <V2Field label={t('Comentários')} htmlFor={`cm-modo-${targetId}`}>
        <V2Select id={`cm-modo-${targetId}`} value={f.mode} onChange={(e) => setF((x) => ({ ...x, mode: e.target.value }))}>
          {COMMENT_MODES.map((o) => <option key={o.id} value={o.id}>{t(o.label)}</option>)}
        </V2Select>
      </V2Field>
      {f.mode === 'consultation' && (
        <V2Field label={t('Aberta até')} htmlFor={`cm-ate-${targetId}`}>
          <V2Input id={`cm-ate-${targetId}`} type="date" value={f.until_date} onChange={(e) => setF((x) => ({ ...x, until_date: e.target.value }))} />
        </V2Field>
      )}
      <V2Button type="button" size="sm" variant="secondary" disabled={!mudou || m.isPending} onClick={salvar}>{t('Salvar')}</V2Button>
    </div>
  );
}

function ReportDialog({ federation, comment, onClose }) {
  const [reason, setReason] = useState('');
  const m = useFederationMutation(() => commentAction({ federationId: federation.id, action: 'report', commentId: comment.id, reason }));
  const enviar = (e) => {
    e.preventDefault();
    if (!reason) { toast.error(t('Escolha o motivo da denúncia.')); return; }
    m.mutate(undefined, {
      onSuccess: (r) => { toast.success(r?.hidden ? t('Denúncia enviada. O comentário ficou oculto até a moderação olhar.') : t('Denúncia enviada. A moderação vai olhar.')); onClose(); },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{t('Denunciar comentário')}</DialogTitle>
        <DialogDescription>{t('Quem escreveu não fica sabendo quem denunciou. Três denúncias ocultam o comentário até a moderação olhar.')}</DialogDescription>
        <form onSubmit={enviar} className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="sr-only">{t('Motivo')}</legend>
            {COMMENT_REPORT_REASONS.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm text-ink">
                <input type="radio" name="cm-motivo" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />{t(r.label)}
              </label>
            ))}
          </fieldset>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
            <V2Button type="submit" disabled={m.isPending}>{t('Denunciar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function HideDialog({ federation, comment, onClose }) {
  const [reason, setReason] = useState('');
  const m = useFederationMutation(() => commentAction({ federationId: federation.id, action: 'hide', commentId: comment.id, reason }));
  const enviar = (e) => {
    e.preventDefault();
    if (reason.trim().length < COMMENT_REASON_MIN) { toast.error(t('Diga o motivo (mínimo {n} caracteres).', { n: COMMENT_REASON_MIN })); return; }
    m.mutate(undefined, { onSuccess: () => { toast.success(t('Comentário ocultado. Quem escreveu foi avisado com o motivo.')); onClose(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{t('Ocultar comentário')}</DialogTitle>
        <DialogDescription>{t('O comentário sai da página e quem escreveu recebe o motivo. Dá para reabrir depois.')}</DialogDescription>
        <form onSubmit={enviar} className="space-y-3">
          <V2Field label={t('Motivo')} htmlFor="cm-ocultar" required><V2Textarea id="cm-ocultar" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
            <V2Button type="submit" disabled={m.isPending}>{t('Ocultar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReplyForm({ federation, comment, onDone }) {
  const [text, setText] = useState('');
  const m = useFederationMutation(() => commentAction({ federationId: federation.id, action: 'reply', commentId: comment.id, text }));
  const enviar = (e) => {
    e.preventDefault();
    const v = validateCommentText(text);
    if (!v.ok) { toast.error(v.error); return; }
    m.mutate(undefined, { onSuccess: () => { toast.success(t('Resposta oficial publicada.')); onDone(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <form onSubmit={enviar} className="space-y-2">
      <V2Textarea aria-label={t('Resposta oficial')} rows={3} maxLength={COMMENT_TEXT_MAX} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex justify-end gap-2">
        <V2Button type="button" size="sm" variant="ghost" onClick={onDone}>{t('Cancelar')}</V2Button>
        <V2Button type="submit" size="sm" disabled={m.isPending}>{t('Responder oficialmente')}</V2Button>
      </div>
    </form>
  );
}

function Comment({ federation, c, data, onReport, onHide, isReply }) {
  const [respondendo, setRespondendo] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const apagar = useFederationMutation(() => commentAction({ federationId: federation.id, action: 'delete', commentId: c.id }));
  const reabrir = useFederationMutation(() => commentAction({ federationId: federation.id, action: 'restore', commentId: c.id }));
  const oculto = c.status !== 'visible';
  return (
    <div className={`space-y-2 rounded-xl p-3 ${c.official ? 'border border-green-200 bg-green-50' : 'bg-gray-50'} ${isReply ? 'ml-4 sm:ml-8' : ''}`}>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-ink">{c.official ? c.org_name : c.user_name}</span>
        {c.official && <V2Badge tone="green"><BadgeCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{t('Resposta oficial')}</V2Badge>}
        <span className="text-gray-500">{quando(c.created_at_ms)}</span>
        {oculto && <V2Badge tone="amber">{c.hidden_by === 'reports' ? t('Oculto por denúncias') : t('Oculto pela moderação')}</V2Badge>}
        {data.can_moderate && c.reports_count > 0 && <V2Badge tone="red">{tn(c.reports_count, '{n} denúncia', '{n} denúncias', { n: c.reports_count })}</V2Badge>}
      </p>
      <p className="whitespace-pre-line break-words text-sm text-gray-800">{c.text}</p>
      {oculto && c.hidden_reason && <p className="text-xs text-gray-500">{t('Motivo: {motivo}', { motivo: c.hidden_reason })}</p>}
      <div className="flex flex-wrap gap-1">
        {c.mine && (
          <V2Button type="button" size="sm" variant="ghost" disabled={apagar.isPending} onClick={() => setConfirmarApagar(true)}>
            <Trash2 className="h-4 w-4" />{t('Apagar')}
          </V2Button>
        )}
        {data.signed_in && !c.mine && !c.official && !oculto && (
          <V2Button type="button" size="sm" variant="ghost" onClick={() => onReport(c)}><Flag className="h-4 w-4" />{t('Denunciar')}</V2Button>
        )}
        {data.can_moderate && !isReply && !c.official && !respondendo && (
          <V2Button type="button" size="sm" variant="ghost" onClick={() => setRespondendo(true)}><MessageSquare className="h-4 w-4" />{t('Responder')}</V2Button>
        )}
        {data.can_moderate && !oculto && (
          <V2Button type="button" size="sm" variant="ghost" onClick={() => onHide(c)}><EyeOff className="h-4 w-4" />{t('Ocultar')}</V2Button>
        )}
        {data.can_moderate && oculto && (
          <V2Button type="button" size="sm" variant="ghost" disabled={reabrir.isPending} onClick={() => reabrir.mutate(undefined, { onSuccess: () => toast.success(t('Comentário reaberto.')), onError: (e) => toast.error(e.message) })}>
            <RotateCcw className="h-4 w-4" />{t('Reabrir')}
          </V2Button>
        )}
      </div>
      {respondendo && <ReplyForm federation={federation} comment={c} onDone={() => setRespondendo(false)} />}
      <ConfirmDialog
        open={confirmarApagar}
        onOpenChange={setConfirmarApagar}
        title={t('Apagar o seu comentário?')}
        description={t('Ele some da página e não dá para recuperar. As respostas a ele também são apagadas.')}
        confirmLabel={t('Apagar')}
        cancelLabel={t('Voltar')}
        destructive
        loading={apagar.isPending}
        onConfirm={() => apagar.mutate(undefined, { onSuccess: () => { setConfirmarApagar(false); toast.success(t('Comentário apagado.')); }, onError: (e) => toast.error(e.message) })}
      />
    </div>
  );
}

export default function CommentsSection({ federation, kind, targetId }) {
  const location = useLocation();
  const q = useFederationComments(federation, kind, targetId);
  const [text, setText] = useState('');
  const [denunciar, setDenunciar] = useState(null);
  const [ocultar, setOcultar] = useState(null);
  const postar = useFederationMutation(() => commentAction({ federationId: federation.id, action: 'post', kind, targetId, text }));
  const data = q.data;
  const enviar = (e) => {
    e.preventDefault();
    const v = validateCommentText(text);
    if (!v.ok) { toast.error(v.error); return; }
    postar.mutate(undefined, { onSuccess: () => { setText(''); toast.success(t('Comentário publicado.')); }, onError: (er) => toast.error(er.message) });
  };
  const ouvidoria = fedModuleOn(federation, 'discipline') ? `/f/${encodeURIComponent(federation.slug || federation.id)}#fed-ouvidoria` : null;
  // A federação desligou os comentários e ninguém escreveu antes: não há o que mostrar.
  if (data?.state.why === 'disabled' && data.comments.length === 0) return null;
  return (
    <section aria-labelledby={`cm-titulo-${targetId}`} className="space-y-3" data-dica="federacao-comentarios">
      <h2 id={`cm-titulo-${targetId}`} className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <MessageSquare className="h-5 w-5" aria-hidden="true" />{t('Comentários')}{data ? ` (${data.count})` : ''}
      </h2>
      {q.isLoading && <V2Skeleton lines={2} />}
      {q.isError && <V2ErrorState inline title={t('Os comentários não carregaram agora')} onRetry={q.refetch} />}
      {data && (
        <>
          {data.can_moderate && <Config key={`${data.state.mode}-${data.state.until_date || ''}`} federation={federation} kind={kind} targetId={targetId} state={data.state} />}
          {commentsStateLabel(data.state) && <p className="text-sm font-semibold text-gray-700">{commentsStateLabel(data.state)}</p>}
          {data.state.open && (
            <p className="text-xs text-gray-500">
              {t('Comentário público, com o seu nome. Respeite as pessoas e não exponha dados de ninguém.')}{' '}
              {ouvidoria
                ? <>{t('Comentário não é recurso nem denúncia: para isso, use a')} <Link to={ouvidoria} className="font-semibold underline underline-offset-2">{t('ouvidoria')}</Link>.</>
                : t('Comentário não é recurso nem denúncia.')}
            </p>
          )}
          {data.comments.length > 0 && (
            <ol className="space-y-2">
              {commentThreads(data.comments).map((c) => (
                <li key={c.id} className="space-y-2">
                  <Comment federation={federation} c={c} data={data} onReport={setDenunciar} onHide={setOcultar} />
                  {c.replies.map((r) => <Comment key={r.id} federation={federation} c={r} data={data} onReport={setDenunciar} onHide={setOcultar} isReply />)}
                </li>
              ))}
            </ol>
          )}
          {data.comments.length === 0 && data.state.open && <p className="text-sm text-gray-500">{t('Ninguém comentou ainda.')}</p>}
          {data.state.open && (data.signed_in ? (
            <form onSubmit={enviar} className="space-y-2" data-dica="federacao-comentarios-escrever">
              <V2Field label={t('Seu comentário')} htmlFor={`cm-texto-${targetId}`} hint={t('{n} de {max} caracteres', { n: text.length, max: COMMENT_TEXT_MAX })}>
                <V2Textarea id={`cm-texto-${targetId}`} rows={3} maxLength={COMMENT_TEXT_MAX} value={text} onChange={(e) => setText(e.target.value)} />
              </V2Field>
              <div className="flex justify-end"><V2Button type="submit" size="sm" disabled={postar.isPending}>{postar.isPending ? t('Publicando…') : t('Publicar comentário')}</V2Button></div>
            </form>
          ) : (
            <V2Button asChild size="sm" variant="secondary"><Link to={`/login?next=${encodeURIComponent(location.pathname)}`}>{t('Entrar para comentar')}</Link></V2Button>
          ))}
        </>
      )}
      {denunciar && <ReportDialog federation={federation} comment={denunciar} onClose={() => setDenunciar(null)} />}
      {ocultar && <HideDialog federation={federation} comment={ocultar} onClose={() => setOcultar(null)} />}
    </section>
  );
}

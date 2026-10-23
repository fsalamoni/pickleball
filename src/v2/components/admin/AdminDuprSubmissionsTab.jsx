/**
 * Envios ao DUPR (Painel admin → DUPR → Envios) — o livro que o servidor
 * mantém (`dupr_submissions`, `functions/duprSubmissions.js`).
 *
 * A cada 15 minutos o servidor confere as partidas decididas contra a política
 * (Funcionalidades → DUPR): as que vão ficam na fila com a carência, saem para
 * o DUPR e guardam o código; as que esperam alguém conectar o DUPR ficam
 * retidas, dizendo quem falta. Aqui o admin vê tudo, aprova (modo manual),
 * tenta de novo, processa na hora e apaga no DUPR com motivo.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ban, Check, CloudUpload, Play, RotateCcw, Trash2, Unlock } from 'lucide-react';
import { useDuprSubmissionAction, useDuprSubmissions } from '@/modules/rating/hooks/useDuprSubmissions';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import {
  V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { t, tk, fmtData } from '@/core/i18n';

const STATUS = {
  held: { tone: 'amber', label: tk('Retida') },
  awaiting_approval: { tone: 'blue', label: tk('Aguardando aprovação') },
  queued: { tone: 'neutral', label: tk('Na fila') },
  sent: { tone: 'green', label: tk('Enviada') },
  failed: { tone: 'red', label: tk('Com erro') },
  deleted: { tone: 'neutral', label: tk('Apagada no DUPR') },
};
const ORDEM = ['held', 'awaiting_approval', 'queued', 'failed', 'sent', 'deleted'];
const ORIGEM = { tournament: tk('Torneio'), game_day: tk('Dia de jogo'), club_event: tk('Evento de clube') };
const hora = (ms) => (ms ? fmtData(new Date(ms), { dateStyle: 'short', timeStyle: 'short' }) : '');
const placar = (games) => (games || []).map((g) => `${g.a}–${g.b}`).join(', ');

export default function AdminDuprSubmissionsTab() {
  const query = useDuprSubmissions();
  const acao = useDuprSubmissionAction();
  const [filtro, setFiltro] = useState('');
  const rows = useMemo(() => query.data?.rows || [], [query.data]);
  const contagem = useMemo(() => {
    const c = {};
    rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);
  const visiveis = filtro ? rows.filter((r) => r.status === filtro) : rows;

  async function rodar(payload, ok) {
    try {
      const r = await acao.mutateAsync(payload);
      if (ok) toast.success(typeof ok === 'function' ? ok(r) : ok);
      return true;
    } catch (err) {
      toast.error(err?.message || t('Não foi possível falar com o DUPR agora. Tente de novo em instantes.'));
      return false;
    }
  }

  const resumoDaPassada = (r) => {
    if (!r) return '';
    if (r.skipped === 'flag_off') return t('Nada processado: a integração oficial (flag) está desligada.');
    if (r.skipped === 'policy_off') return t('Nada processado: a política do DUPR está em "Desligado".');
    if (r.skipped === 'running') return t('Outra passada já estava rodando; esta não rodou junto.');
    return t('{c} enviadas, {u} atualizadas, {d} apagadas, {f} com erro.', { c: r.created || 0, u: r.updated || 0, d: r.deleted || 0, f: r.failed || 0 });
  };

  return (
    <div className="space-y-6" data-dica="admin-dupr-envios">
      <V2Surface className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <CloudUpload className="h-5 w-5" /> {t('Envios ao DUPR')}
        </h2>
        <p className="text-sm text-gray-500">
          {t('A cada 15 minutos o servidor confere as partidas decididas contra a política do DUPR (Funcionalidades → DUPR). Torneio espera a carência antes de ir, para dar tempo de corrigir o placar; dia de jogo vai ao publicar. Quem ainda não conectou o DUPR deixa a partida retida, e ela sai sozinha quando todos conectarem.')}
        </p>
        <p className="text-sm text-gray-500">
          {t('No piloto (integração só para admins), entram só as partidas com algum admin da plataforma. Partida já enviada só sai do DUPR se o resultado for apagado, o dia for despublicado, o torneio cancelado ou se você a apagar aqui.')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <V2Button
            type="button"
            disabled={acao.isPending}
            onClick={() => rodar({ acao: 'run' }, (r) => resumoDaPassada(r))}
          >
            <Play className="h-4 w-4" /> {acao.isPending ? t('Processando…') : t('Processar agora')}
          </V2Button>
          {query.data?.lastRun && (
            <p className="text-xs text-gray-500">
              {t('Última passada: {quando}.', { quando: hora(query.data.lastRun.at) })} {resumoDaPassada(query.data.lastRun.result)}
            </p>
          )}
        </div>
      </V2Surface>

      <V2Surface className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="font-display text-base font-bold text-ink">{t('Partidas')}</h3>
          <V2Field label={t('Mostrar')} htmlFor="dupr-envios-filtro">
            <V2Select
              id="dupr-envios-filtro"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              options={[{ value: '', label: t('Todas ({n})', { n: rows.length }) },
                ...ORDEM.map((s) => ({ value: s, label: `${t(STATUS[s].label)} (${contagem[s] || 0})` }))]}
            />
          </V2Field>
        </div>
        {query.isLoading && <V2Skeleton className="h-24 rounded-3xl" />}
        {query.isError && <V2ErrorState inline title={t('Os envios ao DUPR não carregaram')} description="" onRetry={() => query.refetch()} />}
        {query.isSuccess && visiveis.length === 0 && (
          <p className="text-sm text-gray-500">{rows.length ? t('Nenhuma partida nesta situação.') : t('Nenhuma partida passou pelo envio ao DUPR ainda.')}</p>
        )}
        {query.isSuccess && visiveis.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {visiveis.map((r) => (
              <SubmissionRow key={r.id} row={r} names={query.data.names} rodar={rodar} ocupado={acao.isPending} />
            ))}
          </ul>
        )}
      </V2Surface>
    </div>
  );
}

function SubmissionRow({ row: r, names, rodar, ocupado }) {
  const [apagando, setApagando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const s = STATUS[r.status] || STATUS.failed;
  const nome = (uid) => names?.[uid] || t('Atleta');
  const detalhes = [];
  if (r.status === 'held') {
    if ((r.problems || []).includes('guest')) detalhes.push(t('Tem jogador sem conta na plataforma: vincule o convidado a uma conta.'));
    if (r.missing_uids?.length) detalhes.push(t('Falta conectar o DUPR: {quem}.', { quem: r.missing_uids.map(nome).join(', ') }));
    if (r.no_entitlement_uids?.length) detalhes.push(t('Conta DUPR sem a assinatura exigida: {quem}.', { quem: r.no_entitlement_uids.map(nome).join(', ') }));
  }
  if (r.status === 'queued' && r.due_at_ms) detalhes.push(t('Vai ao DUPR a partir de {quando}.', { quando: hora(r.due_at_ms) }));
  if (r.status === 'failed') {
    if (r.last_error) detalhes.push(r.last_error);
    detalhes.push(r.next_try_ms ? t('Nova tentativa a partir de {quando}.', { quando: hora(r.next_try_ms) }) : t('Sem nova tentativa automática: confira e tente de novo.'));
  }
  if (r.status === 'deleted') detalhes.push(r.blocked ? t('Apagada pelo admin: {m}', { m: r.blocked_reason || '' }) : t('O resultado deixou de existir na plataforma.'));

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{r.event || t('Partida')}</p>
          <p className="text-xs text-gray-500">
            {[t(ORIGEM[r.origin] || ORIGEM.tournament), r.date ? formatDateShortBR(r.date) : null, placar(r.games), r.match_code ? t('código {c}', { c: r.match_code }) : null].filter(Boolean).join(' · ')}
          </p>
          {detalhes.map((d) => <p key={d} className={`mt-1 text-xs ${r.status === 'failed' ? 'text-red-600' : 'text-gray-500'}`}>{d}</p>)}
        </div>
        <V2Badge tone={s.tone}>{t(s.label)}</V2Badge>
        {r.status === 'awaiting_approval' && (
          <V2Button type="button" size="sm" disabled={ocupado} onClick={() => rodar({ acao: 'approve', identifier: r.id }, t('Aprovada: vai na próxima passada.'))}>
            <Check className="h-3.5 w-3.5" /> {t('Aprovar')}
          </V2Button>
        )}
        {r.status === 'failed' && (
          <V2Button type="button" size="sm" variant="subtle" disabled={ocupado} onClick={() => rodar({ acao: 'retry', identifier: r.id }, t('Vai de novo na próxima passada.'))}>
            <RotateCcw className="h-3.5 w-3.5" /> {t('Tentar de novo')}
          </V2Button>
        )}
        {r.blocked && (
          <V2Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={() => rodar({ acao: 'unblock', identifier: r.id }, t('Destravada: a política volta a decidir.'))}>
            <Unlock className="h-3.5 w-3.5" /> {t('Destravar')}
          </V2Button>
        )}
        {!r.blocked && !apagando && (
          <V2Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={() => setApagando(true)}>
            {r.match_code && r.status !== 'deleted' ? <Trash2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
            {r.match_code && r.status !== 'deleted' ? t('Apagar no DUPR') : t('Não enviar')}
          </V2Button>
        )}
      </div>
      {apagando && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await rodar({ acao: 'remove', identifier: r.id, reason: motivo }, t('Pronto: a partida não volta ao DUPR.'))) setApagando(false);
          }}
        >
          <V2Field label={t('Motivo (fica na auditoria)')} htmlFor={`dupr-motivo-${r.id}`} className="min-w-0 flex-1">
            <V2Input id={`dupr-motivo-${r.id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
          </V2Field>
          <V2Button type="submit" size="sm" variant="danger" disabled={ocupado || motivo.trim().length < 5}>{t('Confirmar')}</V2Button>
          <V2Button type="button" size="sm" variant="ghost" onClick={() => setApagando(false)}>{t('Cancelar')}</V2Button>
        </form>
      )}
    </li>
  );
}

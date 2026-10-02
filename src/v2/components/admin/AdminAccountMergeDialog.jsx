/**
 * Unificar o histórico de uma conta EXCLUÍDA numa conta que continua.
 *
 * Quatro momentos, nesta ordem:
 *
 * 1. **Quem fica** — sugestões pela semelhança de nome e e-mail com a conta
 *    excluída (a auditoria da exclusão guarda os dois), ou busca livre.
 * 2. **Prévia** — o servidor diz QUEM ERA a conta excluída, quem é a que
 *    fica, o que muda e se há CONFLITO (as duas contas na mesma partida).
 * 3. **Confirmação** — motivo (vai para a Auditoria) e a palavra UNIFICAR.
 *    Só o dono da plataforma executa, como na exclusão.
 * 4. **Resultado** — e o ranking se refaz sozinho.
 */
import React, { useMemo, useState } from 'react';
import {
  ArrowRight, CheckCircle2, GitMerge, Loader2, Search, ShieldAlert, XCircle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { V2Button, V2Input, V2Textarea } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isOwnerEmail } from '@/core/config/owners';
import { usePreviewAccountMerge, useMergeAccountHistory } from '@/modules/admin/hooks/usePlatformUsers';
import {
  MERGE_CONFIRM_WORD, suggestMergeTargets, validateMergeRequest, normalizarNome,
} from '@/modules/admin/domain/accountMerge';

const nomeDe = (u) => u?.full_name || u?.platform_name || u?.display_name || '(sem nome)';

function Conta({ titulo, nome, email, uid, tom }) {
  return (
    <div className={`min-w-0 flex-1 rounded-xl border p-3 ${tom}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className="truncate text-sm font-bold text-ink">{nome || '(sem nome)'}</p>
      <p className="truncate text-[11px] text-gray-500">{email || 'sem e-mail'}</p>
      <p className="truncate text-[10px] text-gray-400">{uid}</p>
    </div>
  );
}

export default function AdminAccountMergeDialog({ deleted, users, onClose }) {
  const { user } = useAuth();
  const podeExecutar = isOwnerEmail(user?.email);
  const preview = usePreviewAccountMerge();
  const merge = useMergeAccountHistory();
  const [destino, setDestino] = useState(null);
  const [busca, setBusca] = useState('');
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [resultado, setResultado] = useState(null);

  const sugestoes = useMemo(() => suggestMergeTargets(deleted, users), [deleted, users]);
  const buscados = useMemo(() => {
    const q = normalizarNome(busca);
    if (q.length < 2) return [];
    return (users || [])
      .filter((u) => u?.uid && [nomeDe(u), u.email, u.uid].some((v) => normalizarNome(v).includes(q)))
      .slice(0, 8);
  }, [users, busca]);

  const escolher = (u) => {
    setDestino(u);
    setResultado(null);
    preview.mutate({ fromUid: deleted.uid, intoUid: u.uid });
  };

  const report = preview.data?.report || null;
  const validacao = validateMergeRequest({ fromUid: deleted.uid, intoUid: destino?.uid, reason, confirmText });

  const executar = async () => {
    try {
      const r = await merge.mutateAsync({ fromUid: deleted.uid, intoUid: destino.uid, reason, confirm: confirmText });
      setResultado(r);
    } catch (err) {
      setResultado({ status: 'error', error: err.message });
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitMerge className="h-5 w-5" /> Unificar o histórico</DialogTitle>
          <DialogDescription>
            Os jogos, inscrições e resultados da conta excluída <strong>{deleted.name}</strong> passam
            para a conta que continua — no ranking, no rating e no perfil. Use quando a pessoa tinha
            dois cadastros. Posse (torneios, clubes), financeiro e conversas não mudam.
          </DialogDescription>
        </DialogHeader>

        {resultado?.status === 'merged' ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> Histórico unificado</p>
            <p className="mt-1 text-xs leading-5">
              {resultado.documentos} registro(s) passaram para {nomeDe(destino)}. O ranking
              {resultado.ranking ? ' já foi recalculado.' : ' é recalculado em instantes (pelo servidor).'}
              {' '}A Auditoria guarda o que mudou.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. quem fica */}
            {!destino && (
              <div className="space-y-3">
                {sugestoes.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-ink">Provavelmente é a mesma pessoa:</p>
                    <div className="space-y-1.5">
                      {sugestoes.map(({ user: u, motivos }) => (
                        <button
                          key={u.uid}
                          type="button"
                          onClick={() => escolher(u)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-left hover:border-gray-300"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-ink">{nomeDe(u)}</span>
                            <span className="block truncate text-[11px] text-gray-500">{u.email || u.uid}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-gray-500">{motivos.join(' · ')}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink">
                    {sugestoes.length > 0 ? 'Ou procure a conta que fica:' : 'Procure a conta que fica:'}
                  </p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <V2Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, e-mail ou uid…" />
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {buscados.map((u) => (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() => escolher(u)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5 text-left text-sm hover:border-gray-300"
                      >
                        <span className="truncate font-medium text-ink">{nomeDe(u)}</span>
                        <span className="shrink-0 truncate text-[11px] text-gray-400">{u.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. prévia */}
            {destino && (
              <div className="space-y-3">
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <Conta
                    titulo="Conta excluída"
                    nome={report?.excluida?.name || deleted.name}
                    email={report?.excluida?.email || deleted.email}
                    uid={deleted.uid}
                    tom="border-gray-200 bg-gray-50"
                  />
                  <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-gray-400 sm:rotate-0" />
                  <Conta
                    titulo="Conta que fica"
                    nome={report?.destino?.name || nomeDe(destino)}
                    email={report?.destino?.email || destino.email}
                    uid={destino.uid}
                    tom="border-acid/40 bg-acid/10"
                  />
                </div>
                <button type="button" className="text-[11px] font-semibold text-gray-500 underline hover:text-ink" onClick={() => { setDestino(null); preview.reset(); }}>
                  Escolher outra conta
                </button>

                {preview.isPending && (
                  <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> O servidor está conferindo o histórico…</p>
                )}
                {preview.isError && (
                  <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{preview.error.message}</p>
                )}
                {report && (
                  <div className="space-y-2">
                    {report.bloqueios.length > 0 && (
                      <ul className="space-y-1 rounded-xl bg-red-50 p-3">
                        {report.bloqueios.map((b) => (
                          <li key={b} className="flex items-start gap-1.5 text-xs text-red-700"><XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{b}</li>
                        ))}
                      </ul>
                    )}
                    {report.conflitosTotal > 0 && (
                      <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
                        <p className="font-semibold">
                          {report.conflitosTotal} conflito(s): as duas contas aparecem no mesmo registro — juntá-las faria a
                          pessoa jogar com (ou contra) ela mesma. Nada será gravado enquanto isso existir.
                        </p>
                        <ul className="mt-1 space-y-0.5 text-[11px]">
                          {report.conflitos.map((c) => <li key={c.path}>{c.motivo} <span className="text-red-400">({c.path})</span></li>)}
                        </ul>
                      </div>
                    )}
                    {report.total === 0 && report.bloqueios.length === 0 && report.conflitosTotal === 0 && (
                      <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                        Não há histórico esportivo desta conta para transferir — ou ele já foi unificado.
                      </p>
                    )}
                    {report.itens.length > 0 && (
                      <div className="rounded-xl border border-gray-100 p-3">
                        <p className="text-xs font-semibold text-ink">O que passa para {report.destino?.name}:</p>
                        <ul className="mt-1 grid gap-x-4 gap-y-0.5 text-[11px] text-gray-600 sm:grid-cols-2">
                          {report.itens.map((i) => <li key={i.label}>{i.label}: <strong className="text-ink">{i.count}</strong></li>)}
                        </ul>
                        {report.truncado && (
                          <p className="mt-1 text-[11px] text-amber-700">Há mais registros do que cabem numa passada — rode de novo depois para terminar.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. confirmação */}
                {report?.podeUnificar && (
                  podeExecutar ? (
                    <div className="space-y-2 rounded-xl border border-gray-100 p-3">
                      <label className="block text-xs font-semibold text-ink">
                        Motivo (vai para a Auditoria)
                        <V2Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: segunda conta do mesmo atleta, excluída em 30/09" />
                      </label>
                      <label className="block text-xs font-semibold text-ink">
                        Digite {MERGE_CONFIRM_WORD} para confirmar
                        <V2Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                      </label>
                    </div>
                  ) : (
                    <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      Só o dono da plataforma executa a unificação — como a exclusão. Você vê a prévia para conferir.
                    </p>
                  )
                )}
                {resultado?.status === 'blocked' && (
                  <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">O servidor encontrou um impedimento ao conferir de novo. Veja a prévia acima.</p>
                )}
                {resultado?.status === 'error' && (
                  <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{resultado.error}</p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>{resultado?.status === 'merged' ? 'Fechar' : 'Cancelar'}</V2Button>
          {resultado?.status !== 'merged' && report?.podeUnificar && podeExecutar && (
            <V2Button onClick={executar} disabled={!validacao.isValid || merge.isPending}>
              {merge.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Unificando…</> : <><GitMerge className="h-4 w-4" /> Unificar</>}
            </V2Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

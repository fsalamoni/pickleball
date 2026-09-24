/**
 * Excluir cadastro — prévia, confirmação e resultado.
 *
 * Três momentos, nesta ordem, e nenhum pode ser pulado:
 *
 * 1. **Prévia** — o servidor diz o que acontece com CADA conta: o que é
 *    apagado, o que fica no histórico com o nome trocado, o que fica guardado,
 *    e o que IMPEDE. Excluir sem ver isso seria excluir no escuro.
 * 2. **Confirmação** — motivo (vai para a Auditoria) e a palavra EXCLUIR.
 *    Conta impedida fica de fora sozinha; o admin não precisa desmarcar nada.
 * 3. **Resultado** — conta a conta, com o que deu certo e o que não deu.
 *
 * Só o dono da plataforma EXECUTA. Outro admin vê a prévia — é útil para
 * saber o tamanho da limpeza — e a tela diz por que não há botão.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, History, Loader2, ShieldAlert, Trash2, XCircle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { V2Badge, V2Button, V2Input, V2Textarea } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isOwnerEmail } from '@/core/config/owners';
import { usePreviewAccountDeletion, useDeleteAccounts } from '@/modules/admin/hooks/usePlatformUsers';
import {
  DELETION_CONFIRM_WORD, validateDeletionRequest,
} from '@/modules/admin/domain/accountDeletion';

function Linhas({ itens }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-600">
      {itens.map((i) => (
        <li key={i.label}>
          {i.label}{i.count > 1 ? ` (${i.count})` : ''}
        </li>
      ))}
    </ul>
  );
}

function RelatorioDaConta({ report }) {
  const r = report;
  return (
    <div className={`rounded-xl border p-3 ${r.canDelete ? 'border-gray-100' : 'border-red-200 bg-red-50/50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{r.name}</p>
          <p className="truncate text-[11px] text-gray-500">{r.email || r.uid}</p>
        </div>
        {r.canDelete
          ? <V2Badge tone="green">Pode excluir</V2Badge>
          : <V2Badge tone="red">Impedida</V2Badge>}
      </div>

      {r.blockers.length > 0 && (
        <ul className="mt-2 space-y-1">
          {r.blockers.map((b) => (
            <li key={b.label} className="text-xs text-red-700">
              <strong>{b.label}.</strong>{b.detail ? ` ${b.detail}` : ''}
            </li>
          ))}
        </ul>
      )}

      {r.canDelete && (
        <div className="mt-2 space-y-2">
          <div>
            <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-red-700">
              <Trash2 className="h-3 w-3" /> Será apagado
            </p>
            <Linhas itens={[
              ...(r.exists ? [{ label: 'Cadastro', count: 1 }] : []),
              ...(r.authExists ? [{ label: 'Conta de login', count: 1 }] : []),
              ...r.deletes,
            ]}
            />
          </div>
          {r.pseudonyms.length > 0 && (
            <div>
              <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <History className="h-3 w-3" /> Fica no histórico, como &ldquo;Atleta removido&rdquo;
              </p>
              <Linhas itens={r.pseudonyms} />
            </div>
          )}
          {r.retained.length > 0 && (
            <div>
              <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <Clock className="h-3 w-3" /> Fica guardado, sem o nome
              </p>
              <Linhas itens={r.retained} />
            </div>
          )}
          {r.truncated && (
            <p className="text-[11px] text-amber-700">
              Tem mais itens do que uma passada alcança. Rode a exclusão de novo depois para terminar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_RESULTADO = {
  deleted: { tone: 'green', label: 'Excluída', Icon: CheckCircle2 },
  partial: { tone: 'amber', label: 'Excluída em parte — rode de novo', Icon: AlertTriangle },
  blocked: { tone: 'red', label: 'Não excluída (impedida)', Icon: ShieldAlert },
  error: { tone: 'red', label: 'Falhou', Icon: XCircle },
};

export default function AdminAccountDeletionDialog({ users, onClose }) {
  const { user } = useAuth();
  const podeExecutar = isOwnerEmail(user?.email);
  const previa = usePreviewAccountDeletion();
  const excluir = useDeleteAccounts();
  const [motivo, setMotivo] = useState('');
  const [confirmacao, setConfirmacao] = useState('');

  const uids = useMemo(() => users.map((u) => u.uid), [users]);

  useEffect(() => {
    previa.mutate({ uids });
    // A prévia é pedida UMA vez, ao abrir. Refazê-la a cada render varreria o
    // banco em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const relatorios = (previa.data?.results || []).map((r) => r.report).filter(Boolean);
  const liberadas = relatorios.filter((r) => r.canDelete);
  const impedidas = relatorios.filter((r) => !r.canDelete);
  const resultados = excluir.data?.results || null;

  const validacao = validateDeletionRequest({
    uids: liberadas.map((r) => r.uid), reason: motivo, confirmText: confirmacao,
  });

  const executar = () => {
    if (!validacao.isValid) return;
    excluir.mutate({ uids: liberadas.map((r) => r.uid), reason: motivo.trim(), confirm: confirmacao.trim() });
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !excluir.isPending) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {resultados ? 'Resultado da exclusão' : `Excluir ${users.length} cadastro${users.length > 1 ? 's' : ''}`}
          </DialogTitle>
          <DialogDescription>
            A conta de login e os dados pessoais somem. O histórico esportivo fica, com o nome trocado
            por &ldquo;Atleta removido&rdquo; — apagá-lo reescreveria o resultado e o rating de outras
            pessoas. Reservas e pagamentos ficam guardados, sem o nome. A Auditoria registra tudo.
          </DialogDescription>
        </DialogHeader>

        {/* ---------------------------------------------------- resultado */}
        {resultados ? (
          <div className="space-y-2">
            {resultados.map((r) => {
              const meta = STATUS_RESULTADO[r.status] || STATUS_RESULTADO.error;
              const nome = r.report?.name || users.find((u) => u.uid === r.uid)?.full_name || r.uid;
              return (
                <div key={r.uid} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3">
                  <span className="min-w-0 truncate text-sm font-semibold text-ink">{nome}</span>
                  <V2Badge tone={meta.tone}><meta.Icon className="h-3 w-3" /> {meta.label}</V2Badge>
                  {r.error && <p className="w-full text-[11px] text-red-700">{r.error}</p>}
                  {r.storageError && (
                    <p className="w-full text-[11px] text-amber-700">
                      As fotos enviadas não puderam ser apagadas agora; o resto foi feito.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : previa.isPending || (!previa.data && !previa.isError) ? (
          <div className="flex items-center gap-3 py-8 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Levantando o que cada conta tem na plataforma…
          </div>
        ) : previa.isError ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-red-700">{previa.error?.message}</p>
            <V2Button size="sm" variant="secondary" onClick={() => previa.mutate({ uids })}>Tentar de novo</V2Button>
          </div>
        ) : (
          /* ---------------------------------------------------- prévia */
          <div className="space-y-4">
            <div className="space-y-2">
              {relatorios.map((r) => <RelatorioDaConta key={r.uid} report={r} />)}
            </div>

            {impedidas.length > 0 && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                {impedidas.length === 1 ? '1 conta está impedida e fica' : `${impedidas.length} contas estão impedidas e ficam`} de
                fora. Resolva o que está listado nela e tente de novo.
              </p>
            )}

            {!podeExecutar ? (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                <strong className="text-ink">Só o dono da plataforma executa a exclusão.</strong> Você pode
                conferir a prévia; peça a ele para concluir.
              </p>
            ) : liberadas.length > 0 && (
              <div className="space-y-3 rounded-xl border border-red-200 p-3">
                <div>
                  <label htmlFor="motivo-exclusao" className="text-sm font-semibold text-ink">Motivo</label>
                  <V2Textarea
                    id="motivo-exclusao"
                    rows={2}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex.: contas de exemplo criadas para testar os torneios"
                  />
                  {motivo && validacao.errors.reason && (
                    <p className="mt-1 text-[11px] text-red-600">{validacao.errors.reason}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="confirma-exclusao" className="text-sm font-semibold text-ink">
                    Digite <span className="font-mono">{DELETION_CONFIRM_WORD}</span> para confirmar
                  </label>
                  <V2Input
                    id="confirma-exclusao"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                {excluir.isError && <p className="text-xs text-red-700">{excluir.error?.message}</p>}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {resultados ? (
            <V2Button onClick={onClose}>Fechar</V2Button>
          ) : (
            <>
              <V2Button variant="ghost" onClick={onClose} disabled={excluir.isPending}>Cancelar</V2Button>
              {podeExecutar && liberadas.length > 0 && (
                <V2Button
                  className="bg-red-600 text-white hover:bg-red-700"
                  disabled={!validacao.isValid || excluir.isPending}
                  onClick={executar}
                >
                  {excluir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Excluir {liberadas.length} cadastro{liberadas.length > 1 ? 's' : ''}
                </V2Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

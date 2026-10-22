/**
 * Convidar um CLUBE ou uma ARENA para se filiar (Central → Filiados e cadastrados → Vínculos de clubes
 * e arenas). A lista da plataforma aparece já aberta, em ordem alfabética, e a
 * busca (nome ou cidade) só estreita; quem já é filiado, pediu ou tem convite
 * aparece com o motivo, sem botão. O convite não filia: quem gere aceita.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Check, Send, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useClubs } from '@/modules/clubs/hooks/useClubs';
import { useArenas } from '@/modules/arenas/hooks/useArenas';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { inviteAffiliation } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { canInviteOrg } from '@/modules/federations/domain/affiliations';
import { AFFILIATION_STATUS_LABELS, fedOrgDocId } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2FilterChip, V2SearchInput, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

const LIMITE = 50;
const normaliza = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function FedOrgInviteDialog({ federation, affiliations = [], onClose }) {
  const { user } = useAuth();
  const [kind, setKind] = useState('club');
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const clubs = useClubs();
  const arenas = useArenas();
  const q = kind === 'club' ? clubs : arenas;
  const porId = useMemo(() => new Map((affiliations || []).map((a) => [a.id, a])), [affiliations]);
  const todos = useMemo(() => (q.data || [])
    .filter((o) => o?.id && o.name && o.archived !== true && o.active !== false)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR')), [q.data]);
  const termo = normaliza(busca.trim());
  const achados = useMemo(() => (termo ? todos.filter((o) => normaliza(`${o.name} ${o.city || ''} ${o.state || ''}`).includes(termo)) : todos), [todos, termo]);
  const m = useFederationMutation(() => inviteAffiliation({ federation, kind, org: escolhido, uid: user?.uid, message: mensagem }));
  const trocarTipo = (k) => { setKind(k); setEscolhido(null); setBusca(''); };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-lg">
        <DialogTitle>{t('Convidar clube ou arena')}</DialogTitle>
        <DialogDescription>{t('Quem gere o clube ou a arena recebe o aviso e aceita ou recusa. Aceito, vira filiado na hora, sem passar por aprovação.')}</DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!escolhido) return;
            m.mutate(undefined, { onSuccess: () => { toast.success(t('Convite enviado a {org}.', { org: escolhido.name })); onClose(); }, onError: (er) => toast.error(er.message) });
          }}
        >
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Tipo')}>
            <V2FilterChip active={kind === 'club'} onClick={() => trocarTipo('club')}><Users className="h-4 w-4" aria-hidden="true" />{t('Clubes')}</V2FilterChip>
            <V2FilterChip active={kind === 'arena'} onClick={() => trocarTipo('arena')}><Building2 className="h-4 w-4" aria-hidden="true" />{t('Arenas')}</V2FilterChip>
          </div>
          {q.isError && <V2ErrorState inline title={kind === 'club' ? t('Não carregou a lista de clubes') : t('Não carregou a lista de arenas')} onRetry={() => q.refetch()} />}
          {q.isLoading && <V2Skeleton lines={4} />}
          {q.isSuccess && (
            <div className="space-y-2">
              <V2SearchInput id="fed-org-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Buscar por nome ou cidade')} aria-label={t('Buscar por nome ou cidade')} />
              {!achados.length ? (
                <p className="text-sm text-gray-500">{termo ? t('Nada com "{termo}".', { termo: busca.trim() }) : kind === 'club' ? t('Nenhum clube na plataforma ainda.') : t('Nenhuma arena na plataforma ainda.')}</p>
              ) : (
                <ul className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-gray-100 p-1">
                  {achados.slice(0, LIMITE).map((o) => {
                    const atual = porId.get(fedOrgDocId(federation.id, kind, o.id));
                    const bloqueado = !canInviteOrg(atual);
                    const marcado = escolhido?.id === o.id;
                    return (
                      <li key={o.id}>
                        <button type="button"
                          disabled={bloqueado}
                          aria-pressed={marcado}
                          onClick={() => setEscolhido(marcado ? null : o)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left coarse:min-h-11 ${marcado ? 'bg-acid/20' : 'hover:bg-paper'} disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-ink">{o.name}</span>
                            {(o.city || o.state) && <span className="block truncate text-xs text-gray-500">{[o.city, o.state].filter(Boolean).join('/')}</span>}
                          </span>
                          {bloqueado && <V2Badge tone="neutral">{t(AFFILIATION_STATUS_LABELS[atual.status] || atual.status)}</V2Badge>}
                          {marcado && <Check className="h-4 w-4 text-ink" aria-hidden="true" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {achados.length > LIMITE && <p className="text-xs text-gray-500">{t('Mostrando {n} de {total}. Busque pelo nome para achar os outros.', { n: LIMITE, total: achados.length })}</p>}
            </div>
          )}
          <V2Field label={t('Mensagem (opcional)')} htmlFor="fed-org-msg" hint={t('Vai junto com o convite.')}>
            <V2Textarea id="fed-org-msg" rows={2} maxLength={500} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button>
            <V2Button type="submit" disabled={!escolhido || m.isPending}><Send className="h-4 w-4" />{escolhido ? t('Convidar {org}', { org: escolhido.name }) : t('Convidar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
